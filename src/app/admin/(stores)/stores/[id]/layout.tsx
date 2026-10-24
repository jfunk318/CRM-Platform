import Link from "next/link";
import { loadAdminStore } from "@/lib/store/admin";

const STATE_CLASS = { open: "bg-green-50 text-green-800", scheduled: "bg-blue-50 text-blue-800", closed: "bg-gray-100 text-gray-600" } as const;

/** One store's dashboard: header and tabs. */
export default async function StoreDashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store, status, url } = await loadAdminStore(id);
  const main = store.kind === "ROOT";
  const tabs = [
    { href: `/admin/stores/${id}`, label: "Overview" },
    { href: `/admin/stores/${id}/items`, label: "Items" },
    { href: `/admin/stores/${id}/pages`, label: "Pages" },
    { href: `/admin/stores/${id}/codes`, label: "Codes" },
    ...(main ? [] : [{ href: `/admin/stores/${id}/commission`, label: "Commission" }]),
    { href: `/admin/stores/${id}/settings`, label: "Settings" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={main ? "/admin/stores" : "/admin/stores"} className="text-sm text-amber-700 hover:underline">← All stores</Link>
          <h1 className="page-title mt-1 flex flex-wrap items-center gap-2">
            {store.name}
            {main ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Main site</span>
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_CLASS[status.state]}`} data-testid="store-status">{status.label}</span>
            )}
            {store.group && <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-normal text-gray-600">{store.group.name}</span>}
          </h1>
          <a href={url} target="_blank" className="font-mono text-sm text-amber-700 hover:underline" data-testid="store-url">{url.replace(/^https?:\/\//, "")} ↗</a>
        </div>
      </div>
      <nav className="flex gap-1 border-b border-gray-200 text-sm" aria-label="Store">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-t-md px-3 py-2 hover:bg-amber-50">{t.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
