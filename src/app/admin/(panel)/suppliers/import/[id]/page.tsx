import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import type { ImportResult } from "@/lib/catalog/import/run";
import type { FileSummary, ImportOptions } from "@/lib/catalog/import/sanmar";
import { ActionForm } from "@/components/admin/action-form";
import { deleteImportAction } from "../actions";
import { AutoRefresh } from "./auto-refresh";
import { ImportChooser } from "./chooser";

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

const count = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireStaff(["PURCHASING"]);
  const { id } = await params;
  const imp = await db.catalogImport.findUnique({ where: { id }, include: { supplier: true } });
  if (!imp) notFound();
  const summary = imp.summary as FileSummary;
  const result = imp.result as ImportResult | null;
  const options = imp.options as ImportOptions | null;
  // An import that hasn't moved in 10 minutes stopped (e.g. the server restarted).
  const stalled = imp.status === "RUNNING" && imp.updatedAt < new Date(Date.now() - 10 * 60_000);
  const running = imp.status === "RUNNING" && !stalled;
  const colors = summary.styles.reduce((n, s) => n + s[4], 0);
  const pct = imp.total ? Math.round((imp.progress / imp.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/suppliers/import" className="text-sm text-amber-700 hover:underline">← Imports</Link>
        <h1 className="page-title mt-1">{imp.supplier.name}: {imp.fileName}</h1>
        <p className="text-sm text-gray-600">
          Uploaded {when(imp.createdAt)} · {summary.styles.length.toLocaleString()} styles, {colors.toLocaleString()} colors, {summary.rows.toLocaleString()} SKUs in the file
        </p>
      </div>

      {running && (
        <section className="card space-y-2" data-testid="import-progress">
          <AutoRefresh />
          <div className="font-semibold">Importing… {imp.progress.toLocaleString()} of {imp.total.toLocaleString()} styles</div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
          <p className="text-xs text-gray-500">You can leave this page; the import keeps going.</p>
        </section>
      )}
      {stalled && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">This import stopped part-way ({imp.progress} of {imp.total} styles). Start it again below; what was already imported is kept.</p>}
      {imp.status === "FAILED" && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">The import stopped: {imp.error}. What was already imported is kept; you can start it again.</p>}

      {imp.status === "DONE" && result && (
        <section className="card space-y-2" data-testid="import-result">
          <h2 className="font-semibold">Done {imp.finishedAt && `· ${when(imp.finishedAt)}`}</h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-3">
            <li>{count(result.productsAdded, "product")} added</li>
            <li>{count(result.productsUpdated, "product")} updated</li>
            <li>{count(result.colorsAdded, "color")} added</li>
            <li>{count(result.sizesAdded, "size")} added</li>
            <li>{count(result.skusAdded, "SKU")} added</li>
            <li>{count(result.skusUpdated, "SKU")} updated</li>
            {result.rowsSkipped > 0 && <li className="text-amber-700">{result.rowsSkipped} rows skipped (no price)</li>}
          </ul>
          <Link href={`/admin/products?supplier=${imp.supplierId}`} className="inline-block text-sm text-amber-700 hover:underline">See the products →</Link>
          <p className="text-xs text-gray-500">Want more brands? Choose them below and import again; existing products are updated, not duplicated.</p>
        </section>
      )}

      {!running && <ImportChooser id={imp.id} styles={summary.styles} previous={options ? { ...options } : null} />}

      {!running && (
        <ActionForm action={deleteImportAction} submitLabel="Delete this upload" danger confirm="Delete the uploaded file? Imported products stay." className="flex items-center gap-3">
          <input type="hidden" name="id" value={imp.id} />
          <span className="text-xs text-gray-500">Removes the stored file; imported products stay.</span>
        </ActionForm>
      )}
    </div>
  );
}
