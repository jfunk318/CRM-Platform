import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { isImage } from "@/lib/files/types";
import { orderRef } from "@/lib/orders/numbers";
import { jobLinesInclude, methodWork } from "@/lib/production/jobs";
import { enhanceLabel } from "@/lib/design/artwork";
import { Roster } from "@/components/roster";

export const metadata = { title: "Work order" };

const day = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The sheet that goes with the job on the floor: what to decorate, where, how many, with the approved art. */
export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, business } = await requireStaff();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      ...jobLinesInclude,
      customer: true,
      company: true,
      deliveryMethod: true,
      productionJobs: { include: { method: true, steps: { orderBy: { sortOrder: "asc" } }, assignedTo: true } },
      proofs: { where: { status: "APPROVED" }, orderBy: { number: "desc" }, take: 1, include: { files: { where: { fromCustomer: false }, include: { file: true } } } },
      files: { where: { kind: { in: ["MOCKUP", "PRODUCTION"] } }, include: { file: true } },
    },
  });
  if (!order || order.type !== "ORDER") notFound();
  const methods = await db.decorationMethod.findMany({ where: { id: { in: order.lines.flatMap((l) => l.design.decorations.map((d) => d.methodId)) } } });
  const art = (order.proofs[0]?.files.map((f) => f.file) ?? order.files.map((f) => f.file)).filter((f) => isImage(f.name));
  const totalPieces = order.lines.reduce((n, l) => n + l.sizes.reduce((m, s) => m + s.qty, 0), 0);

  return (
    <article className="space-y-5 text-sm">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-600">{business.name} · Work order</div>
          <h1 className="text-3xl font-bold">Order {orderRef(order)}</h1>
          <div className="text-base">
            {order.customer.firstName} {order.customer.lastName}
            {order.company ? ` · ${order.company.name}` : ""}
            {order.title ? ` · ${order.title}` : ""}
          </div>
        </div>
        <div className="text-right">
          {order.rush && <div className="mb-1 inline-block rounded bg-black px-2 py-0.5 font-bold text-white">RUSH</div>}
          <div className="text-base font-semibold">Due {order.dueDate ? day(order.dueDate) : "—"}</div>
          <div>{totalPieces} pieces</div>
          <div>{order.deliveryMethod?.name ?? "Delivery not set"}</div>
        </div>
      </header>

      {art.length > 0 && (
        <section className="grid grid-cols-2 gap-3">
          {art.map((f) => (
            <figure key={f.id} className="break-inside-avoid border border-gray-300 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/admin/files/${f.id}`} alt={f.name} className="mx-auto max-h-64 w-auto" />
              <figcaption className="mt-1 text-center text-xs text-gray-600">
                {order.proofs[0] ? `Approved proof ${order.proofs[0].number}` : "Mockup"} · {f.name}
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      {methods.map((m) => {
        const work = methodWork(order.lines, m.id);
        const job = order.productionJobs.find((j) => j.methodId === m.id);
        return (
          <section key={m.id} className="break-inside-avoid border border-gray-400">
            <div className="flex items-center justify-between bg-gray-100 px-3 py-1.5">
              <h2 className="text-base font-bold">{m.name}</h2>
              <div>
                {work.pieces} pcs{job?.scheduledFor ? ` · on ${day(job.scheduledFor)}` : ""}
                {job?.assignedTo ? ` · ${job.assignedTo.name}` : ""}
              </div>
            </div>
            <div className="space-y-3 p-3">
              {work.items.map(({ line, decorations, pieces }) => (
                <div key={line.id} className="space-y-1">
                  <div className="font-semibold">
                    {line.design.product.styleCode} {line.design.product.name} · {line.design.color.name} · {pieces} pcs
                  </div>
                  <table className="border-collapse">
                    <tbody>
                      <tr>
                        {line.sizes.map((s) => <th key={s.id} className="border border-gray-300 px-2 py-0.5 text-xs font-medium">{s.size.code}</th>)}
                      </tr>
                      <tr>
                        {line.sizes.map((s) => <td key={s.id} className="border border-gray-300 px-2 py-0.5 text-center text-base font-semibold">{s.qty}</td>)}
                      </tr>
                    </tbody>
                  </table>
                  <ul className="list-disc pl-5">
                    {decorations.map((d) => (
                      <li key={d.id}>
                        <span className="font-medium">{d.location}</span>
                        {d.colors ? ` · ${d.colors} color${d.colors === 1 ? "" : "s"}` : ""}
                        {d.inkColors.length ? ` (${d.inkColors.join(", ")})` : ""}
                        {d.stitches ? ` · ${d.stitches.toLocaleString()} stitches` : ""}
                        {d.widthIn && d.heightIn ? ` · ${d.widthIn.toString()}″ × ${d.heightIn.toString()}″` : ""}
                        {d.reuseScreens ? " · reuse screens" : ""}
                        {enhanceLabel(d.artEdits) ? ` · artwork ${enhanceLabel(d.artEdits)}` : ""}
                        {d.notes ? ` · ${d.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                  <Roster names={line.names} />
                  {line.notes && <p className="text-gray-700">Note: {line.notes}</p>}
                </div>
              ))}
              {job && (
                <ol className="flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-200 pt-2">
                  {job.steps.map((s) => (
                    <li key={s.id} className="flex items-center gap-1.5">
                      <span className="inline-block h-4 w-4 border border-black text-center text-[11px] leading-4">{s.doneAt ? "✓" : ""}</span>
                      {s.name}
                    </li>
                  ))}
                </ol>
              )}
              {job?.notes && <p className="font-medium">Floor note: {job.notes}</p>}
            </div>
          </section>
        );
      })}
    </article>
  );
}
