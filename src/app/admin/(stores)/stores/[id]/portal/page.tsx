import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { loadAdminStore } from "@/lib/store/admin";
import { PORTAL_SECTIONS } from "@/lib/store/portal";
import { addContactAction, removeContactAction, savePortalAction } from "../../actions";

/** What the store's owner sees at /owner, and who besides the store's customer can sign in to it. */
export default async function PortalSettings({ params }: { params: Promise<{ id: string }> }) {
  const { db, store, url } = await loadAdminStore((await params).id);
  if (store.kind === "ROOT") notFound();
  const contacts = await db.storeContact.findMany({ where: { storeId: store.id }, include: { customer: true }, orderBy: { createdAt: "asc" } });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-3">
        <h2 className="font-semibold">Owner portal</h2>
        <p className="text-sm text-gray-600">
          Store owners sign in at{" "}
          <a href={`${url}/owner`} target="_blank" className="font-mono text-brand-700 hover:underline">{`${url.replace(/^https?:\/\//, "")}/owner`}</a>{" "}
          with an emailed link. The store&apos;s customer
          {store.customer ? <> (<Link href={`/admin/customers/${store.customer.id}`} className="text-brand-700 hover:underline">{store.customer.firstName} {store.customer.lastName}</Link>)</> : " (none set yet)"} and the contacts here can open it.
        </p>
        <ActionForm action={savePortalAction} className="space-y-3">
          <input type="hidden" name="storeId" value={store.id} />
          <fieldset className="space-y-1 text-sm">
            <legend className="label">Sections owners see (plus Contacts)</legend>
            {Object.entries(PORTAL_SECTIONS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" name="sections" value={key} defaultChecked={store.portalSections.includes(key)} /> {label}
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="requestQuotes" defaultChecked={store.requestQuotes} className="mt-1" />
            <span>Make a draft quote for every new request (you can always make one from the request)</span>
          </label>
        </ActionForm>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Contacts</h2>
        <p className="text-sm text-gray-600">Coaches, booster club officers and others at the organization. Owners see this list in the portal.</p>
        <ul className="divide-y divide-gray-100 text-sm" data-testid="store-contacts">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                <Link href={`/admin/customers/${c.customerId}`} className="font-medium text-brand-700 hover:underline">{c.customer.firstName} {c.customer.lastName}</Link>
                {c.title ? ` · ${c.title}` : ""} · {c.customer.email ?? "no email"}
                {c.canManage ? <span className="ml-1.5 rounded bg-green-50 px-1.5 text-[11px] text-green-800">portal access</span> : null}
              </span>
              <ActionForm action={removeContactAction} submitLabel="Remove" danger className="flex">
                <input type="hidden" name="id" value={c.id} />
              </ActionForm>
            </li>
          ))}
          {contacts.length === 0 && <li className="py-1.5 text-gray-500">No contacts yet.</li>}
        </ul>
        <ActionForm action={addContactAction} submitLabel="Add contact" resetOnSuccess className="grid gap-2 border-t border-gray-100 pt-3 sm:grid-cols-2">
          <input type="hidden" name="storeId" value={store.id} />
          <div>
            <label className="label" htmlFor="c-first">First name</label>
            <input className="input" id="c-first" name="firstName" required />
          </div>
          <div>
            <label className="label" htmlFor="c-last">Last name</label>
            <input className="input" id="c-last" name="lastName" />
          </div>
          <div>
            <label className="label" htmlFor="c-email">Email</label>
            <input className="input" id="c-email" name="email" type="email" required />
          </div>
          <div>
            <label className="label" htmlFor="c-title">Title</label>
            <input className="input" id="c-title" name="title" placeholder="Head coach" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="canManage" defaultChecked /> Can sign in to the owner portal
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
