import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestStore } from "@/lib/store/resolve";
import { PLATFORM_NAME } from "@/lib/platform";

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The owner portal's frame: the store's branding without its shop. It opens
 * even while the store is closed or behind an access code.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const rs = await getRequestStore();
  if (!rs || rs.store.kind !== "AFFILIATE") notFound();
  const { store } = rs;
  const accent = store.accentColor && HEX.test(store.accentColor) ? store.accentColor : "#d97706";
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900" style={{ "--accent": accent } as React.CSSProperties}>
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/owner" className="flex items-center gap-2 text-xl font-bold">
            {store.logoFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/${store.logoFileId}`} alt={store.name} className="h-10 w-auto" />
            ) : (
              store.name
            )}
            <span className="text-sm font-normal text-gray-500">Store owner</span>
          </Link>
          <Link href="/" className="text-sm text-[var(--accent)] hover:underline">View the store →</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">Powered by {PLATFORM_NAME}</footer>
    </div>
  );
}
