// Customers' artwork libraries: what gets filed, who sees it, and removal.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addOrderFiles, removeOrderFile } from "@/lib/files/order-files";
import { createOrder } from "@/lib/orders/service";
import { makeTestBusiness } from "@/test/fixtures";
import { forgetArtwork, libraryFor, removeFromLibrary, touchArtwork, uploadToLibrary } from "./library";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
const file = (name: string) => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3, name.length])], name, { type: "application/octet-stream" });
let companyId = "", alexId = "", samId = "", loneId = "";

beforeAll(async () => {
  t = await makeTestBusiness(`lib-${Date.now()}`);
  const b = t.business.id;
  companyId = (await t.db.company.create({ data: { businessId: b, name: "Lincoln Hockey" } })).id;
  alexId = (await t.db.customer.create({ data: { businessId: b, firstName: "Alex", companyId } })).id;
  samId = (await t.db.customer.create({ data: { businessId: b, firstName: "Sam", companyId } })).id;
  loneId = (await t.db.customer.create({ data: { businessId: b, firstName: "Lone" } })).id;
});
afterAll(async () => {
  await t.cleanup();
  await prisma.$disconnect();
});

const names = async (owner: { customerId: string | null; companyId: string | null }) => (await libraryFor(t.db, owner)).map((a) => a.name);

describe("artwork library", () => {
  let orderId = "";

  it("files images uploaded to an order under its customer and company, but not other files", async () => {
    orderId = await createOrder(t.db, { type: "ORDER", customerId: alexId, staffId: t.staff.id });
    await addOrderFiles(t.db, orderId, [file("crest.png"), file("brief.pdf"), file("wordmark.svg")], "ARTWORK", t.staff.id);
    await addOrderFiles(t.db, orderId, [file("packing.png")], "OTHER", t.staff.id);
    expect((await names({ customerId: alexId, companyId })).sort()).toEqual(["crest.png", "wordmark.svg"]);
    const crest = await t.db.artworkAsset.findFirstOrThrow({ where: { name: "crest.png" } });
    expect(crest).toMatchObject({ customerId: alexId, companyId });
  });

  it("is shared with the customer's company, and no one else", async () => {
    await uploadToLibrary(t.db, { customerId: null, companyId }, [file("team-logo.png")], t.staff.id);
    await uploadToLibrary(t.db, { customerId: loneId, companyId: null }, [file("solo.png")], t.staff.id);
    expect((await names({ customerId: samId, companyId })).sort()).toEqual(["crest.png", "team-logo.png", "wordmark.svg"]);
    expect(await names({ customerId: loneId, companyId: null })).toEqual(["solo.png"]);
    expect(await names({ customerId: null, companyId: null })).toEqual([]);
  });

  it("lists the most recently used first", async () => {
    const wordmark = await t.db.artworkAsset.findFirstOrThrow({ where: { name: "wordmark.svg" } });
    await touchArtwork(t.db, wordmark.fileId);
    expect((await names({ customerId: alexId, companyId }))[0]).toBe("wordmark.svg");
  });

  it("keeps each image once, however many times it's uploaded", async () => {
    await uploadToLibrary(t.db, { customerId: samId, companyId }, [file("team-logo.png")], t.staff.id); // same bytes as the company's
    await uploadToLibrary(t.db, { customerId: loneId, companyId: null }, [file("team-logo.png")], t.staff.id); // different customer: kept
    expect((await names({ customerId: samId, companyId })).filter((n) => n === "team-logo.png")).toHaveLength(1);
    expect(await names({ customerId: loneId, companyId: null })).toContain("team-logo.png");
  });

  it("only accepts images when uploaded straight to the library", async () => {
    await expect(uploadToLibrary(t.db, { customerId: alexId, companyId }, [file("notes.docx")], t.staff.id)).rejects.toThrow(/PNG, JPG/);
  });

  it("drops artwork from the library when it's removed from the order's files", async () => {
    const crestLink = await t.db.orderFile.findFirstOrThrow({ where: { orderId, file: { name: "crest.png" } } });
    await removeOrderFile(t.db, crestLink.id, t.staff.id);
    expect(await names({ customerId: alexId, companyId })).not.toContain("crest.png");
    expect(await t.db.storedFile.count({ where: { id: crestLink.fileId } })).toBe(0); // nothing else used it
  });

  it("keeps the order's file when artwork is removed from the library", async () => {
    const wordmark = await t.db.artworkAsset.findFirstOrThrow({ where: { name: "wordmark.svg" } });
    await removeFromLibrary(t.db, wordmark.id);
    expect(await t.db.storedFile.count({ where: { id: wordmark.fileId } })).toBe(1); // still on the order
    // Library-only artwork goes completely.
    const solo = await t.db.artworkAsset.findFirstOrThrow({ where: { name: "solo.png" } });
    await removeFromLibrary(t.db, solo.id);
    expect(await t.db.storedFile.count({ where: { id: solo.fileId } })).toBe(0);
  });

  it("removing artwork from an order's files stops offering it, copies included, even if another order lists it", async () => {
    const kim = (await t.db.customer.create({ data: { businessId: t.business.id, firstName: "Kim" } })).id;
    const owner = { customerId: kim, companyId: null };
    const a = await createOrder(t.db, { type: "QUOTE", customerId: kim, staffId: t.staff.id });
    const b = await createOrder(t.db, { type: "QUOTE", customerId: kim, staffId: t.staff.id });
    await addOrderFiles(t.db, a, [file("mascot.png")], "ARTWORK", t.staff.id);
    await addOrderFiles(t.db, b, [file("mascot.png")], "ARTWORK", t.staff.id); // the same image again
    expect(await names(owner)).toEqual(["mascot.png"]);
    const link = await t.db.orderFile.findFirstOrThrow({ where: { orderId: a } });
    await removeOrderFile(t.db, link.id, t.staff.id);
    expect(await names(owner)).toEqual([]);
    // The other quote keeps its file.
    expect(await t.db.orderFile.count({ where: { orderId: b } })).toBe(1);
    expect(await t.db.storedFile.count({ where: { id: link.fileId } })).toBe(0);
  });

  it("deleting from the library keeps files that designs still use", async () => {
    const lee = (await t.db.customer.create({ data: { businessId: t.business.id, firstName: "Lee" } })).id;
    const owner = { customerId: lee, companyId: null };
    const [saved] = await Promise.all([uploadToLibrary(t.db, owner, [file("badge.png")], t.staff.id)]);
    expect(saved).toBe(1);
    const asset = await t.db.artworkAsset.findFirstOrThrow({ where: { name: "badge.png" } });
    const design = await t.db.design.create({
      data: { businessId: t.business.id, name: "d", productId: t.product.id, colorId: t.product.colors[0].id, decorations: { create: { methodId: t.method.id, location: "Front", artworkFileId: asset.fileId } } },
    });
    expect(await forgetArtwork(t.db, owner, asset.fileId)).toBe(1);
    expect(await names(owner)).toEqual([]);
    expect(await t.db.storedFile.count({ where: { id: asset.fileId } })).toBe(1);
    await t.db.design.delete({ where: { id: design.id } });
  });
});
