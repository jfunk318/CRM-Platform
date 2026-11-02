import "server-only";
import { type CommissionKind, Prisma } from "@prisma/client";
import type { BusinessDb } from "@/lib/db";
import { isArtKey } from "./banner-art";
import { StoreError } from "./stores";
import { THEMES } from "./themes";

/**
 * A store's setup chosen when it's made from a quote (the "Create webstore"
 * dialog): commission, delivery options and look. Unset parts are left as
 * they are. The same settings live on the store's own tabs afterwards.
 */
export type StoreSetup = {
  commission?: { kind: CommissionKind; value: Prisma.Decimal } | null;
  /** The delivery methods shoppers may choose; null = every active one. */
  deliveryMethodIds?: string[] | null;
  theme?: string;
  heroArt?: string | null;
  accentColor?: string | null;
  heroImageFileId?: string | null;
  logoFileId?: string | null;
  faviconFileId?: string | null;
};

export function checkSetup(s: StoreSetup) {
  if (s.commission) {
    const { kind, value } = s.commission;
    if (kind !== "PERCENT" && kind !== "PER_PIECE") throw new StoreError("Choose a commission type");
    if (value.lte(0) || (kind === "PERCENT" && value.gt(100))) throw new StoreError(kind === "PERCENT" ? "Commission must be between 0 and 100%" : "Commission must be more than $0");
  }
  if (s.theme !== undefined && !(s.theme in THEMES)) throw new StoreError("Choose a look");
  if (s.heroArt && s.heroArt !== "none" && !isArtKey(s.heroArt)) throw new StoreError("Choose a banner art");
  if (s.accentColor && !/^#[0-9a-f]{6}$/i.test(s.accentColor)) throw new StoreError("Accent color must look like #d97706");
}

export async function applyStoreSetup(db: BusinessDb, storeId: string, s: StoreSetup) {
  checkSetup(s);
  const data: Prisma.StoreUncheckedUpdateInput = {};
  if (s.commission !== undefined) {
    data.commissionKind = s.commission?.kind ?? null;
    data.commissionValue = s.commission?.value ?? null;
  }
  if (s.theme !== undefined) data.theme = s.theme;
  if (s.heroArt !== undefined) data.heroArt = s.heroArt;
  if (s.accentColor !== undefined) data.accentColor = s.accentColor;
  if (s.heroImageFileId !== undefined) data.heroImageFileId = s.heroImageFileId;
  if (s.logoFileId !== undefined) data.logoFileId = s.logoFileId;
  if (s.faviconFileId !== undefined) data.faviconFileId = s.faviconFileId;
  const ops: Prisma.PrismaPromise<unknown>[] = [db.store.update({ where: { id: storeId }, data })];
  if (s.deliveryMethodIds !== undefined) {
    const ids = s.deliveryMethodIds;
    if (ids && ids.length === 0) throw new StoreError("Offer at least one delivery option");
    ops.push(
      db.store.update({ where: { id: storeId }, data: { customDeliveryMethods: ids !== null } }),
      db.storeDeliveryMethod.deleteMany({ where: { storeId } }),
      ...(ids ? [db.storeDeliveryMethod.createMany({ data: ids.map((deliveryMethodId) => ({ businessId: db.$businessId, storeId, deliveryMethodId })) })] : []),
    );
  }
  await db.$transaction(ops);
}

/**
 * Start a store from another one's setup (a template): its look, pictures,
 * texts, how it sells (accounts, prices, markup, batching), commission,
 * delivery options, designer and owner portal, and its pages. Not its
 * items, codes, contacts or orders.
 */
export async function copyStoreSetup(db: BusinessDb, fromId: string, toId: string) {
  const from = await db.store.findUniqueOrThrow({ where: { id: fromId }, include: { deliveryMethods: true, pages: true } });
  await db.$transaction([
    db.store.update({
      where: { id: toId },
      data: {
        tagline: from.tagline,
        logoFileId: from.logoFileId,
        faviconFileId: from.faviconFileId,
        theme: from.theme,
        showHero: from.showHero,
        heroImageFileId: from.heroImageFileId,
        heroText: from.heroText,
        heroButton: from.heroButton,
        heroArt: from.heroArt,
        accentColor: from.accentColor,
        announcement: from.announcement,
        footerText: from.footerText,
        groupId: from.groupId,
        batchOrders: from.batchOrders,
        commissionKind: from.commissionKind,
        commissionValue: from.commissionValue,
        portalSections: from.portalSections,
        designerEnabled: from.designerEnabled,
        designerUpload: from.designerUpload,
        designerText: from.designerText,
        designerLibrary: from.designerLibrary,
        designerAnyGarment: from.designerAnyGarment,
        designerMethodIds: from.designerMethodIds,
        requestQuotes: from.requestQuotes,
        accountMode: from.accountMode,
        showPrices: from.showPrices,
        allowPayLater: from.allowPayLater,
        markupKind: from.markupKind,
        markupValue: from.markupValue,
        customDeliveryMethods: from.customDeliveryMethods,
      },
    }),
    db.storeDeliveryMethod.deleteMany({ where: { storeId: toId } }),
    db.storeDeliveryMethod.createMany({ data: from.deliveryMethods.map((d) => ({ businessId: db.$businessId, storeId: toId, deliveryMethodId: d.deliveryMethodId })) }),
    db.storePage.deleteMany({ where: { storeId: toId } }),
    db.storePage.createMany({
      data: from.pages.map((p) => ({
        businessId: p.businessId,
        storeId: toId,
        slug: p.slug,
        title: p.title,
        body: p.body,
        showInNav: p.showInNav,
        navOrder: p.navOrder,
        published: p.published,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
      })),
    }),
  ]);
}

/** The setup form's commission: none, or a kind and value. */
export function commissionFrom(kind: string | null, value: string | null): StoreSetup["commission"] {
  if (!kind) return null;
  const v = new Prisma.Decimal((value ?? "").trim() || "0");
  return { kind: kind as CommissionKind, value: v };
}
