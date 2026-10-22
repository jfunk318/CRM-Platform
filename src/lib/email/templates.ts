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

/** A purchase order for a supplier, with its items in a table. */
export function purchaseOrderEmail(o: {
  brand: Brand;
  supplierName: string;
  poRef: string;
  accountNumber?: string | null;
  lines: { sku: string; description: string; qty: number; unitCost: string }[];
  total: string;
  shipTo: string[];
  blindShip: boolean;
  notes?: string | null;
}): EmailContent {
  const subject = `Purchase order ${o.poRef} from ${o.brand.name}`;
  const intro = [
    `Hello ${o.supplierName},`,
    `Please process purchase order ${o.poRef}${o.accountNumber ? ` for account ${o.accountNumber}` : ""}.`,
    ...(o.blindShip ? ["Please ship blind: no packing list, invoice or supplier branding in the box."] : []),
    ...(o.notes ? [o.notes] : []),
  ];
  const ship = `Ship to:\n${o.shipTo.join("\n")}`;
  const rows = o.lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-family:monospace">${escapeHtml(l.sku)}</td><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb">${escapeHtml(l.description)}</td><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:right">${l.qty}</td><td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:right">${money(l.unitCost)}</td></tr>`,
    )
    .join("");
  const table = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 14px"><thead><tr><th align="left" style="padding:4px 6px">SKU</th><th align="left" style="padding:4px 6px">Item</th><th align="right" style="padding:4px 6px">Qty</th><th align="right" style="padding:4px 6px">Cost</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3" style="padding:6px;text-align:right;font-weight:700">Total</td><td style="padding:6px;text-align:right;font-weight:700">${money(o.total)}</td></tr></tfoot></table>`;
  // The items table goes just before the ship-to paragraph.
  const html = layout(o.brand, `Purchase order ${o.poRef}`, [...intro, ship]).replace(
    '<p style="margin:0 0 14px;line-height:1.5">Ship to:',
    (m) => table + m,
  );
  const lines = o.lines.map((l) => `${l.qty} × ${l.sku} ${l.description} @ ${money(l.unitCost)}`);
  return { subject, text: [...intro, "", ...lines, `Total: ${money(o.total)}`, "", ship, "", o.brand.name].join("\n"), html };
}

export function shipmentEmail(o: {
  brand: Brand;
  customerName: string;
  ref: string;
  pickup: boolean;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  items: string[];
  complete: boolean;
  url?: string | null;
}): EmailContent {
  const what = o.complete ? "Your order" : "Part of your order";
  const subject = o.pickup ? `Order ${o.ref} picked up` : `Order ${o.ref} has shipped`;
  const paragraphs = [
    `Hi ${o.customerName},`,
    o.pickup
      ? `${what} ${o.ref} has been picked up. Thank you!`
      : `${what} ${o.ref} is on its way${o.carrier ? ` with ${o.carrier.toUpperCase()}` : ""}.${o.trackingNumber ? ` Tracking number: ${o.trackingNumber}` : ""}`,
    `Items:\n${o.items.join("\n")}`,
  ];
  const button = o.trackingUrl ? { label: "Track your package", url: o.trackingUrl } : o.url ? { label: "View your order", url: o.url } : undefined;
  return { subject, text: text(paragraphs, button, o.brand), html: layout(o.brand, subject, paragraphs, button) };
}

export function pickupReadyEmail(o: { brand: Brand; customerName: string; ref: string; address: string[]; url?: string | null }): EmailContent {
  const subject = `Order ${o.ref} is ready for pickup`;
  const paragraphs = [
    `Hi ${o.customerName},`,
    `Good news: your order ${o.ref} is ready to pick up.`,
    ...(o.address.length ? [`Pick it up at:\n${o.address.join("\n")}`] : []),
  ];
  const button = o.url ? { label: "View your order", url: o.url } : undefined;
  return { subject, text: text(paragraphs, button, o.brand), html: layout(o.brand, subject, paragraphs, button) };
}

export function orderConfirmationEmail(o: {
  brand: Brand;
  customerName: string;
  ref: string;
  items: string[];
  total: string;
  paid: string;
  balance: string;
  delivery?: string | null;
  url: string;
}): EmailContent {
  const subject = `Order ${o.ref} confirmed — thank you!`;
  const owing = Number(o.balance) > 0;
  const paragraphs = [
    `Hi ${o.customerName},`,
    `Thanks for your order ${o.ref}. We'll start on it and let you know when it's on its way.`,
    `Items:\n${o.items.join("\n")}`,
    `Total ${money(o.total)}${Number(o.paid) > 0 ? `, paid ${money(o.paid)}` : ""}${owing ? `, balance due ${money(o.balance)}` : ""}.${o.delivery ? `\nDelivery: ${o.delivery}` : ""}`,
  ];
  const button = { label: "View your order", url: o.url };
  return { subject, text: text(paragraphs, button, o.brand), html: layout(o.brand, `Order ${o.ref}`, paragraphs, button) };
}

/** A sign-in link for a shopper (sign up, magic link, or reset). */
export function signInEmail(o: { brand: Brand; url: string; minutes: number }): EmailContent {
  const subject = `Your sign-in link for ${o.brand.name}`;
  const paragraphs = [
    "Use the button below to sign in. You can set or change your password once you're in.",
    `The link works once and expires in ${o.minutes} minutes. If you didn't ask for it, you can ignore this email.`,
  ];
  const button = { label: "Sign in", url: o.url };
  return { subject, text: text(paragraphs, button, o.brand), html: layout(o.brand, "Sign in", paragraphs, button) };
}
