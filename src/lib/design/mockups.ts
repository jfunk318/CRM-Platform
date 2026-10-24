import "server-only";
import sharp from "sharp";
import type { BusinessTx } from "@/lib/db";
import { fileStore } from "@/lib/files/storage";
import { artworkOf } from "./artwork";
import { photoRect } from "./placement";

/** One view of a design with its placed artwork; positions are fractions of the photo. */
export type DesignMockup = {
  viewId: string;
  viewName: string;
  photoUrl: string | null;
  layers: { fileId: string; left: number; top: number; width: number; height: number; rotation: number }[];
};

/** Mockups for each design that has artwork placed, keyed by design id (views in order). */
export async function designMockups(db: BusinessTx, designIds: string[]): Promise<Map<string, DesignMockup[]>> {
  const out = new Map<string, DesignMockup[]>();
  if (designIds.length === 0) return out;
  const decorations = await db.designDecoration.findMany({
    where: { designId: { in: designIds }, artworkFileId: { not: null }, areaId: { not: null } },
    include: { area: { include: { view: true } }, design: { select: { colorId: true } } },
    orderBy: [{ designId: "asc" }, { sortOrder: "asc" }],
  });
  const viewIds = [...new Set(decorations.map((d) => d.area!.viewId))];
  const images = viewIds.length ? await db.viewImage.findMany({ where: { viewId: { in: viewIds } }, select: { viewId: true, colorId: true, url: true } }) : [];
  for (const d of decorations) {
    const art = artworkOf(d);
    const area = d.area;
    if (!art || !area) continue;
    const list = out.get(d.designId) ?? [];
    let view = list.find((v) => v.viewId === area.viewId);
    if (!view) {
      const photos = images.filter((i) => i.viewId === area.viewId);
      view = {
        viewId: area.viewId,
        viewName: area.view.name,
        photoUrl: (photos.find((i) => i.colorId === d.design.colorId) ?? photos[0])?.url ?? null,
        layers: [],
      };
      list.push(view);
    }
    const r = photoRect({ widthIn: area.widthIn.toNumber(), heightIn: area.heightIn.toNumber(), x: area.x, y: area.y, w: area.w, h: area.h }, art, art);
    view.layers.push({ fileId: art.artworkFileId, left: r.left, top: r.top, width: r.width, height: r.height, rotation: art.rotation });
    out.set(d.designId, list);
  }
  for (const list of out.values()) list.sort((a, b) => viewIds.indexOf(a.viewId) - viewIds.indexOf(b.viewId));
  return out;
}

const RENDER_PX = 1200;

async function photoBytes(url: string | null): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * A mockup as one PNG (for proofs and emails): the product photo with the
 * artwork composited on it. If the photo can't be fetched, the artwork is
 * shown on a plain background.
 */
export async function renderMockup(db: BusinessTx, m: DesignMockup): Promise<Buffer> {
  const photo = await photoBytes(m.photoUrl);
  const base = photo
    ? sharp(photo).resize(RENDER_PX, RENDER_PX, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" })
    : sharp({ create: { width: RENDER_PX, height: RENDER_PX, channels: 4, background: "#f3f4f6" } });
  const files = await db.storedFile.findMany({ where: { id: { in: m.layers.map((l) => l.fileId) } } });
  const overlays: sharp.OverlayOptions[] = [];
  for (const l of m.layers) {
    const file = files.find((f) => f.id === l.fileId);
    if (!file) continue;
    const width = Math.max(1, Math.round(l.width * RENDER_PX));
    const height = Math.max(1, Math.round(l.height * RENDER_PX));
    let art = sharp(await fileStore.get(file.storageKey)).resize(width, height, { fit: "fill" });
    if (l.rotation) art = sharp(await art.png().toBuffer()).rotate(l.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    const { data, info } = await art.png().toBuffer({ resolveWithObject: true });
    // Rotation grows the image around its center; keep the center where it was.
    const cx = (l.left + l.width / 2) * RENDER_PX;
    const cy = (l.top + l.height / 2) * RENDER_PX;
    const left = Math.round(cx - info.width / 2);
    const top = Math.round(cy - info.height / 2);
    // Overlays must sit inside the photo; crop any part that hangs off.
    const cropL = Math.max(0, -left), cropT = Math.max(0, -top);
    const w = Math.min(info.width - cropL, RENDER_PX - Math.max(0, left));
    const h = Math.min(info.height - cropT, RENDER_PX - Math.max(0, top));
    if (w <= 0 || h <= 0) continue;
    const input = cropL || cropT || w < info.width || h < info.height ? await sharp(data).extract({ left: cropL, top: cropT, width: w, height: h }).toBuffer() : data;
    overlays.push({ input, left: Math.max(0, left), top: Math.max(0, top) });
  }
  return base.composite(overlays).png().toBuffer();
}
