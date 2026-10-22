import "server-only";
import type { EmailStatus } from "@prisma/client";
import type { BusinessTx } from "@/lib/db";
import type { EmailContent } from "./templates";

/**
 * Sends email through Resend (RESEND_API_KEY) or Postmark
 * (POSTMARK_SERVER_TOKEN). With neither configured (development), the email
 * is only recorded. Every email is logged per business, and a failed send
 * is recorded rather than thrown, so it never breaks the action that sent it.
 *
 * Mail goes out from the platform's address (EMAIL_FROM) under the
 * business's name, with replies going to the business's own email.
 */
const FROM_ADDRESS = process.env.EMAIL_FROM || "notifications@example.com";

type Outgoing = EmailContent & { to: string; fromName: string; replyTo?: string | null };

async function deliver(m: Outgoing): Promise<{ provider: string; status: EmailStatus; error?: string }> {
  const from = `${m.fromName.replace(/["<>]/g, "")} <${FROM_ADDRESS}>`;
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html, reply_to: m.replyTo || undefined }),
      });
      return res.ok ? { provider: "resend", status: "SENT" } : { provider: "resend", status: "FAILED", error: `${res.status} ${await res.text()}`.slice(0, 500) };
    }
    if (process.env.POSTMARK_SERVER_TOKEN) {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: { "X-Postmark-Server-Token": process.env.POSTMARK_SERVER_TOKEN, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ From: from, To: m.to, Subject: m.subject, TextBody: m.text, HtmlBody: m.html, ReplyTo: m.replyTo || undefined }),
      });
      return res.ok ? { provider: "postmark", status: "SENT" } : { provider: "postmark", status: "FAILED", error: `${res.status} ${await res.text()}`.slice(0, 500) };
    }
    console.log(`[email not sent: no provider configured] to=${m.to} subject="${m.subject}"`);
    return { provider: "none", status: "LOGGED" };
  } catch (e) {
    return { provider: process.env.RESEND_API_KEY ? "resend" : "postmark", status: "FAILED", error: String(e).slice(0, 500) };
  }
}

export const isValidEmail = (v: string | null | undefined): v is string => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Send (or record) an email for the business, optionally tied to an order or purchase order. */
export async function sendEmail(
  db: BusinessTx,
  m: Outgoing & { orderId?: string | null; purchaseOrderId?: string | null },
): Promise<{ status: EmailStatus; error?: string }> {
  const result = await deliver(m);
  await db.emailMessage.create({
    data: {
      businessId: db.$businessId,
      orderId: m.orderId ?? null,
      purchaseOrderId: m.purchaseOrderId ?? null,
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
      status: result.status,
      provider: result.provider,
      error: result.error,
    },
  });
  return result;
}

/** A note for the activity log when an email wasn't actually delivered. */
export function deliveryNote(status: "SENT" | "FAILED" | "LOGGED"): string {
  if (status === "FAILED") return " (failed to send)";
  if (status === "LOGGED") return " (not sent: email isn't set up)";
  return "";
}
