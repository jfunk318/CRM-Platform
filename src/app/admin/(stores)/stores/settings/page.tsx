import { requireStaff } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/business";
import { decryptSecret, maskSecret } from "@/lib/crypto";
import { ACCOUNT_MODE_LABELS } from "@/lib/store/settings";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { removePaymentsAction, removeSlackAction, saveDefaultsAction, savePaymentsAction, saveSlackAction } from "../actions";

/** What every store inherits, and card payments for all stores. */
export default async function StoreDefaultsPage() {
  const { business } = await requireStaff(["ADMIN"]);
  const origin = await requestOrigin();
  const key = business.stripeSecretKeyEnc ? maskSecret(decryptSecret(business.stripeSecretKeyEnc)) : null;
  return (
    <div className="space-y-6">
      <h1 className="page-title">Defaults &amp; payments</h1>
      <section className="card space-y-3">
        <h2 className="font-semibold">Defaults for every store</h2>
        <p className="text-sm text-gray-500">Stores and groups that don&apos;t set their own use these.</p>
        <ActionForm action={saveDefaultsAction} className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="label" htmlFor="defaultAccountMode">Shopper accounts</label>
            <select className="input" id="defaultAccountMode" name="defaultAccountMode" defaultValue={business.defaultAccountMode}>
              {Object.entries(ACCOUNT_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="defaultShowPrices" defaultChecked={business.defaultShowPrices} /> Show prices</label>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="defaultAllowPayLater" defaultChecked={business.defaultAllowPayLater} /> Allow pay later</label>
        </ActionForm>
      </section>

      <section className="card space-y-3" data-testid="payments">
        <h2 className="font-semibold">Card payments (Stripe)</h2>
        <p className="text-sm text-gray-600">One Stripe account takes payments for the main site and every affiliate store.</p>
        {key ? (
          <p className="text-sm">
            Connected with key <span className="font-mono">{key}</span>
            {key.includes("_test_") && <span className="ml-2 rounded bg-warn-100 px-1.5 text-xs text-warn-900">test mode</span>}
            {business.stripeWebhookSecretEnc ? " · webhook set" : <span className="text-brand-700"> · add the webhook signing secret so payments are confirmed even if a shopper closes their browser</span>}
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            Not set up yet. {process.env.NODE_ENV === "production" ? "Shoppers can't pay by card until it is." : "In development, checkout uses a test payment page instead."}
          </p>
        )}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>In your Stripe dashboard, open Developers → API keys and copy the secret key (or a restricted key with Checkout Sessions write access).</li>
          <li>
            Under Developers → Webhooks, add the endpoint <span className="font-mono text-gray-900">{origin}/api/stripe/webhook</span> for the events
            checkout.session.completed and checkout.session.async_payment_succeeded, then copy its signing secret.
          </li>
        </ol>
        <ActionForm action={savePaymentsAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="stripeSecretKey">Secret key</label>
            <input className="input font-mono" id="stripeSecretKey" name="stripeSecretKey" autoComplete="off" placeholder={key ? "Leave blank to keep the current key" : "sk_live_…"} />
          </div>
          <div>
            <label className="label" htmlFor="stripeWebhookSecret">Webhook signing secret</label>
            <input className="input font-mono" id="stripeWebhookSecret" name="stripeWebhookSecret" autoComplete="off" placeholder="whsec_…" />
          </div>
        </ActionForm>
        <p className="text-xs text-gray-500">Keys are stored encrypted and never shown again in full.</p>
        {key && <ActionButton action={removePaymentsAction} fields={{}} label="Disconnect Stripe" confirm="Remove the Stripe keys? Card checkout stops working." className="text-xs text-red-700 hover:underline" />}
      </section>

      <section className="card space-y-3" data-testid="slack">
        <h2 className="font-semibold">Store requests in Slack</h2>
        <p className="text-sm text-gray-600">
          Post store owners&apos; requests to a Slack channel as well as emailing them to you. In Slack, create an app with an Incoming Webhook for the channel and paste its URL.
          {business.slackWebhookEnc ? " A webhook is saved." : " None saved."}
        </p>
        <ActionForm action={saveSlackAction} submitLabel={business.slackWebhookEnc ? "Replace webhook" : "Save webhook"} resetOnSuccess className="flex flex-wrap items-end gap-2">
          <div className="min-w-72 flex-1">
            <label className="label" htmlFor="slackWebhook">Webhook URL</label>
            <input className="input font-mono" id="slackWebhook" name="slackWebhook" autoComplete="off" placeholder="https://hooks.slack.com/services/…" required />
          </div>
        </ActionForm>
        {business.slackWebhookEnc && <ActionButton action={removeSlackAction} fields={{}} label="Stop posting to Slack" className="text-xs text-red-700 hover:underline" />}
      </section>
    </div>
  );
}
