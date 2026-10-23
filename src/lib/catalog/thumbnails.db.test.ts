import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { makeTestBusiness } from "@/test/fixtures";
import { colorThumbnails, productThumbnails } from "./thumbnails";

let t: Awaited<ReturnType<typeof makeTestBusiness>>;
let other: Awaited<ReturnType<typeof makeTestBusiness>>;

beforeAll(async () => {
  t = await makeTestBusiness(`thumb-${Date.now()}`);
  other = await makeTestBusiness(`thumb2-${Date.now()}`);
});
afterAll(async () => {
  await t.cleanup();
  await other.cleanup();
  await prisma.$disconnect();
});

describe("thumbnails", () => {
  it("uses the first view's photo in the first color, per product and per color", async () => {
    const { db, product, business } = t;
    const navy = product.colors[0];
    const white = await db.productColor.create({ data: { businessId: business.id, productId: product.id, name: "White", sortOrder: -1 } });
    const back = await db.productView.create({ data: { businessId: business.id, productId: product.id, name: "Back", sortOrder: 2 } });
    const front = await db.productView.create({ data: { businessId: business.id, productId: product.id, name: "Front", sortOrder: 1 } });
    await db.viewImage.createMany({
      data: [
        { businessId: business.id, viewId: back.id, colorId: white.id, url: "https://x/white-back.jpg" },
        { businessId: business.id, viewId: front.id, colorId: navy.id, url: "https://x/navy-front.jpg" },
        { businessId: business.id, viewId: back.id, colorId: navy.id, url: "https://x/navy-back.jpg" },
      ],
    });
    // White comes first but has no front photo; the first view wins, then the first color.
    expect(await productThumbnails(business.id, [product.id])).toEqual(new Map([[product.id, "https://x/navy-front.jpg"]]));
    expect(await colorThumbnails(business.id, [navy.id, white.id])).toEqual(
      new Map([
        [navy.id, "https://x/navy-front.jpg"],
        [white.id, "https://x/white-back.jpg"],
      ]),
    );
  });

  it("never returns another business's photos", async () => {
    expect((await productThumbnails(other.business.id, [t.product.id])).size).toBe(0);
    expect(await productThumbnails(t.business.id, [])).toEqual(new Map());
  });
});
