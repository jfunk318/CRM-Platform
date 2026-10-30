import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { CompanyPicker } from "@/components/admin/company-picker";
import { createCustomer } from "./actions";

const PAGE_SIZE = 50;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { db } = await requireStaff(["SALES"]);
  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const terms = q.trim().split(/\s+/).filter(Boolean);
  const where: Prisma.CustomerWhereInput = {
    AND: terms.map((t) => ({
      OR: [
        { firstName: { contains: t, mode: "insensitive" } },
        { lastName: { contains: t, mode: "insensitive" } },
        { email: { contains: t, mode: "insensitive" } },
        { phone: { contains: t } },
        { company: { name: { contains: t, mode: "insensitive" } } },
      ],
    })),
  };
  const [customers, total, companies] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: true, _count: { select: { orders: true } } },
    }),
    db.customer.count({ where }),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="page-title">Customers</h1>
      <form className="card flex items-end gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input className="input" id="q" name="q" defaultValue={q} placeholder="Name, email, phone or company" />
        </div>
        <button className="btn-secondary">Search</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Quotes &amp; orders</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-500">
                  {total === 0 && !q ? "No customers yet. Add the first one below." : "No matches."}
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                </td>
                <td>
                  {c.company ? (
                    <Link href={`/admin/companies/${c.company.id}`} className="hover:underline">{c.company.name}</Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td>{c.email}</td>
                <td>{c.phone}</td>
                <td>{c._count.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {pageNum > 1 && <Link className="btn-secondary" href={`?q=${encodeURIComponent(q)}&page=${pageNum - 1}`}>← Previous</Link>}
          <span>Page {pageNum} of {pages}</span>
          {pageNum < pages && <Link className="btn-secondary" href={`?q=${encodeURIComponent(q)}&page=${pageNum + 1}`}>Next →</Link>}
        </div>
      )}

      <div className="card">
        <h2 className="mb-2 font-semibold">Add a customer</h2>
        <ActionForm action={createCustomer} submitLabel="Add customer">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="nc-first">First name</label>
              <input className="input" id="nc-first" name="firstName" required />
            </div>
            <div>
              <label className="label" htmlFor="nc-last">Last name</label>
              <input className="input" id="nc-last" name="lastName" />
            </div>
            <div>
              <label className="label" htmlFor="nc-email">Email</label>
              <input className="input" id="nc-email" name="email" type="email" />
            </div>
            <div>
              <label className="label" htmlFor="nc-phone">Phone</label>
              <input className="input" id="nc-phone" name="phone" />
            </div>
          </div>
          <CompanyPicker companies={companies} />
        </ActionForm>
      </div>
    </div>
  );
}
