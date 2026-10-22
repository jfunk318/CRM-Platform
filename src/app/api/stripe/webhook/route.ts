import { requestOrigin } from "@/lib/business";
import { stripeKeys, verifyWebhook } from "@/lib/payments/stripe";
import { completeCheckoutSession } from "@/lib/store/checkout";
import { getRequestStore } from "@/lib/store/resolve";

/**
 * Stripe webhook for this business (set the endpoint to
 * https://<your domain>/api/stripe/webhook, events checkout.session.*).
 * Payments are confirmed with Stripe before anything is recorded.
 */
export async function POST(req: Request) {
  const rs = await getRequestStore();
  const keys = rs ? stripeKeys(rs.business) : null;
  if (!rs || !keys?.webhookSecret) return new Response("Not configured", { status: 404 });
  const body = await req.text();
  if (!verifyWebhook(body, req.headers.get("stripe-signature"), keys.webhookSecret)) return new Response("Bad signature", { status: 400 });
  const event = JSON.parse(body) as { type: string; data: { object: { id: string; object: string } } };
  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && event.data.object.object === "checkout.session") {
    await completeCheckoutSession(rs.db, keys, event.data.object.id, await requestOrigin());
  }
  return Response.json({ received: true });
}
