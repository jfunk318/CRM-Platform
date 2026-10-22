import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePlatformUser } from "@/lib/auth/platform-session";
import { businessDomain, getRequestHost } from "@/lib/business";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { PLATFORM_DOMAIN } from "@/lib/hosts";
import { ActionForm } from "@/components/admin/action-form";
import { updateBusiness } from "../../actions";

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformUser();
  const { id } = await params;
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      staff: { orderBy: { name: "asc" } },
      _count: { select: { products: true, customers: true, orders: true } },
    },
  });
  if (!business) notFound();

  // Where staff sign in. Locally, <slug>.localhost works in most browsers.
  const port = (await getRequestHost())?.match(/:(\d+)$/)?.[1];
  const adminUrl = PLATFORM_DOMAIN
    ? `https://${businessDomain(business)}/admin`
    : `http://${business.slug}.localhost${port ? `:${port}` : ""}/admin`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-amber-700 hover:underline">← Businesses</Link>
        <h1 className="page-title mt-1">{business.name}</h1>
        <p className="text-sm text-gray-600">
          Back office: <a href={adminUrl} className="font-mono text-amber-700 hover:underline">{adminUrl}</a>
        </p>
        <p className="text-sm text-gray-500">
          {business._count.products} products · {business._count.customers} customers · {business._count.orders} quotes &amp; orders
        </p>
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Settings</h2>
        <ActionForm action={updateBusiness}>
          <input type="hidden" name="id" value={business.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Business name</label>
              <input className="input" id="name" name="name" defaultValue={business.name} required />
            </div>
            <div>
              <label className="label" htmlFor="slug">Web address</label>
              <div className="flex items-center gap-1">
                <input className="input" id="slug" name="slug" defaultValue={business.slug} required />
                <span className="text-sm whitespace-nowrap text-gray-500">.{PLATFORM_DOMAIN ?? "localhost"}</span>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="customDomain">Their own domain</label>
              <input className="input" id="customDomain" name="customDomain" defaultValue={business.customDomain ?? ""} placeholder="none" />
            </div>
            <div>
              <label className="label" htmlFor="status">Status</label>
              <select className="input" id="status" name="status" defaultValue={business.status}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended (staff can&apos;t sign in)</option>
              </select>
            </div>
          </div>
        </ActionForm>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Staff</h2>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {business.staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.roles.map((r) => ROLE_LABELS[r]).join(", ")}</td>
                  <td>{s.active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
