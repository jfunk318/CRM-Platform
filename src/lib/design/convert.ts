// Turns artwork files the browser can't show (PDF, Illustrator, Photoshop,
// EPS, TIFF) into a PNG the design studio can place. The original file is
// still kept with the decoration for production; this is only for the
// mockup. Browser only.

/** File types placed as they are. */
const DIRECT = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
/** File types turned into a PNG first. */
const CONVERTED = ["pdf", "ai", "psd", "psb", "eps", "epsf", "tif", "tiff"];

export const extOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";
export const canPlace = (ext: string) => DIRECT.includes(ext) || CONVERTED.includes(ext);
export const needsConverting = (ext: string) => CONVERTED.includes(ext);

/** Longest side, in pixels, for vector files (PDF, Illustrator) rendered to a picture: plenty for print. */
const VECTOR_RENDER_PX = 4000;

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't convert the artwork"))), "image/png"));
}

function rgbaToCanvas(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(Uint8ClampedArray.from(rgba.subarray(0, width * height * 4)), width, height), 0, 0);
  return canvas;
}

/** PDFs, and Illustrator files (saved with PDF compatibility, the default): the first page, on a transparent background. */
async function fromPdf(data: ArrayBuffer): Promise<Blob> {
  // The legacy build runs in every browser in use (the modern one needs the very latest).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  } catch {
    throw new Error("That file couldn't be read. For Illustrator files, save with “Create PDF Compatible File” turned on, or save as PDF.");
  }
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = VECTOR_RENDER_PX / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport, background: "rgba(0,0,0,0)" }).promise;
  await doc.cleanup();
  return canvasToPng(canvas);
}

/** Photoshop: the flattened image, as saved. */
async function fromPsd(data: ArrayBuffer): Promise<Blob> {
  const { readPsd } = await import("ag-psd");
  const psd = readPsd(data, { skipLayerImageData: true, skipThumbnail: true });
  if (!psd.canvas) throw new Error("That Photoshop file has no flattened image. Save it with “Maximize compatibility” on, or as PNG.");
  return canvasToPng(psd.canvas as HTMLCanvasElement);
}

async function fromTiff(data: ArrayBuffer): Promise<Blob> {
  const UTIF = (await import("utif")).default;
  const ifds = UTIF.decode(data);
  if (!ifds.length) throw new Error("That TIFF couldn't be read");
  UTIF.decodeImage(data, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  return canvasToPng(rgbaToCanvas(rgba, ifds[0].width, ifds[0].height));
}

/**
 * EPS: browsers can't run PostScript, but most EPS files carry a preview
 * picture (a TIFF in the file's header), which is used for the mockup.
 * Illustrator EPS files often also hold a PDF copy of the art.
 */
async function fromEps(data: ArrayBuffer): Promise<Blob> {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  // A PDF copy inside (Illustrator saves one): render that, it's the real art.
  const pdfAt = indexOf(bytes, "%PDF-");
  if (pdfAt >= 0) {
    try {
      return await fromPdf(data.slice(pdfAt));
    } catch {
      // Fall through to the preview.
    }
  }
  if (bytes[0] === 0xc5 && bytes[1] === 0xd0 && bytes[2] === 0xd3 && bytes[3] === 0xc6) {
    const tiffStart = view.getUint32(20, true);
    const tiffLength = view.getUint32(24, true);
    if (tiffStart && tiffLength) return fromTiff(data.slice(tiffStart, tiffStart + tiffLength));
  }
  throw new Error("This EPS file has no preview to show. Save it as PDF or AI (or with a TIFF preview) to place it; it can still be attached to the order under Files.");
}

function indexOf(bytes: Uint8Array, text: string): number {
  const first = text.charCodeAt(0);
  outer: for (let i = 0; i < bytes.length - text.length; i++) {
    if (bytes[i] !== first) continue;
    for (let j = 1; j < text.length; j++) if (bytes[i + j] !== text.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}

/** A PNG of the artwork for placing. `ext` is the original file's extension. */
export async function toPlaceable(src: Blob, ext: string): Promise<Blob> {
  const data = await src.arrayBuffer();
  if (ext === "pdf" || ext === "ai") return fromPdf(data);
  if (ext === "psd" || ext === "psb") return fromPsd(data);
  if (ext === "tif" || ext === "tiff") return fromTiff(data);
  if (ext === "eps" || ext === "epsf") return fromEps(data);
  return src;
}

/** The extension a stored file's type stands for, when its name isn't known. */
export function extFromType(type: string): string {
  if (type.includes("pdf")) return "pdf";
  if (type.includes("photoshop") || type.includes("psd")) return "psd";
  if (type.includes("postscript")) return "eps";
  if (type.includes("tiff")) return "tif";
  if (type.includes("svg")) return "svg";
  return "";
}
