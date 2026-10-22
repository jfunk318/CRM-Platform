"use server";

import { randomBytes } from "node:crypto";
import type { AccountMode, MarkupKind, PromoKind } from "@prisma/client";
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
import { createStoreItem, repriceStoreItem } from "@/lib/store/items";
import { normalizeCode } from "@/lib/store/cart";
import { ACCOUNT_MODE_LABELS } from "@/lib/store/settings";

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof OrderError || e instanceof UploadError) throw new FormError(e.message);
      throw e;
    }
  });
}

const refresh = () => {
  revalidatePath("/admin/storefront", "layout");
  revalidatePath("/", "layout");
};

const rootStore = async (db: Awaited<ReturnType<typeof requireStaff>>["db"]) => db.store.findFirstOrThrow({ where: { kind: "ROOT" } });

/** "" = inherit; "on"/"off" = this store's own choice. */
const triState = (form: FormData, name: string) => {
  const v = String(form.get(name) ?? "");
  return v === "on" ? true : v === "off" ? false : null;
};

function accountMode(raw: string, allowInherit: boolean): AccountMode | null {
  if (!raw && allowInherit) return null;
  if (!(raw in ACCOUNT_MODE_LABELS)) throw new FormError("Choose how shopper accounts work");
  return raw as AccountMode;
}

// ─── Store settings ─────────────────────────────────────────────────────

export async function saveStoreAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return run(async () => {
    const store = await rootStore(db);
    const accent = optionalText(form, "accentColor");
    if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) throw new FormError("Accent color must look like #d97706");
    const ga4Id = optionalText(form, "ga4Id");
    if (ga4Id && !/^G-[A-Z0-9]{4,15}$/.test(ga4Id)) throw new FormError("Google Analytics ID should look like G-XXXXXXX");
    const metaPixelId = optionalText(form, "metaPixelId");
    if (metaPixelId && !/^\d{5,20}$/.test(metaPixelId)) throw new FormError("Meta Pixel ID should be digits only");
    const markupKind = (optionalText(form, "markupKind") as MarkupKind | null) ?? null;
    const markupValue = optionalDecimal(String(form.get("markupValue") ?? ""), "Markup");
    const methodIds = form.getAll("deliveryMethodIds").map(String);
    const custom = checkbox(form, "customDeliveryMethods");
    if (custom && methodIds.length === 0) throw new FormError("Choose at least one delivery method, or offer them all");
    await db.$transaction([
      db.store.update({
        where: { id: store.id },
        data: {
          name: text(form, "name", "Store name"),
          tagline: optionalText(form, "tagline"),
          accentColor: accent,
          announcement: optionalText(form, "announcement"),
          footerText: optionalText(form, "footerText"),
          accountMode: accountMode(String(form.get("accountMode") ?? ""), true),
          showPrices: triState(form, "showPrices"),
          allowPayLater: triState(form, "allowPayLater"),
          accessCode: optionalText(form, "accessCode"),
          markupKind: markupKind && markupValue ? markupKind : null,
          markupValue: markupKind && markupValue ? markupValue : null,
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
  const staff = await requireStaff(["ADMIN"]);
  return run(async () => {
    const [file] = formFiles(form, "logo");
    if (!file) throw new FormError("Choose an image");
    if (!isImage(file.name)) throw new FormError("The logo must be a PNG, JPG, GIF or WebP image");
    const saved = await saveUpload(staff.db, file, staff.id);
    const store = await rootStore(staff.db);
    await staff.db.store.update({ where: { id: store.id }, data: { logoFileId: saved.id } });
    refresh();
    return "Logo updated";
  });
}

export async function removeLogoAction(): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return run(async () => {
    const store = await rootStore(db);
    await db.store.update({ where: { id: store.id }, data: { logoFileId: null } });
    refresh();
    return "Logo removed";
  });
}

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

// ─── Payments ───────────────────────────────────────────────────────────

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
    revalidatePath("/admin/storefront");
    return "Saved";
  });
}

export async function removePaymentsAction(): Promise<ActionResult> {
  const { db } = await requireStaff(["ADMIN"]);
  return run(async () => {
    await db.business.update({ where: { id: db.$businessId }, data: { stripeSecretKeyEnc: null, stripeWebhookSecretEnc: null } });
    revalidatePath("/admin/storefront");
    return "Stripe disconnected";
  });
}

// ─── Pages ──────────────────────────────────────────────────────────────

export async function createPageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  let id = "";
  const r = await run(async () => {
    const store = await rootStore(db);
    const title = text(form, "title", "Title");
    const slug = slugify(optionalText(form, "slug") ?? title);
    if (!slug) throw new FormError("Give the page an address");
    const page = await db.storePage.create({ data: { businessId: db.$businessId, storeId: store.id, title, slug, body: `# ${title}\n\n` } });
    id = page.id;
  });
  if (r.error) return r;
  redirect(`/admin/storefront/pages/${id}`);
}

const RESERVED = new Set(["admin", "platform", "api", "c", "proof", "media", "shop", "catalog", "cart", "checkout", "account", "quote", "search", "track", "sitemap.xml", "robots.txt"]);

export async function savePageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  return run(async () => {
    const id = text(form, "id");
    const page = await db.storePage.findUniqueOrThrow({ where: { id } });
    const slug = page.slug === "home" ? "home" : slugify(text(form, "slug", "Address"));
    if (RESERVED.has(slug)) throw new FormError(`"/${slug}" is used by the store itself; choose another address`);
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
  const { db } = await requireStaff(["SALES"]);
  const r = await run(async () => {
    const id = text(form, "id");
    const page = await db.storePage.findUniqueOrThrow({ where: { id } });
    if (page.slug === "home") throw new FormError("The home page can't be deleted");
    await db.$transaction([db.storePage.updateMany({ where: { parentId: id }, data: { parentId: null } }), db.storePage.delete({ where: { id } })]);
    refresh();
  });
  if (r.error) return r;
  redirect("/admin/storefront/pages");
}

// ─── Shop items ─────────────────────────────────────────────────────────

export async function createItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  let id = "";
  const r = await run(async () => {
    const store = await rootStore(db);
    const line = parseLine(form);
    id = await createStoreItem(db, store.id, {
      name: text(form, "name", "Item name"),
      description: optionalText(form, "description"),
      productId: line.productId,
      colorId: line.colorId,
      sizeIds: selectedSizes(form),
      decorations: line.decorations,
      batchQty: int(String(form.get("batchQty") ?? "") || "24", "Batch quantity"),
    });
    refresh();
  });
  if (r.error) return r;
  redirect(`/admin/storefront/items/${id}`);
}

export async function saveItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  return run(async () => {
    const id = text(form, "id");
    const item = await db.storeItem.findUniqueOrThrow({ where: { id } });
    const slug = slugify(text(form, "slug", "Address"));
    if (!slug) throw new FormError("Give the item an address");
    const markupKind = (optionalText(form, "markupKind") as MarkupKind | null) ?? null;
    const markupValue = optionalDecimal(String(form.get("markupValue") ?? ""), "Markup");
    await db.storeItem.update({
      where: { id: item.id },
      data: {
        name: text(form, "name", "Name"),
        slug,
        description: optionalText(form, "description"),
        published: checkbox(form, "published"),
        featured: checkbox(form, "featured"),
        sortOrder: optionalNumber(String(form.get("sortOrder") ?? ""), "Order", true) ?? 0,
        markupKind: markupKind && markupValue ? markupKind : null,
        markupValue: markupKind && markupValue ? markupValue : null,
      },
    });
    refresh();
  });
}

export async function saveItemPricesAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
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
  const { db } = await requireStaff(["SALES"]);
  return run(async () => {
    await repriceStoreItem(db, text(form, "id"), int(String(form.get("batchQty") ?? ""), "Batch quantity"));
    refresh();
    return "Base prices updated";
  });
}

export async function uploadItemImageAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["SALES"]);
  return run(async () => {
    const [file] = formFiles(form, "image");
    if (!file) throw new FormError("Choose an image");
    if (!isImage(file.name)) throw new FormError("Use a PNG, JPG, GIF or WebP image");
    const saved = await saveUpload(staff.db, file, staff.id);
    await staff.db.storeItem.update({ where: { id: text(form, "id") }, data: { imageFileId: saved.id } });
    refresh();
    return "Picture updated";
  });
}

export async function deleteItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  const r = await run(async () => {
    const id = text(form, "id");
    // Orders keep their lines; they just lose the link to the item.
    await db.$transaction([db.orderLine.updateMany({ where: { storeItemId: id }, data: { storeItemId: null } }), db.storeItem.delete({ where: { id } })]);
    refresh();
  });
  if (r.error) return r;
  redirect("/admin/storefront/items");
}

// ─── Promo and gift codes ───────────────────────────────────────────────

const PROMO_KINDS: PromoKind[] = ["PERCENT", "AMOUNT", "FREE_SHIPPING"];
const dateOrNull = (raw: string | null, label: string) => {
  if (!raw) return null;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new FormError(`${label} must be a date`);
  return d;
};

export async function savePromoAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  return run(async () => {
    const id = optionalText(form, "id");
    const kind = String(form.get("kind")) as PromoKind;
    if (!PROMO_KINDS.includes(kind)) throw new FormError("Choose what the code does");
    const value = kind === "FREE_SHIPPING" ? decimal("0", "Value") : decimal(String(form.get("value") ?? ""), "Value");
    if (kind === "PERCENT" && value.gt(100)) throw new FormError("A percentage can't be over 100");
    const endsRaw = optionalText(form, "endsAt");
    const data = {
      code: normalizeCode(text(form, "code", "Code")),
      description: optionalText(form, "description"),
      kind,
      value,
      minSubtotal: optionalDecimal(String(form.get("minSubtotal") ?? ""), "Minimum"),
      startsAt: dateOrNull(optionalText(form, "startsAt"), "Start date"),
      // Ends at the end of that day.
      endsAt: endsRaw ? new Date(dateOrNull(endsRaw, "End date")!.getTime() + 86_399_000) : null,
      maxUses: optionalNumber(String(form.get("maxUses") ?? ""), "Uses", true),
      active: id ? checkbox(form, "active") : true,
    };
    if (!/^[A-Z0-9_-]{3,30}$/.test(data.code)) throw new FormError("Codes are 3–30 letters, numbers, - or _");
    if (await db.giftCode.findUnique({ where: { businessId_code: { businessId: db.$businessId, code: data.code } } })) throw new FormError("A gift code already uses that code");
    if (id) await db.promoCode.update({ where: { id }, data });
    else await db.promoCode.create({ data: { ...data, businessId: db.$businessId } });
    revalidatePath("/admin/promo-codes");
    return id ? "Saved" : `Added ${data.code}`;
  });
}

export async function saveGiftAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireStaff(["SALES"]);
  return run(async () => {
    const id = optionalText(form, "id");
    const expiresAt = dateOrNull(optionalText(form, "expiresAt"), "Expiry date");
    if (id) {
      await db.giftCode.update({
        where: { id },
        data: { note: optionalText(form, "note"), expiresAt, active: checkbox(form, "active"), balance: decimal(String(form.get("balance") ?? ""), "Balance") },
      });
      revalidatePath("/admin/gift-codes");
      return "Saved";
    }
    const amount = decimal(String(form.get("amount") ?? ""), "Amount");
    if (amount.lte(0)) throw new FormError("Amount must be more than zero");
    const code = normalizeCode(optionalText(form, "code") ?? `GIFT-${randomBytes(4).toString("hex").toUpperCase()}`);
    if (!/^[A-Z0-9_-]{4,30}$/.test(code)) throw new FormError("Codes are 4–30 letters, numbers, - or _");
    if (await db.promoCode.findUnique({ where: { businessId_code: { businessId: db.$businessId, code } } })) throw new FormError("A promo code already uses that code");
    await db.giftCode.create({ data: { businessId: db.$businessId, code, initialAmount: amount, balance: amount, expiresAt, note: optionalText(form, "note") } });
    revalidatePath("/admin/gift-codes");
    return `Created gift code ${code}`;
  });
}
