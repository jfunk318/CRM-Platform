import type { StoreGroup } from "@prisma/client";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { ACCOUNT_MODE_LABELS } from "@/lib/store/settings";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { deleteGroupAction, saveGroupAction } from "../actions";

const yesNo = (v: boolean) => (v ? "yes" : "no");

/** Groups of stores; their settings apply to every store in them unless a store sets its own. */
export default async function GroupsPage() {
  const { db, business } = await requireStaff(["STORE_MANAGER"]);
  const groups = await db.storeGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { stores: true } } } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Store groups</h1>
        <p className="text-sm text-gray-500">
          e.g. Schools, Teams, Corporate, Fundraisers. Settings left on &quot;business default&quot; use the{" "}
          <Link href="/admin/stores/settings" className="text-amber-700 hover:underline">defaults for every store</Link>; stores can override their group.
        </p>
      </div>
      {groups.map((g) => (
        <div key={g.id} className="card space-y-2" data-testid="group">
          <ActionForm action={saveGroupAction} className="grid gap-3 sm:grid-cols-6 sm:items-end">
            <input type="hidden" name="id" value={g.id} />
            <Fields g={g} business={business} />
          </ActionForm>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <Link href={`/admin/stores?group=${g.id}`} className="text-amber-700 hover:underline">{g._count.stores} store{g._count.stores === 1 ? "" : "s"}</Link>
            <ActionButton action={deleteGroupAction} fields={{ id: g.id }} label="Delete group" confirm={`Delete ${g.name}? Its stores stay, without a group.`} className="text-red-700 hover:underline" />
          </div>
        </div>
      ))}
      <div className="card">
        <h2 className="mb-2 font-semibold">New group</h2>
        <ActionForm action={saveGroupAction} submitLabel="Add group" resetOnSuccess className="grid gap-3 sm:grid-cols-6 sm:items-end">
          <Fields business={business} />
        </ActionForm>
      </div>
    </div>
  );
}

function Fields({ g, business }: { g?: StoreGroup; business: { defaultAccountMode: keyof typeof ACCOUNT_MODE_LABELS; defaultShowPrices: boolean; defaultAllowPayLater: boolean } }) {
  const k = g?.id ?? "new";
  const tri = (v: boolean | null | undefined) => (v === null || v === undefined ? "" : v ? "on" : "off");
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`gn-${k}`}>Name</label>
        <input className="input" id={`gn-${k}`} name="name" defaultValue={g?.name} required placeholder="Schools" />
      </div>
      <div className="sm:col-span-4">
        <label className="label" htmlFor={`gd-${k}`}>Description (staff only)</label>
        <input className="input" id={`gd-${k}`} name="description" defaultValue={g?.description ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`ga-${k}`}>Shopper accounts</label>
        <select className="input" id={`ga-${k}`} name="accountMode" defaultValue={g?.accountMode ?? ""}>
          <option value="">Business default ({ACCOUNT_MODE_LABELS[business.defaultAccountMode].split(" (")[0].toLowerCase()})</option>
          {Object.entries(ACCOUNT_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`gp-${k}`}>Show prices</label>
        <select className="input" id={`gp-${k}`} name="showPrices" defaultValue={tri(g?.showPrices)}>
          <option value="">Default ({yesNo(business.defaultShowPrices)})</option>
          <option value="on">Yes</option>
          <option value="off">No</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`gl-${k}`}>Pay later</label>
        <select className="input" id={`gl-${k}`} name="allowPayLater" defaultValue={tri(g?.allowPayLater)}>
          <option value="">Default ({yesNo(business.defaultAllowPayLater)})</option>
          <option value="on">Yes</option>
          <option value="off">No</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <span className="label">Default markup on items</span>
        <div className="flex gap-2">
          <select className="input w-32" name="markupKind" defaultValue={g?.markupKind ?? ""} aria-label="Markup type">
            <option value="">None</option>
            <option value="PERCENT">%</option>
            <option value="AMOUNT">$</option>
          </select>
          <input className="input w-24" name="markupValue" defaultValue={g?.markupValue?.toString() ?? ""} aria-label="Markup value" inputMode="decimal" />
        </div>
      </div>
    </>
  );
}
