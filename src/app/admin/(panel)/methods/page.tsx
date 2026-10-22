import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { KIND_LABELS, PRICING_MODEL_LABELS } from "@/lib/catalog/methods";
import { ActionForm } from "@/components/admin/action-form";
import { createMethod } from "./actions";

export default async function MethodsPage() {
  await requireStaff(["SALES", "PRODUCTION"]);
  const methods = await db.decorationMethod.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
    include: { priceTables: { select: { isPlaceholder: true, pricingGroupId: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Decoration methods</h1>
        <p className="text-sm text-gray-500">Rules, fees, design-tool options and price tables for each method.</p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Type</th>
              <th>Priced</th>
              <th>Min qty</th>
              <th>Prices</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m) => {
              const defaultTable = m.priceTables.find((t) => t.pricingGroupId === null);
              const placeholder = !defaultTable || defaultTable.isPlaceholder;
              return (
                <tr key={m.id} className={m.active ? "" : "text-gray-400"}>
                  <td>
                    <Link href={`/admin/methods/${m.id}`} className="font-medium text-amber-700 hover:underline">
                      {m.name}
                    </Link>
                    <div className="text-xs text-gray-500">{m.code}{m.active ? "" : " · inactive"}</div>
                  </td>
                  <td>{KIND_LABELS[m.kind]}</td>
                  <td>{PRICING_MODEL_LABELS[m.pricingModel]}</td>
                  <td>{m.minQty}</td>
                  <td>
                    {placeholder ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Needs real prices</span>
                    ) : (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Set</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <ActionForm action={createMethod} submitLabel="Add method" className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="m-name">New method name</label>
            <input className="input" id="m-name" name="name" placeholder="e.g. Sublimation" required />
          </div>
          <div>
            <label className="label" htmlFor="m-code">Code</label>
            <input className="input" id="m-code" name="code" placeholder="SUB" required />
          </div>
          <div>
            <label className="label" htmlFor="m-kind">Type</label>
            <select className="input" id="m-kind" name="kind">
              {Object.entries(KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
