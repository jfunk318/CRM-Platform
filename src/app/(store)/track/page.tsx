import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { ActionForm } from "@/components/admin/action-form";
import { Honeypot } from "@/components/store/honeypot";
import { trackOrderAction } from "../actions";

export const metadata = { title: "Track your order" };

export default async function TrackPage() {
  if (!(await getRequestStore())) notFound();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-3xl font-bold">Track your order</h1>
      <p className="text-[var(--st-muted)]">Enter your order number and the email you ordered with.</p>
      <ActionForm action={trackOrderAction} submitLabel="Find my order" className="space-y-3">
        <Honeypot />
        <div>
          <label className="label" htmlFor="t-number">Order number</label>
          <input className="input" id="t-number" name="number" required placeholder="1023" inputMode="numeric" />
        </div>
        <div>
          <label className="label" htmlFor="t-email">Email</label>
          <input className="input" id="t-email" name="email" type="email" required />
        </div>
      </ActionForm>
    </div>
  );
}
