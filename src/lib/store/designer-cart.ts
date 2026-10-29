import "server-only";
import { designMockups, renderMockup } from "@/lib/design/mockups";
import { saveUpload } from "@/lib/files/storage";
import { decorationData, type DecorationSpec, OrderError } from "@/lib/orders/service";
import { ensureCart } from "./cart";
import { checkShopperDesign, type DesignerConfig, designerLibrary, designerProduct, shopperPrices } from "./designer";
import type { RequestStore } from "./resolve";

/**
 * Put a shopper's design in their cart: checked against the store's
 * designer rules, priced for the quantities, saved as a design with a
 * mockup picture, one cart line per size.
 */
export async function addDesignToCart(
  rs: RequestStore,
  config: DesignerConfig,
  o: { productId: string; colorId: string; quantities: Record<string, number>; decorations: DecorationSpec[]; lowResOk: boolean },
): Promise<void> {
  const product = await designerProduct(rs.db, rs.store, config, { id: o.productId });
  if (!product) throw new OrderError("That garment can't be designed here");
  const color = product.colors.find((c) => c.id === o.colorId);
  if (!color) throw new OrderError("Choose a color");
  const wanted = Object.entries(o.quantities).filter(([, q]) => q > 0);
  if (wanted.length === 0) throw new OrderError("Enter how many of each size you'd like");
  for (const [sizeId, q] of wanted) {
    if (!color.sizeIds.includes(sizeId)) throw new OrderError(`${color.name} doesn't come in that size`);
    if (!Number.isInteger(q) || q > 999) throw new OrderError("Quantities must be whole numbers under 1,000");
  }
  const cart = await ensureCart(rs);
  const library = (await designerLibrary(rs.db, rs.store, config)).map((a) => a.fileId);
  const decorations = await checkShopperDesign(rs.db, { product, cartId: cart.id, libraryFileIds: library, decorations: o.decorations, lowResOk: o.lowResOk });
  // Priced now so problems (too few pieces for a method…) show before it's added.
  const minQty = Math.max(1, ...decorations.map((d) => product.methods.find((m) => m.id === d.methodId)?.minQty ?? 1));
  await shopperPrices(rs.db, rs.store, { productId: product.id, colorId: color.id, quantities: Object.fromEntries(wanted), decorations, minQty });

  const design = await rs.db.design.create({
    data: {
      businessId: rs.business.id,
      name: `${product.name} — ${color.name} (designed online)`,
      productId: product.id,
      colorId: color.id,
      customerId: cart.customerId,
      decorations: { create: decorations.map(decorationData) },
    },
  });
  const [m] = (await designMockups(rs.db, [design.id])).get(design.id) ?? [];
  const image = m ? await saveUpload(rs.db, new File([new Uint8Array(await renderMockup(rs.db, m))], `${product.name} design.png`, { type: "image/png" }), null) : null;
  if (cart.status !== "OPEN") await rs.db.cart.update({ where: { id: cart.id }, data: { status: "OPEN", checkoutSessionId: null, amountDue: null } });
  await rs.db.cartItem.createMany({
    data: wanted.map(([sizeId, qty]) => ({ businessId: rs.business.id, cartId: cart.id, designId: design.id, imageFileId: image?.id ?? null, sizeId, qty })),
  });
}
