import Link from "next/link";
import { notFound } from "next/navigation";
import type { DecorationPriceCell } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { CAPABILITIES, DIMENSION_UNIT, KIND_LABELS, PRICING_MODEL_LABELS } from "@/lib/catalog/methods";
import { ActionForm } from "@/components/admin/action-form";
import { type GridValue, PriceGridEditor } from "@/components/admin/price-grid-editor";
import { DEFAULT_WORKFLOW_STEPS } from "@/lib/production/defaults";
import { deletePriceTable, savePriceTable, saveMethod, saveWorkflow } from "../actions";

function toGrid(cells: Pick<DecorationPriceCell, "minQty" | "dimensionMax" | "unitPrice">[], flat: boolean): GridValue {
  const quantities = [...new Set(cells.map((c) => c.minQty))].sort((a, b) => a - b);
  const dims = flat
    ? [""]
    : [...new Set(cells.filter((c) => c.dimensionMax !== null).map((c) => c.dimensionMax!.toNumber()))]
        .sort((a, b) => a - b)
        .map(String);
  if (quantities.length === 0) return { quantities: ["1"], dimensions: flat ? [""] : ["1"], prices: [[""]] };
  return {
    quantities: quantities.map(String),
    dimensions: dims.length ? dims : [""],
    prices: quantities.map((q) =>
      (dims.length ? dims : [""]).map((d) => {
        const cell = cells.find(
          (c) => c.minQty === q && (flat || (c.dimensionMax !== null && c.dimensionMax.toNumber() === Number(d))),
        );
        return cell ? cell.unitPrice.toFixed(2) : "";
      }),
    ),
  };
}

const money = (v: { toFixed(n: number): string }) => v.toFixed(2);

export default async function MethodPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const staff = await requireStaff(["SALES", "PRODUCTION"]);
  const { db } = staff;
  const canEditSettings = hasAnyRole(staff.roles, ["ADMIN"]);
  const canEditPrices = hasAnyRole(staff.roles, ["SALES"]);
  const canEditProduction = hasAnyRole(staff.roles, ["PRODUCTION"]);
  const { id } = await params;
  const { group } = await searchParams;

  const [m, groups] = await Promise.all([
    db.decorationMethod.findUnique({
      where: { id },
      include: { priceTables: { include: { cells: true } }, workflowSteps: { orderBy: { sortOrder: "asc" } } },
    }),
    db.pricingGroup.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ]);
  if (!m) notFound();

  const caps = (m.capabilities ?? {}) as Record<string, boolean>;
  const flat = m.pricingModel === "FLAT";
  const selectedGroup = groups.find((g) => g.id === group) ?? null;
  const defaultTable = m.priceTables.find((t) => t.pricingGroupId === null);
  const groupTable = selectedGroup ? m.priceTables.find((t) => t.pricingGroupId === selectedGroup.id) : undefined;
  const table = selectedGroup ? (groupTable ?? defaultTable) : defaultTable;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/methods" className="text-sm text-brand-700 hover:underline">← Decoration methods</Link>
        <h1 className="page-title mt-1">{m.name}</h1>
      </div>

      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">Prices</h2>
          <p className="text-sm text-gray-500">
            Price per piece, per location. Rows are quantity breaks: a row applies from its quantity up to the next
            row. {flat ? "" : `Columns are "up to" limits on ${DIMENSION_UNIT[m.pricingModel]}: the smallest column that fits is used.`}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/admin/methods/${m.id}`}
            className={`rounded-full border px-3 py-1 ${!selectedGroup ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}
          >
            Default prices
          </Link>
          {groups.map((g) => {
            const has = m.priceTables.some((t) => t.pricingGroupId === g.id);
            return (
              <Link
                key={g.id}
                href={`/admin/methods/${m.id}?group=${g.id}`}
                className={`rounded-full border px-3 py-1 ${selectedGroup?.id === g.id ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}
              >
                {g.name}{has ? "" : " (uses default)"}
              </Link>
            );
          })}
        </nav>
        {table?.isPlaceholder && (
          <p className="rounded-md bg-warn-50 px-3 py-2 text-sm text-warn-900">
            These are placeholder prices. Replace them with your real prices and save.
          </p>
        )}
        {selectedGroup && !groupTable && (
          <p className="text-sm text-gray-600">
            {selectedGroup.name} uses the default prices. Saving here creates prices just for {selectedGroup.name}.
          </p>
        )}
        {canEditPrices ? (
          <ActionForm action={savePriceTable} submitLabel="Save prices" key={`${m.id}-${selectedGroup?.id ?? "default"}`}>
            <input type="hidden" name="methodId" value={m.id} />
            {selectedGroup && <input type="hidden" name="pricingGroupId" value={selectedGroup.id} />}
            <PriceGridEditor initial={toGrid(table?.cells ?? [], flat)} dimensionLabel={DIMENSION_UNIT[m.pricingModel]} />
          </ActionForm>
        ) : (
          <p className="text-sm text-gray-500">You can view prices but not change them.</p>
        )}
        {canEditPrices && selectedGroup && groupTable && (
          <ActionForm action={deletePriceTable} submitLabel={`Use default prices for ${selectedGroup.name}`} danger>
            <input type="hidden" name="methodId" value={m.id} />
            <input type="hidden" name="pricingGroupId" value={selectedGroup.id} />
          </ActionForm>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Settings</h2>
        <fieldset disabled={!canEditSettings}>
          <ActionForm action={saveMethod}>
            <input type="hidden" name="id" value={m.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name" name="name" defaultValue={m.name} required />
              <Field label="Short name" name="shortName" defaultValue={m.shortName} required />
              <Field label="Code" name="code" defaultValue={m.code} required />
              <div className="sm:col-span-3">
                <Field label="Description shown to customers" name="description" defaultValue={m.description ?? ""} />
              </div>
              <div>
                <label className="label" htmlFor="kind">Type</label>
                <select className="input" id="kind" name="kind" defaultValue={m.kind}>
                  {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pricingModel">Priced</label>
                <select className="input" id="pricingModel" name="pricingModel" defaultValue={m.pricingModel}>
                  {Object.entries(PRICING_MODEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <Field label="Sort order" name="sortOrder" defaultValue={String(m.sortOrder)} />
            </div>

            <h3 className="mt-2 text-sm font-semibold">Rules</h3>
            <div className="grid gap-3 sm:grid-cols-5">
              <Field label="Minimum quantity" name="minQty" defaultValue={String(m.minQty)} />
              <Field label="Max ink colors" name="maxColors" defaultValue={m.maxColors?.toString() ?? ""} placeholder="no limit" />
              <Field label="Minimum DPI" name="minDpi" defaultValue={m.minDpi?.toString() ?? ""} />
              <Field label="Ideal DPI" name="perfectDpi" defaultValue={m.perfectDpi?.toString() ?? ""} />
              <Field label="Production lead days" name="productionLeadDays" defaultValue={String(m.productionLeadDays)} />
            </div>
            {m.pricingModel === "PER_STITCH" && (
              <div className="max-w-xs">
                <Field label="Stitches per square inch" name="stitchDensity" defaultValue={String(m.stitchDensity)} />
                <p className="mt-1 text-xs text-gray-500">For estimates: the stitched part of the artwork × its size × this. Typed-in counts (from the digitized file) win.</p>
              </div>
            )}

            <h3 className="mt-2 text-sm font-semibold">Fees (per job, $)</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Screen setup (per screen)" name="screenSetupFee" defaultValue={money(m.screenSetupFee)} />
              <Field label="Artwork" name="artworkFee" defaultValue={money(m.artworkFee)} />
              <Field label="Digitizing" name="digitizingFee" defaultValue={money(m.digitizingFee)} />
              <Field label="Proof" name="proofingFee" defaultValue={money(m.proofingFee)} />
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Check name="useWhiteBaseOnDark" label="Print a white underbase on dark garments" checked={m.useWhiteBaseOnDark} />
              <Check name="chargeWhiteBaseScreen" label="Charge a screen fee for the underbase" checked={m.chargeWhiteBaseScreen} />
              <Check name="digitizingFeePerInch" label="Digitizing fee is per inch (longest side)" checked={m.digitizingFeePerInch} />
              <Check name="combineSameDesignQty" label="Combine quantities of the same design across items for price breaks" checked={m.combineSameDesignQty} />
            </div>

            <h3 className="mt-2 text-sm font-semibold">Design tool</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(CAPABILITIES).map(([k, label]) => (
                <Check key={k} name={`cap_${k}`} label={label} checked={Boolean(caps[k])} />
              ))}
            </div>

            <Check name="active" label="Active (offered to customers)" checked={m.active} />
            <Check name="shopperDesign" label="Shoppers can choose it in the online designer (stores turn the designer on)" checked={m.shopperDesign} />
          </ActionForm>
        </fieldset>
        {!canEditSettings && <p className="mt-2 text-sm text-gray-500">Only admins can change method settings.</p>}
      </section>

      <section className="card space-y-3" data-testid="production-settings">
        <div>
          <h2 className="font-semibold">Production</h2>
          <p className="text-sm text-gray-500">
            Each order gets a job for this method with these steps to tick off. Changing the steps affects new jobs only.
            Daily capacity spreads jobs across the production calendar.
          </p>
        </div>
        <fieldset disabled={!canEditProduction}>
          <ActionForm action={saveWorkflow} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="id" value={m.id} />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="steps">Steps, one per line</label>
              <textarea
                className="input min-h-32 font-mono text-sm"
                id="steps"
                name="steps"
                defaultValue={(m.workflowSteps.length ? m.workflowSteps.map((s) => s.name) : DEFAULT_WORKFLOW_STEPS[m.kind]).join("\n")}
              />
              {m.workflowSteps.length === 0 && <p className="mt-1 text-xs text-gray-500">Using the standard steps for {KIND_LABELS[m.kind]}.</p>}
            </div>
            <div>
              <Field label="Daily capacity (pieces)" name="dailyCapacity" defaultValue={m.dailyCapacity?.toString() ?? ""} placeholder="no limit" />
            </div>
          </ActionForm>
        </fieldset>
      </section>
    </div>
  );
}

function Field(props: { label: string; name: string; defaultValue: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>{props.label}</label>
      <input
        className="input"
        id={props.name}
        name={props.name}
        defaultValue={props.defaultValue}
        required={props.required}
        placeholder={props.placeholder}
      />
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={checked} /> {label}
    </label>
  );
}
