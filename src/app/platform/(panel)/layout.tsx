import Link from "next/link";
import { requirePlatformUser } from "@/lib/auth/platform-session";
import { PLATFORM_NAME } from "@/lib/platform";
import { platformLogout } from "../(auth)/login/actions";

export const metadata = { title: `Platform · ${PLATFORM_NAME}` };

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformUser();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-3">
          <Link href="/platform" className="font-bold">
            {PLATFORM_NAME} <span className="text-amber-400">Platform</span>
          </Link>
          <nav className="flex gap-4 text-sm text-gray-300">
            <Link href="/platform" className="hover:text-white">Businesses</Link>
            <Link href="/platform/businesses/new" className="hover:text-white">Add business</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
            {user.email}
            <form action={platformLogout}>
              <button className="text-amber-400 hover:underline">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
