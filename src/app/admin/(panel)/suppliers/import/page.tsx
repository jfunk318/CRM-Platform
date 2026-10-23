import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { MAX_IMPORT_MB } from "@/lib/catalog/import/run";
import { ActionForm } from "@/components/admin/action-form";
import { FilePicker } from "@/components/file-picker";
import { uploadImportAction } from "./actions";

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const STATUS = { READY: "Ready to choose", RUNNING: "Importing", DONE: "Done", FAILED: "Failed" } as const;

export default async function ImportsPage() {
  const { db } = await requireStaff(["PURCHASING"]);
  const [suppliers, imports] = await Promise.all([
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.catalogImport.findMany({ include: { supplier: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const sanmar = suppliers.find((s) => s.code === "sanmar");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/suppliers" className="text-sm text-amber-700 hover:underline">← Suppliers</Link>
        <h1 className="page-title mt-1">Import a supplier catalog</h1>
        <p className="text-sm text-gray-500">
          Load products, colors, sizes, your costs and photos from a supplier&apos;s product data file. You choose which brands and categories to bring in
          before anything is saved, and importing a newer file later updates costs without undoing your own edits.
        </p>
      </div>
      <section className="card space-y-3">
        <h2 className="font-semibold">SanMar product data</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>Download SanMar&apos;s product data (SDL) file from your SanMar account, or ask your rep for it.</li>
          <li>Unzip the download. Inside is <span className="font-mono">SanMar_SDL_N.zip</span> (about 8 MB): upload that zip here. The unzipped CSV is too big to upload.</li>
        </ol>
        <ActionForm action={uploadImportAction} submitLabel="Read the file" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="supplierId">Supplier</label>
            <select className="input" id="supplierId" name="supplierId" defaultValue={sanmar?.id} required>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="file">File (.zip or .csv, up to {MAX_IMPORT_MB} MB)</label>
            <FilePicker id="file" name="file" accept=".zip,.csv" required maxMb={MAX_IMPORT_MB} hint="SanMar_SDL_N.zip" />
          </div>
        </ActionForm>
        <p className="text-xs text-gray-500">Reading a full SanMar file takes about 15–30 seconds.</p>
      </section>
      {imports.length > 0 && (
        <section className="card overflow-x-auto p-0">
          <table className="table" data-testid="imports">
            <thead>
              <tr><th>File</th><th>Supplier</th><th>Status</th><th>Uploaded</th></tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/admin/suppliers/import/${i.id}`} className="text-amber-700 hover:underline">{i.fileName}</Link></td>
                  <td>{i.supplier.name}</td>
                  <td>{STATUS[i.status]}{i.status === "RUNNING" && ` (${i.progress} of ${i.total})`}</td>
                  <td>{when(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
