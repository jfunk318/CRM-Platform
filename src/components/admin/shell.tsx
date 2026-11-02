import Link from "next/link";
import type { StaffRole } from "@prisma/client";
import { NAV } from "@/lib/admin/nav";
import { hasAnyRole } from "@/lib/auth/roles";
import type { StaffContext } from "@/lib/auth/session";
import { PLATFORM_NAME } from "@/lib/platform";
import { logout } from "@/app/admin/(auth)/login/actions";
import { LiveRequestBadge } from "./live-request-badge";
import { NavProvider, SideNav } from "./side-nav";
import { dueTaskCount } from "@/lib/crm/tasks";

/** Who can open the Web section (affiliate stores and the main site). */
export const canManageStores = (roles: StaffRole[]) => hasAnyRole(roles, ["STORE_MANAGER"]);

/**
 * The back office frame: the business's name, the left menu with its
 * sections (Sales, Production, Web; Admin and Reporting), who's signed in,
 * and the page.
 */
export async function AdminShell({ staff, children }: { staff: StaffContext; children: React.ReactNode }) {
  const stores = canManageStores(staff.roles);
  // New store owners' requests, flagged (and kept current) for store managers.
  const newRequests = stores ? await staff.db.storeRequest.count({ where: { status: "NEW" } }) : 0;
  const dueTasks = await dueTaskCount(staff.db, staff.id);
  return (
    <NavProvider>
      <div className="admin-ui min-h-screen bg-gray-100 md:flex">
        <aside className="flex flex-col bg-espresso text-gray-300 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto">
          <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
            <BrandMark />
            <span className="truncate text-[17px] font-bold tracking-tight text-white">{staff.business.name}</span>
          </div>
          <SideNav
            areaBadges={stores ? { web: <LiveRequestBadge initial={newRequests} /> } : undefined}
            items={NAV.filter((n) => hasAnyRole(staff.roles, n.roles)).map((n) => ({
              href: n.href,
              label: n.label,
              area: n.area,
              group: n.group,
              badge:
                n.requests && stores ? (
                  <LiveRequestBadge initial={newRequests} />
                ) : n.tasks && dueTasks > 0 ? (
                  <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-wheat px-1.5 text-[11px] font-semibold text-gray-900" title={`${dueTasks} task${dueTasks === 1 ? "" : "s"} due`} data-testid="task-badge">
                    {dueTasks}
                  </span>
                ) : undefined,
            }))}
          />
          <div className="mx-3 mb-3 rounded-lg bg-espresso-raised p-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white" aria-hidden="true">
                {initials(staff.name)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{staff.name}</div>
                <div className="truncate text-gray-400">{staff.email}</div>
              </div>
            </div>
            <div className="mt-2.5 flex gap-3">
              <Link href="/admin/account" className="text-gray-300 hover:text-white hover:underline">My account</Link>
              <form action={logout}>
                <button className="text-gray-300 hover:text-white hover:underline">Sign out</button>
              </form>
            </div>
          </div>
          <div className="px-5 pb-4 text-[11px] text-gray-500">Powered by {PLATFORM_NAME}</div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-9 md:py-8">{children}</main>
      </div>
    </NavProvider>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** The platform's mark: three overlapping inks (plum, moss, wheat), mixed like light on the dark menu and like ink on paper. */
export function BrandMark({ className = "", onLight = false }: { className?: string; onLight?: boolean }) {
  const mixBlendMode = onLight ? "multiply" : "screen";
  return (
    <svg viewBox="0 0 30 26" className={`h-[26px] w-[30px] shrink-0 ${className}`} aria-hidden="true" style={{ isolation: "isolate" }}>
      <circle cx="9" cy="9" r="9" fill="var(--brand-500)" style={{ mixBlendMode }} />
      <circle cx="21" cy="9" r="9" fill="var(--color-green-600, #3e6b35)" style={{ mixBlendMode }} />
      <circle cx="15" cy="17" r="9" fill="var(--wheat)" style={{ mixBlendMode }} />
    </svg>
  );
}
