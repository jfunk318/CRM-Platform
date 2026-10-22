import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { Markdown } from "@/components/store/markdown";
import { deletePageAction, savePageAction } from "../../actions";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireStaff(["SALES"]);
  const { id } = await params;
  const page = await db.storePage.findUnique({ where: { id } });
  if (!page) notFound();
  const home = page.slug === "home";
  const parents = await db.storePage.findMany({ where: { storeId: page.storeId, parentId: null, id: { not: page.id }, slug: { not: "home" } }, orderBy: { title: "asc" } });
  return (
    <div className="space-y-5">
      <Link href="/admin/storefront/pages" className="text-sm text-amber-700 hover:underline">← Pages</Link>
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
            <div>
              <label className="label" htmlFor="body">Content</label>
              <textarea className="input min-h-96 font-mono text-sm" id="body" name="body" defaultValue={page.body} />
              <p className="mt-1 text-xs text-gray-500">
                Markdown: <code># Heading</code>, <code>**bold**</code>, <code>*italic*</code>, <code>- list</code>, <code>[link](/catalog)</code>, <code>![picture](https://…)</code>, <code>&gt; quote</code>, <code>---</code>.
              </p>
            </div>
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
              <summary className="cursor-pointer text-sm text-amber-700">Search engines</summary>
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
            <a href={home ? "/" : `/${page.slug}`} target="_blank" className="text-amber-700 hover:underline">Open ↗</a>
          </div>
          <Markdown source={page.body} />
        </section>
      </div>
    </div>
  );
}
