import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePlatformUser } from "@/lib/auth/platform-session";
import { businessDomain } from "@/lib/business";

export default async function BusinessesPage() {
  await requirePlatformUser();
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { staff: true, products: true, customers: true, orders: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Businesses</h1>
        <Link href="/platform/businesses/new" className="btn">Add business</Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Address</th>
              <th>Status</th>
              <th className="text-right">Staff</th>
              <th className="text-right">Products</th>
              <th className="text-right">Customers</th>
              <th className="text-right">Quotes &amp; orders</th>
            </tr>
          </thead>
          <tbody>
            {businesses.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500">No businesses yet.</td>
              </tr>
            )}
            {businesses.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/platform/businesses/${b.id}`} className="font-medium text-brand-700 hover:underline">{b.name}</Link>
                </td>
                <td className="font-mono text-xs">{businessDomain(b)}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${b.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                    {b.status === "ACTIVE" ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="text-right">{b._count.staff}</td>
                <td className="text-right">{b._count.products}</td>
                <td className="text-right">{b._count.customers}</td>
                <td className="text-right">{b._count.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
