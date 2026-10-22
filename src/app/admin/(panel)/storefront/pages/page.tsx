import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { createPageAction } from "../actions";

export default async function PagesPage() {
  const { db } = await requireStaff(["SALES"]);
  const store = await db.store.findFirstOrThrow({ where: { kind: "ROOT" } });
  const pages = await db.storePage.findMany({ where: { storeId: store.id }, include: { parent: true }, orderBy: [{ navOrder: "asc" }, { title: "asc" }] });
  const sorted = [...pages.filter((p) => p.slug === "home"), ...pages.filter((p) => p.slug !== "home")];
  return (
    <div className="space-y-5">
      <div className="card overflow-x-auto p-0">
        <table className="table" data-testid="pages">
          <thead>
            <tr>
              <th>Page</th>
              <th>Address</th>
              <th>In menu</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/storefront/pages/${p.id}`} className="font-medium text-amber-700 hover:underline">{p.title}</Link>
                  {p.parent && <span className="text-xs text-gray-500"> in {p.parent.title}</span>}
                </td>
                <td className="font-mono text-xs">{p.slug === "home" ? "/" : `/${p.slug}`}</td>
                <td>{p.showInNav ? "Yes" : ""}</td>
                <td>{p.published ? "Published" : <span className="text-gray-500">Draft</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ActionForm action={createPageAction} submitLabel="New page" className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="new-title">Title</label>
          <input className="input" id="new-title" name="title" required placeholder="About us" />
        </div>
        <div>
          <label className="label" htmlFor="new-slug">Address (optional)</label>
          <input className="input font-mono" id="new-slug" name="slug" placeholder="about" />
        </div>
      </ActionForm>
    </div>
  );
}
