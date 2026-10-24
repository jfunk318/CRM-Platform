"use server";

import { randomBytes } from "node:crypto";
import type { AccountMode, MarkupKind, PersonalizationMode, PromoKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { type ActionResult, checkbox, decimal, FormError, int, optionalDecimal, optionalText, runAction, text } from "@/lib/admin/form";
import { optionalNumber, parseLine, selectedSizes } from "@/lib/admin/line-form";
import { slugify } from "@/lib/catalog/products";
import { encryptSecret } from "@/lib/crypto";
import { formFiles, saveUpload, UploadError } from "@/lib/files/storage";
import { isImage } from "@/lib/files/types";
import { OrderError } from "@/lib/orders/service";
import { normalizeCode } from "@/lib/store/cart";
import { createStoreItem, refreshMockupPicture, repriceStoreItem } from "@/lib/store/items";
import { batchStoreOrders } from "@/lib/store/batches";
import { checkStoreSlug, createAffiliateStore, StoreError } from "@/lib/store/stores";
import { ACCOUNT_MODE_LABELS } from "@/lib/store/settings";

type Db = Awaited<ReturnType<typeof requireStaff>>["db"];

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof OrderError || e instanceof UploadError || e instanceof StoreError) throw new FormError(e.message);
      throw e;
    }
  });
}

/** Store pages in the back office and the public storefronts. */
const refresh = () => {
  revalidatePath("/admin/stores", "layout");
  revalidatePath("/", "layout");
};

const storeOf = (db: Db, form: FormData) => db.store.findUniqueOrThrow({ where: { id: text(form, "storeId") } });

/** "" = inherit; "on"/"off" = this level's own choice. */
const triState = (form: FormData, name: string) => {
  const v = String(form.get(name) ?? "");
  return v === "on" ? true : v === "off" ? false : null;
};

function accountMode(raw: string, allowInherit: boolean): AccountMode | null {
  if (!raw && allowInherit) return null;
  if (!(raw in ACCOUNT_MODE_LABELS)) throw new FormError("Choose how shopper accounts work");
  return raw as AccountMode;
}

function markup(form: FormData) {
  const kind = (optionalText(form, "markupKind") as MarkupKind | null) ?? null;
  if (kind && kind !== "AMOUNT" && kind !== "PERCENT") throw new FormError("Choose a markup type");
  const value = optionalDecimal(String(form.get("markupValue") ?? ""), "Markup");
  return { markupKind: kind && value ? kind : null, markupValue: kind && value ? value : null };
}

const dateOrNull = (raw: string | null, label: string) => {
  if (!raw) return null;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new FormError(`${label} must be a date`);
  return d;
};

// ─── Stores ─────────────────────────────────────────────────────────────

export async function createStoreAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  let id = "";
  const r = await run(async () => {
    const store = await createAffiliateStore(db, {
      name: text(form, "name", "Store name"),
      slug: optionalText(form, "slug"),
      groupId: optionalText(form, "groupId"),
      managerId: optionalText(form, "managerId"),
      customerId: optionalText(form, "customerId"),
    });
    id = store.id;
    refresh();
  });
  if (r.error) return r;
  redirect(`/admin/stores/${id}`);
}

export async function saveStoreAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const store = await storeOf(db, form);
    const affiliate = store.kind === "AFFILIATE";
    const slug = affiliate ? text(form, "slug", "Address").toLowerCase() : null;
    if (slug !== null) await checkStoreSlug(db, slug, store.id);
    const accent = optionalText(form, "accentColor");
    if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) throw new FormError("Accent color must look like #d97706");
    const ga4Id = optionalText(form, "ga4Id");
    if (ga4Id && !/^G-[A-Z0-9]{4,15}$/.test(ga4Id)) throw new FormError("Google Analytics ID should look like G-XXXXXXX");
    const metaPixelId = optionalText(form, "metaPixelId");
    if (metaPixelId && !/^\d{5,20}$/.test(metaPixelId)) throw new FormError("Meta Pixel ID should be digits only");
    const opensAt = dateOrNull(optionalText(form, "opensAt"), "Opening date");
    const closesRaw = optionalText(form, "closesAt");
    // Closes at the end of that day.
    const closesAt = closesRaw ? new Date(dateOrNull(closesRaw, "Closing date")!.getTime() + 86_399_000) : null;
    if (opensAt && closesAt && closesAt < opensAt) throw new FormError("The store can't close before it opens");
    if (checkbox(form, "batchOrders") && !optionalText(form, "customerId")) throw new FormError("Batching makes one order for the store's customer; choose the customer");
    const methodIds = form.getAll("deliveryMethodIds").map(String);
    const custom = checkbox(form, "customDeliveryMethods");
    if (custom && methodIds.length === 0) throw new FormError("Choose at least one delivery method, or offer them all");
    await db.$transaction([
      db.store.update({
        where: { id: store.id },
        data: {
          name: text(form, "name", "Store name"),
          ...(slug !== null ? { slug } : {}),
          tagline: optionalText(form, "tagline"),
          accentColor: accent,
          announcement: optionalText(form, "announcement"),
          footerText: optionalText(form, "footerText"),
          ...(affiliate
            ? {
                groupId: optionalText(form, "groupId"),
                customerId: optionalText(form, "customerId"),
                opensAt,
                closesAt,
                active: checkbox(form, "active"),
                showcase: checkbox(form, "showcase"),
                batchOrders: checkbox(form, "batchOrders"),
              }
            : {}),
          managerId: optionalText(form, "managerId"),
          accountMode: accountMode(String(form.get("accountMode") ?? ""), true),
          showPrices: triState(form, "showPrices"),
          allowPayLater: triState(form, "allowPayLater"),
          accessCode: optionalText(form, "accessCode"),
          ...markup(form),
          customDeliveryMethods: custom,
          ga4Id,
          metaPixelId,
        },
      }),
      db.storeDeliveryMethod.deleteMany({ where: { storeId: store.id } }),
      ...(custom ? [db.storeDeliveryMethod.createMany({ data: methodIds.map((deliveryMethodId) => ({ businessId: db.$businessId, storeId: store.id, deliveryMethodId })) })] : []),
    ]);
    refresh();
  });
}

export async function uploadLogoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const store = await storeOf(staff.db, form);
    const [file] = formFiles(form, "logo");
    if (!file) throw new FormError("Choose an image");
    if (!isImage(file.name)) throw new FormError("The logo must be a PNG, JPG, GIF or WebP image");
    const saved = await saveUpload(staff.db, file, staff.id);
    await staff.db.store.update({ where: { id: store.id }, data: { logoFileId: saved.id } });
    refresh();
    return "Logo updated";
  });
}

export async function removeLogoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const store = await storeOf(db, form);
    await db.store.update({ where: { id: store.id }, data: { logoFileId: null } });
    refresh();
    return "Logo removed";
  });
}

/** Only stores nobody has ordered from can be deleted; others are closed instead. */
export async function deleteStoreAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  const r = await run(async () => {
    const store = await storeOf(db, form);
    if (store.kind === "ROOT") throw new FormError("The main site can't be deleted");
    if (await db.order.count({ where: { storeId: store.id } })) throw new FormError("This store has orders, so it can't be deleted. Close it instead.");
    await db.$transaction([db.orderLine.updateMany({ where: { storeItem: { storeId: store.id } }, data: { storeItemId: null } }), db.store.delete({ where: { id: store.id } })]);
    refresh();
  });
  if (r.error) return r;
  redirect("/admin/stores");
}

// ─── Groups ─────────────────────────────────────────────────────────────

export async function saveGroupAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const id = optionalText(form, "id");
    const data = {
      name: text(form, "name", "Group name"),
      description: optionalText(form, "description"),
      accountMode: accountMode(String(form.get("accountMode") ?? ""), true),
      showPrices: triState(form, "showPrices"),
      allowPayLater: triState(form, "allowPayLater"),
      ...markup(form),
    };
    if (id) await db.storeGroup.update({ where: { id }, data });
    else await db.storeGroup.create({ data: { ...data, businessId: db.$businessId, sortOrder: await db.storeGroup.count() } });
    refresh();
    return id ? "Saved" : `Added ${data.name}`;
  });
}

export async function deleteGroupAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const id = text(form, "id");
    await db.$transaction([db.store.updateMany({ where: { groupId: id }, data: { groupId: null } }), db.storeGroup.delete({ where: { id } })]);
    refresh();
    return "Deleted";
  });
}

// ─── Defaults and payments (admins) ─────────────────────────────────────

export async function saveDefaultsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return run(async () => {
    await db.business.update({
      where: { id: db.$businessId },
      data: {
        defaultAccountMode: accountMode(String(form.get("defaultAccountMode") ?? ""), false)!,
        defaultShowPrices: checkbox(form, "defaultShowPrices"),
        defaultAllowPayLater: checkbox(form, "defaultAllowPayLater"),
      },
    });
    refresh();
  });
}

export async function savePaymentsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return run(async () => {
    const secret = optionalText(form, "stripeSecretKey");
    const webhook = optionalText(form, "stripeWebhookSecret");
    if (!secret && !webhook) throw new FormError("Paste a key to save it");
    if (secret && !/^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(secret)) throw new FormError("The secret key should start with sk_live_, sk_test_ or rk_…");
    if (webhook && !/^whsec_[A-Za-z0-9]{10,}$/.test(webhook)) throw new FormError("The webhook signing secret should start with whsec_");
    await db.business.update({
      where: { id: db.$businessId },
      data: {
        ...(secret ? { stripeSecretKeyEnc: encryptSecret(secret) } : {}),
        ...(webhook ? { stripeWebhookSecretEnc: encryptSecret(webhook) } : {}),
      },
    });
    revalidatePath("/admin/stores/settings");
    return "Saved";
  });
}

export async function removePaymentsAction(): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return run(async () => {
    await db.business.update({ where: { id: db.$businessId }, data: { stripeSecretKeyEnc: null, stripeWebhookSecretEnc: null } });
    revalidatePath("/admin/stores/settings");
    return "Stripe disconnected";
  });
}

// ─── Pages ──────────────────────────────────────────────────────────────

export async function createPageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  let path = "";
  const r = await run(async () => {
    const store = await storeOf(db, form);
    const title = text(form, "title", "Title");
    const slug = slugify(optionalText(form, "slug") ?? title);
    if (!slug) throw new FormError("Give the page an address");
    if (RESERVED_PAGES.has(slug)) throw new FormError(`"/${slug}" is used by the store itself; choose another address`);
    const page = await db.storePage.create({ data: { businessId: db.$businessId, storeId: store.id, title, slug, body: `# ${title}\n\n` } });
    path = `/admin/stores/${store.id}/pages/${page.id}`;
  });
  if (r.error) return r;
  redirect(path);
}

const RESERVED_PAGES = new Set(["admin", "platform", "api", "c", "proof", "media", "shop", "catalog", "cart", "checkout", "account", "quote", "search", "track", "sitemap.xml", "robots.txt"]);

export async function savePageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const id = text(form, "id");
    const page = await db.storePage.findUniqueOrThrow({ where: { id } });
    const slug = page.slug === "home" ? "home" : slugify(text(form, "slug", "Address"));
    if (RESERVED_PAGES.has(slug)) throw new FormError(`"/${slug}" is used by the store itself; choose another address`);
    const parentId = optionalText(form, "parentId");
    if (parentId === id) throw new FormError("A page can't be inside itself");
    if (parentId && (await db.storePage.findUniqueOrThrow({ where: { id: parentId } })).parentId) throw new FormError("Pages can be nested one level deep");
    await db.storePage.update({
      where: { id },
      data: {
        title: text(form, "title", "Title"),
        slug,
        body: String(form.get("body") ?? "").slice(0, 100_000),
        parentId: page.slug === "home" ? null : parentId,
        showInNav: page.slug === "home" ? false : checkbox(form, "showInNav"),
        navOrder: optionalNumber(String(form.get("navOrder") ?? ""), "Menu order", true) ?? 0,
        published: page.slug === "home" ? true : checkbox(form, "published"),
        seoTitle: optionalText(form, "seoTitle"),
        seoDescription: optionalText(form, "seoDescription"),
      },
    });
    refresh();
  });
}

export async function deletePageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  let storeId = "";
  const r = await run(async () => {
    const id = text(form, "id");
    const page = await db.storePage.findUniqueOrThrow({ where: { id } });
    if (page.slug === "home") throw new FormError("The home page can't be deleted");
    storeId = page.storeId;
    await db.$transaction([db.storePage.updateMany({ where: { parentId: id }, data: { parentId: null } }), db.storePage.delete({ where: { id } })]);
    refresh();
  });
  if (r.error) return r;
  redirect(`/admin/stores/${storeId}/pages`);
}

export async function batchNowAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["STORE_MANAGER"]);
  let orderId = "";
  const r = await run(async () => {
    const store = await storeOf(staff.db, form);
    orderId = (await batchStoreOrders(staff.db, store.id, staff.id)).orderId;
    refresh();
  });
  if (r.error) return r;
  redirect(`/admin/orders/${orderId}`);
}

// ─── Items ──────────────────────────────────────────────────────────────

export async function createItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  let path = "";
  const r = await run(async () => {
    const store = await storeOf(db, form);
    const line = parseLine(form);
    const id = await createStoreItem(db, store.id, {
      name: text(form, "name", "Item name"),
      description: optionalText(form, "description"),
      productId: line.productId,
      colorId: line.colorId,
      sizeIds: selectedSizes(form),
      decorations: line.decorations,
      batchQty: int(String(form.get("batchQty") ?? "") || "24", "Batch quantity"),
    });
    path = `/admin/stores/${store.id}/items/${id}`;
    refresh();
  });
  if (r.error) return r;
  redirect(path);
}

export async function saveItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const item = await db.storeItem.findUniqueOrThrow({ where: { id: text(form, "id") } });
    const slug = slugify(text(form, "slug", "Address"));
    if (!slug) throw new FormError("Give the item an address");
    await db.storeItem.update({
      where: { id: item.id },
      data: {
        name: text(form, "name", "Name"),
        slug,
        description: optionalText(form, "description"),
        published: checkbox(form, "published"),
        featured: checkbox(form, "featured"),
        sortOrder: optionalNumber(String(form.get("sortOrder") ?? ""), "Order", true) ?? 0,
        ...markup(form),
      },
    });
    refresh();
  });
}

export async function saveItemPricesAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const item = await db.storeItem.findUniqueOrThrow({ where: { id: text(form, "id") }, include: { prices: true } });
    await db.$transaction(
      item.prices.map((p) =>
        db.storeItemPrice.update({
          where: { id: p.id },
          data: {
            basePrice: decimal(String(form.get(`base_${p.id}`) ?? ""), "Base price"),
            overridePrice: optionalDecimal(String(form.get(`override_${p.id}`) ?? ""), "Override"),
          },
        }),
      ),
    );
    refresh();
  });
}

export async function repriceItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    await repriceStoreItem(db, text(form, "id"), int(String(form.get("batchQty") ?? ""), "Batch quantity"));
    refresh();
    return "Base prices updated";
  });
}

export async function uploadItemImageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const [file] = formFiles(form, "image");
    if (!file) throw new FormError("Choose an image");
    if (!isImage(file.name)) throw new FormError("Use a PNG, JPG, GIF or WebP image");
    const saved = await saveUpload(staff.db, file, staff.id);
    await staff.db.storeItem.update({ where: { id: text(form, "id") }, data: { imageFileId: saved.id, imageIsMockup: false } });
    refresh();
    return "Picture updated";
  });
}

const PERSONAL_MODES: PersonalizationMode[] = ["OFF", "OPTIONAL", "REQUIRED"];

export async function savePersonalizationAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const mode = (name: string) => {
      const v = String(form.get(name) ?? "OFF") as PersonalizationMode;
      if (!PERSONAL_MODES.includes(v)) throw new FormError("Choose whether names and numbers are offered");
      return v;
    };
    const nameMaxLength = int(String(form.get("nameMaxLength") ?? ""), "Name length");
    const numberMaxDigits = int(String(form.get("numberMaxDigits") ?? ""), "Number digits");
    if (nameMaxLength < 1 || nameMaxLength > 40) throw new FormError("Names can be 1 to 40 letters");
    if (numberMaxDigits < 1 || numberMaxDigits > 3) throw new FormError("Numbers can be 1 to 3 digits");
    const namePrice = decimal(String(form.get("namePrice") ?? "") || "0", "Name price");
    const numberPrice = decimal(String(form.get("numberPrice") ?? "") || "0", "Number price");
    if (namePrice.isNegative() || numberPrice.isNegative()) throw new FormError("Prices can't be negative");
    await db.storeItem.update({
      where: { id: text(form, "id") },
      data: {
        nameMode: mode("nameMode"),
        nameMaxLength,
        namePrice,
        numberMode: mode("numberMode"),
        numberMaxDigits,
        numberPrice,
        personalizationLocation: optionalText(form, "personalizationLocation"),
      },
    });
    refresh();
  });
}

export async function mockupPictureAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    if (!(await refreshMockupPicture(db, text(form, "id"), true))) throw new FormError("This item's design has no artwork placed");
    refresh();
    return "Picture made from the mockup";
  });
}

export async function deleteItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  let storeId = "";
  const r = await run(async () => {
    const item = await db.storeItem.findUniqueOrThrow({ where: { id: text(form, "id") } });
    storeId = item.storeId;
    // Orders keep their lines; they just lose the link to the item.
    await db.$transaction([db.orderLine.updateMany({ where: { storeItemId: item.id }, data: { storeItemId: null } }), db.storeItem.delete({ where: { id: item.id } })]);
    refresh();
  });
  if (r.error) return r;
  redirect(`/admin/stores/${storeId}/items`);
}

// ─── Promo and gift codes ───────────────────────────────────────────────

const PROMO_KINDS: PromoKind[] = ["PERCENT", "AMOUNT", "FREE_SHIPPING"];

/** "All stores", or the stores ticked. */
function scope(form: FormData) {
  const allStores = form.get("scope") !== "some";
  const storeIds = allStores ? [] : form.getAll("storeIds").map(String);
  if (!allStores && storeIds.length === 0) throw new FormError("Tick at least one store, or choose all stores");
  return { allStores, storeIds };
}

export async function savePromoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const id = optionalText(form, "id");
    const kind = String(form.get("kind")) as PromoKind;
    if (!PROMO_KINDS.includes(kind)) throw new FormError("Choose what the code does");
    const value = kind === "FREE_SHIPPING" ? decimal("0", "Value") : decimal(String(form.get("value") ?? ""), "Value");
    if (kind === "PERCENT" && value.gt(100)) throw new FormError("A percentage can't be over 100");
    const endsRaw = optionalText(form, "endsAt");
    const { allStores, storeIds } = scope(form);
    const data = {
      code: normalizeCode(text(form, "code", "Code")),
      description: optionalText(form, "description"),
      kind,
      value,
      minSubtotal: optionalDecimal(String(form.get("minSubtotal") ?? ""), "Minimum"),
      startsAt: dateOrNull(optionalText(form, "startsAt"), "Start date"),
      endsAt: endsRaw ? new Date(dateOrNull(endsRaw, "End date")!.getTime() + 86_399_000) : null,
      maxUses: optionalNumber(String(form.get("maxUses") ?? ""), "Uses", true),
      active: id ? checkbox(form, "active") : true,
      allStores,
    };
    if (!/^[A-Z0-9_-]{3,30}$/.test(data.code)) throw new FormError("Codes are 3–30 letters, numbers, - or _");
    if (await db.giftCode.findUnique({ where: { businessId_code: { businessId: db.$businessId, code: data.code } } })) throw new FormError("A gift code already uses that code");
    await db.$transaction(async (tx) => {
      const promo = id ? await tx.promoCode.update({ where: { id }, data }) : await tx.promoCode.create({ data: { ...data, businessId: tx.$businessId } });
      await tx.promoCodeStore.deleteMany({ where: { promoCodeId: promo.id } });
      if (storeIds.length) await tx.promoCodeStore.createMany({ data: storeIds.map((storeId) => ({ businessId: tx.$businessId, promoCodeId: promo.id, storeId })) });
    });
    refresh();
    return id ? "Saved" : `Added ${data.code}`;
  });
}

export async function saveGiftAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const id = optionalText(form, "id");
    const expiresAt = dateOrNull(optionalText(form, "expiresAt"), "Expiry date");
    const { allStores, storeIds } = scope(form);
    await db.$transaction(async (tx) => {
      let giftId = id;
      if (id) {
        await tx.giftCode.update({
          where: { id },
          data: { note: optionalText(form, "note"), expiresAt, active: checkbox(form, "active"), balance: decimal(String(form.get("balance") ?? ""), "Balance"), allStores },
        });
      } else {
        const amount = decimal(String(form.get("amount") ?? ""), "Amount");
        if (amount.lte(0)) throw new FormError("Amount must be more than zero");
        const code = normalizeCode(optionalText(form, "code") ?? `GIFT-${randomBytes(4).toString("hex").toUpperCase()}`);
        if (!/^[A-Z0-9_-]{4,30}$/.test(code)) throw new FormError("Codes are 4–30 letters, numbers, - or _");
        if (await tx.promoCode.findUnique({ where: { businessId_code: { businessId: tx.$businessId, code } } })) throw new FormError("A promo code already uses that code");
        giftId = (await tx.giftCode.create({ data: { businessId: tx.$businessId, code, initialAmount: amount, balance: amount, expiresAt, note: optionalText(form, "note"), allStores } })).id;
      }
      await tx.giftCodeStore.deleteMany({ where: { giftCodeId: giftId! } });
      if (storeIds.length) await tx.giftCodeStore.createMany({ data: storeIds.map((storeId) => ({ businessId: tx.$businessId, giftCodeId: giftId!, storeId })) });
    });
    refresh();
    return id ? "Saved" : "Gift code created";
  });
}

/** From a store's Codes tab: accept (or stop accepting) a code limited to chosen stores. */
export async function toggleStoreCodeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["STORE_MANAGER"]);
  return run(async () => {
    const store = await storeOf(db, form);
    const codeId = text(form, "codeId");
    const on = form.get("on") === "1";
    if (form.get("kind") === "gift") {
      const gift = await db.giftCode.findUniqueOrThrow({ where: { id: codeId } });
      if (gift.allStores) throw new FormError("This code works in every store; change that on the Gift codes page");
      if (on) await db.giftCodeStore.upsert({ where: { giftCodeId_storeId: { giftCodeId: gift.id, storeId: store.id } }, create: { businessId: db.$businessId, giftCodeId: gift.id, storeId: store.id }, update: {} });
      else await db.giftCodeStore.deleteMany({ where: { giftCodeId: gift.id, storeId: store.id } });
    } else {
      const promo = await db.promoCode.findUniqueOrThrow({ where: { id: codeId } });
      if (promo.allStores) throw new FormError("This code works in every store; change that on the Promo codes page");
      if (on) await db.promoCodeStore.upsert({ where: { promoCodeId_storeId: { promoCodeId: promo.id, storeId: store.id } }, create: { businessId: db.$businessId, promoCodeId: promo.id, storeId: store.id }, update: {} });
      else await db.promoCodeStore.deleteMany({ where: { promoCodeId: promo.id, storeId: store.id } });
    }
    refresh();
  });
}
