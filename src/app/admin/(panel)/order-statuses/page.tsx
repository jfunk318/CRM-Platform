import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { RowsEditor } from "@/components/admin/rows-editor";
import { rolesFor, STATUS_ROLES } from "@/lib/orders/status-roles";
import { saveStatuses } from "./actions";

export default async function OrderStatusesPage() {
  const { db } = await requireStaff(["ADMIN"]);
  const statuses = await db.orderStatus.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { orders: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Quote &amp; order statuses</h1>
        <p className="text-sm text-gray-500">
          The steps a quote or order moves through. Rename, reorder (top to bottom), recolor or add steps to match
          how your team works. Closed statuses drop out of the default &ldquo;open&rdquo; lists. &ldquo;Set
          automatically&rdquo; moves a quote or order to that status when the customer responds online or staff
          send it.
        </p>
      </div>
      {(["ORDER", "QUOTE"] as const).map((type) => (
        <section key={type} className="card space-y-2">
          <h2 className="font-semibold">{type === "QUOTE" ? "Quote" : "Order"} statuses</h2>
          <ActionForm action={saveStatuses}>
            <input type="hidden" name="type" value={type} />
            <RowsEditor
              addLabel="Add status"
              columns={[
                { name: "statusId", label: "", type: "hidden" },
                { name: "name", label: "Name" },
                { name: "color", label: "Color", placeholder: "#22C55E", width: "8rem" },
                { name: "isDefault", label: "Starting status", type: "checkbox" },
                { name: "isClosed", label: "Closed", type: "checkbox" },
                {
                  name: "role",
                  label: "Set automatically",
                  type: "select" as const,
                  options: [{ value: "", label: "—" }, ...rolesFor(type).map((r) => ({ value: r, label: STATUS_ROLES[r].label }))],
                },
              ]}
              initialRows={statuses
                .filter((s) => s.type === type)
                .map((s) => ({
                  statusId: s.id,
                  name: s.name,
                  color: s.color,
                  isDefault: s.isDefault,
                  isClosed: s.isClosed,
                  role: s.role ?? "",
                }))}
            />
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
