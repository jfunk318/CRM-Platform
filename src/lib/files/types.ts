/** Upload limit per file. Server actions are configured to accept this much (next.config.ts). */
export const MAX_UPLOAD_MB = 50;

/**
 * File types staff and customers may upload, by extension: artwork, proofs,
 * embroidery files and everyday documents. The served content type comes
 * from this list, never from what the browser claimed.
 */
export const UPLOAD_TYPES: Record<string, { contentType: string; inline: boolean }> = {
  png: { contentType: "image/png", inline: true },
  jpg: { contentType: "image/jpeg", inline: true },
  jpeg: { contentType: "image/jpeg", inline: true },
  gif: { contentType: "image/gif", inline: true },
  webp: { contentType: "image/webp", inline: true },
  pdf: { contentType: "application/pdf", inline: true },
  // Vector and production formats are downloaded, not shown in the browser
  // (SVG can carry scripts).
  svg: { contentType: "image/svg+xml", inline: false },
  ai: { contentType: "application/postscript", inline: false },
  eps: { contentType: "application/postscript", inline: false },
  ps: { contentType: "application/postscript", inline: false },
  psd: { contentType: "image/vnd.adobe.photoshop", inline: false },
  tif: { contentType: "image/tiff", inline: false },
  tiff: { contentType: "image/tiff", inline: false },
  cdr: { contentType: "application/octet-stream", inline: false },
  dst: { contentType: "application/octet-stream", inline: false },
  emb: { contentType: "application/octet-stream", inline: false },
  pes: { contentType: "application/octet-stream", inline: false },
  exp: { contentType: "application/octet-stream", inline: false },
  zip: { contentType: "application/zip", inline: false },
  txt: { contentType: "text/plain", inline: false },
  csv: { contentType: "text/csv", inline: false },
  doc: { contentType: "application/msword", inline: false },
  docx: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false },
  xls: { contentType: "application/vnd.ms-excel", inline: false },
  xlsx: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false },
};

export const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export const isImage = (name: string) => ["png", "jpg", "jpeg", "gif", "webp"].includes(extensionOf(name));

/** Problem with an upload, or null if it's acceptable. */
export function uploadProblem(name: string, size: number): string | null {
  if (!name) return "The file has no name";
  if (size === 0) return `${name} is empty`;
  if (size > MAX_UPLOAD_MB * 1024 * 1024) return `${name} is larger than ${MAX_UPLOAD_MB} MB`;
  if (!UPLOAD_TYPES[extensionOf(name)]) return `${name}: that file type isn't accepted`;
  return null;
}

/** Strip path parts and control characters from an uploaded filename. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 200) || "file";
}

/** Response headers for serving a stored file safely. */
export function fileHeaders(name: string, size: number, forceDownload = false): Record<string, string> {
  const type = UPLOAD_TYPES[extensionOf(name)] ?? { contentType: "application/octet-stream", inline: false };
  const disposition = type.inline && !forceDownload ? "inline" : "attachment";
  return {
    "Content-Type": type.contentType,
    "Content-Length": String(size),
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
    "X-Content-Type-Options": "nosniff",
    // Even if a file is opened directly, nothing in it may run.
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    "Cache-Control": "private, max-age=3600",
  };
}
