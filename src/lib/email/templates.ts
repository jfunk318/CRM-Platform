// Customer and staff emails. Each returns plain text and HTML; every value
// placed into HTML is escaped.

export type EmailContent = { subject: string; text: string; html: string };

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Brand = { name: string; email?: string | null; phone?: string | null };

function layout(brand: Brand, heading: string, paragraphs: string[], button?: { label: string; url: string }): string {
  const p = paragraphs
    .map((t) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(t).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const btn = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="background:#f59e0b;color:#111;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#6b7280">Or open this link: ${escapeHtml(button.url)}</p>`
    : "";
  const contact = [brand.email, brand.phone].filter(Boolean).map((v) => escapeHtml(v!)).join(" · ");
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#fff;border-radius:8px;padding:24px">
<div style="font-weight:700;font-size:18px;margin-bottom:16px">${escapeHtml(brand.name)}</div>
<h1 style="font-size:18px;margin:0 0 14px">${escapeHtml(heading)}</h1>${p}${btn}
</div>
<p style="font-size:12px;color:#6b7280;text-align:center;margin-top:14px">${escapeHtml(brand.name)}${contact ? ` · ${contact}` : ""}</p>
</div></body></html>`;
}

function text(paragraphs: string[], button?: { label: string; url: string }, brand?: Brand): string {
  return [...paragraphs, ...(button ? [`${button.label}: ${button.url}`] : []), "", brand?.name ?? ""].join("\n\n").trim();
}

const money = (v: string | number) => `$${Number(v).toFixed(2)}`;

export function quoteEmail(o: { brand: Brand; customerName: string; ref: string; total: string; url: string; message?: string | null }): EmailContent {
  const subject = `Your quote ${o.ref} from ${o.brand.name}`;
  const paragraphs = [
    `Hi ${o.customerName},`,
    ...(o.message ? [o.message] : []),
    `Your quote ${o.ref} comes to ${money(o.total)}. You can review it, approve it or ask for changes online.`,
  ];
  const button = { label: "View your quote", url: o.url };
  return { subject, text: text(paragraphs, button, o.brand), html: layout(o.brand, `Quote ${o.ref}`, paragraphs, button) };
}

export function proofEmail(o: { brand: Brand; customerName: string; ref: string; proofNumber: number; url: string; message?: string | null }): EmailContent {
  const subject = `Artwork proof for order ${o.ref} — please review`;
  const paragraphs = [
    `Hi ${o.customerName},`,
    ...(o.message ? [o.message] : []),
    `Proof ${o.proofNumber} for your order ${o.ref} is ready. Please check the artwork, colors, size and placement, then approve it or let us know what to change. We start production once it's approved.`,
  ];
  const button = { label: "Review the proof", url: o.url };
  return { subject, text: text(paragraphs, button, o.brand), html: layout(o.brand, `Proof ${o.proofNumber} for order ${o.ref}`, paragraphs, button) };
}

export function invoiceEmail(o: {
  brand: Brand;
  customerName: string;
  invoiceRef: string;
  orderRef: string;
  total: string;
  balance: string;
  dueDate?: string | null;
  url: string;
}): EmailContent {
  const subject = `Invoice ${o.invoiceRef} from ${o.brand.name}`;
  const paragraphs = [
    `Hi ${o.customerName},`,
    `Here is invoice ${o.invoiceRef} for order ${o.orderRef}. Total ${money(o.total)}, balance due ${money(o.balance)}${o.dueDate ? `, due ${o.dueDate}` : ""}.`,
  ];
  const button = { label: "View your invoice", url: o.url };
  return { subject, text: text(paragraphs, button, o.brand), html: layout(o.brand, `Invoice ${o.invoiceRef}`, paragraphs, button) };
}

/** Heads-up to the assigned staff member when a customer responds. */
export function staffAlertEmail(o: { brand: Brand; heading: string; lines: string[]; url: string }): EmailContent {
  const button = { label: "Open in the back office", url: o.url };
  return { subject: o.heading, text: text([o.heading, ...o.lines], button), html: layout(o.brand, o.heading, o.lines, button) };
}
