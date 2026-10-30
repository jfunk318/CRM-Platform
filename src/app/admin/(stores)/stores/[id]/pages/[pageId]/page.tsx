import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageBody } from "@/components/store/showcase";
import { PageBuilder } from "@/components/admin/page-builder";
import { loadAdminStore } from "@/lib/store/admin";
import { deletePageAction, savePageAction } from "../../../actions";

export default async function EditPage({ params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params;
  const { db, url } = await loadAdminStore(id);
  const page = await db.storePage.findUnique({ where: { id: pageId, storeId: id } });
  if (!page) notFound();
  const home = page.slug === "home";
  const groups = await db.storeGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true } });
  const parents = await db.storePage.findMany({ where: { storeId: page.storeId, parentId: null, id: { not: page.id }, slug: { not: "home" } }, orderBy: { title: "asc" } });
  return (
    <div className="space-y-5">
      <Link href={`/admin/stores/${id}/pages`} className="text-sm text-brand-700 hover:underline">← Pages</Link>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card">
          <ActionForm action={savePageAction} className="space-y-4">
            <input type="hidden" name="id" value={page.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="title">Title</label>
                <input className="input" id="title" name="title" defaultValue={page.title} required />
              </div>
              <div>
                <label className="label" htmlFor="slug">Address</label>
                <input className="input font-mono" id="slug" name="slug" defaultValue={home ? "/" : page.slug} disabled={home} required />
              </div>
            </div>
            <PageBuilder initial={page.body} groups={groups.map((g) => g.name)} />
            {!home && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="parentId">Inside (menu dropdown)</label>
                  <select className="input" id="parentId" name="parentId" defaultValue={page.parentId ?? ""}>
                    <option value="">Top level</option>
                    {parents.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="navOrder">Menu order</label>
                  <input className="input" id="navOrder" name="navOrder" defaultValue={page.navOrder} inputMode="numeric" />
                </div>
                <div className="space-y-1 pt-5 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="showInNav" defaultChecked={page.showInNav} /> Show in the menu</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={page.published} /> Published</label>
                </div>
              </div>
            )}
            <details>
              <summary className="cursor-pointer text-sm text-brand-700">Search engines</summary>
              <div className="mt-2 grid gap-3">
                <input className="input" name="seoTitle" defaultValue={page.seoTitle ?? ""} placeholder="Title in search results" aria-label="SEO title" />
                <input className="input" name="seoDescription" defaultValue={page.seoDescription ?? ""} placeholder="Description in search results" aria-label="SEO description" />
              </div>
            </details>
          </ActionForm>
          {!home && (
            <ActionForm action={deletePageAction} submitLabel="Delete page" danger confirm="Delete this page?" className="mt-4">
              <input type="hidden" name="id" value={page.id} />
            </ActionForm>
          )}
        </section>
        <section className="card">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">Preview (as saved)</span>
            <a href={home ? url : `${url}/${page.slug}`} target="_blank" className="text-brand-700 hover:underline">Open ↗</a>
          </div>
          <PageBody body={page.body} db={db} currentStoreId={id} />
        </section>
      </div>
    </div>
  );
}
