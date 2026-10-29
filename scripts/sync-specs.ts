// Print areas from SanMar's decoration spec sheets (Company Casuals) for
// every imported SanMar product: the locations each style offers, sized to
// SanMar's maximums and placed at life size on the photos.
//
//   npm run sync-specs                 every SanMar product
//   npm run sync-specs -- PC54 PC78H   just these styles
//   npm run sync-specs -- --refresh    fetch the sheets again (otherwise
//                                      ones fetched before are reused)
//
// Areas adjusted by hand in the product editor are left alone. Safe to run
// again; it pauses between styles to go easy on the site.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { applyPlannedAreas, fetchGarmentSpec, type GarmentSpec, PLACED_CODES, planAreas } from "../src/lib/catalog/garment-specs";
import { measureCollar } from "../src/lib/catalog/photo-geometry";

const prisma = new PrismaClient();
const PAUSE_MS = 400;
// Spec sheets fetched before, by style (not committed).
const CACHE = ".cache/garment-specs.json";
// Collar lines measured on the front photos, by style.
const PHOTO_CACHE = ".cache/garment-photos.json";

function load<T>(file: string): Record<string, T> {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function save(file: string, data: unknown) {
  mkdirSync(".cache", { recursive: true });
  writeFileSync(file, JSON.stringify(data));
}

/** The collar line on a product's front photo, as shown in the square frame (null if it doesn't read). */
async function frontCollar(productId: string): Promise<number | null> {
  const front = await prisma.productView.findFirst({ where: { productId, name: { equals: "Front", mode: "insensitive" } }, include: { images: { take: 1 } } });
  const url = front?.images[0]?.url;
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const S = 300;
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(S, S, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return measureCollar({ data, width: info.width, height: info.height, channels: info.channels });
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes("--refresh");
  const only = args.filter((a) => !a.startsWith("--")).map((s) => s.toUpperCase());
  const cache = refresh ? {} : load<GarmentSpec | null>(CACHE);
  const photos = refresh ? {} : load<number | null>(PHOTO_CACHE);
  const products = await prisma.product.findMany({
    where: { externalSource: "sanmar", ...(only.length ? { styleCode: { in: only, mode: "insensitive" } } : {}) },
    select: { id: true, styleCode: true, name: true },
    orderBy: { styleCode: "asc" },
  });
  if (products.length === 0) {
    console.log(only.length ? `No SanMar products with style ${only.join(", ")}.` : "No SanMar products imported yet.");
    return;
  }
  console.log(`Syncing decoration specs for ${products.length} product${products.length === 1 ? "" : "s"}…`);
  const specs = new Map<string, GarmentSpec | null>();
  const totals = { added: 0, updated: 0, kept: 0, missing: 0, failed: 0 };
  let fetchFailed = false;
  for (const [i, p] of products.entries()) {
    const style = p.styleCode.toUpperCase();
    let spec = specs.get(style) ?? (style in cache ? cache[style] : undefined);
    if (spec === undefined) {
      fetchFailed = false;
      try {
        spec = await fetchGarmentSpec(style);
      } catch (e) {
        console.log(`  ${style}: couldn't fetch (${e instanceof Error ? e.message : e})`);
        totals.failed++;
        fetchFailed = true;
        spec = null;
      }
      specs.set(style, spec);
      // Fetch errors aren't remembered, so the next run tries again.
      if (spec || !fetchFailed) {
        cache[style] = spec;
        save(CACHE, cache);
      }
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
    if (!spec || spec.locations.length === 0) {
      totals.missing++;
      continue;
    }
    if (!(style in photos)) {
      photos[style] = await frontCollar(p.id);
      save(PHOTO_CACHE, photos);
    }
    const planned = planAreas(spec, { collar: photos[style] });
    const r = await applyPlannedAreas(prisma, p.id, planned);
    totals.added += r.added;
    totals.updated += r.updated;
    totals.kept += r.kept;
    const unplaced = spec.locations.filter((l) => !PLACED_CODES.includes(l.code)).map((l) => l.name);
    console.log(`  ${style} ${p.name}: ${planned.length} areas (${r.added} new, ${r.updated} updated${r.kept ? `, ${r.kept} kept as adjusted` : ""})${unplaced.length ? `; not placed: ${unplaced.join(", ")}` : ""}  [${i + 1}/${products.length}]`);
  }
  console.log(
    `Done: ${totals.added} areas added, ${totals.updated} updated, ${totals.kept} left as adjusted by hand; ${totals.missing} product${totals.missing === 1 ? "" : "s"} without a spec sheet${totals.failed ? `, ${totals.failed} fetch errors` : ""}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
