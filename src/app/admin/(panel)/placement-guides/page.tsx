import { requireStaff } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { RowsEditor } from "@/components/admin/rows-editor";
import { guidesFrom } from "@/lib/design/guides";
import { resetGuidesAction, saveGuidesAction } from "./actions";

export const metadata = { title: "Placement guides" };

/** The standard artwork sizes per kind of location, used when placing art automatically. */
export default async function PlacementGuidesPage() {
  const { db } = await requireStaff(["ADMIN"]);
  const business = await db.business.findUniqueOrThrow({ where: { id: db.$businessId } });
  const guides = guidesFrom(business.placementGuides);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Placement guides</h1>
        <p className="max-w-3xl text-sm text-gray-500">
          How big artwork is made, and where it sits, when it&apos;s placed automatically: new artwork in the designer, and the same decoration
          put on many items at once. A guide applies to print areas whose name contains one of its words (the longest match wins, so
          &ldquo;full back&rdquo; beats &ldquo;back&rdquo;). Artwork is made as big as the guide and the product&apos;s print area both allow,
          keeping its shape, and centered across.
        </p>
      </div>
      <section className="card">
        <ActionForm action={saveGuidesAction}>
          <RowsEditor
            addLabel="Add guide"
            columns={[
              { name: "name", label: "Guide", placeholder: "Left chest" },
              { name: "keywords", label: "Area names containing (comma separated)", placeholder: "left chest, chest" },
              { name: "maxWidthIn", label: "Max width", suffix: "in", width: "6rem" },
              { name: "maxHeightIn", label: "Max height", suffix: "in", width: "6rem" },
              { name: "align", label: "Sits at", type: "select", options: [{ value: "top", label: "Top" }, { value: "center", label: "Middle" }, { value: "bottom", label: "Bottom" }] },
            ]}
            initialRows={guides.map((g) => ({ name: g.name, keywords: g.keywords.join(", "), maxWidthIn: String(g.maxWidthIn), maxHeightIn: String(g.maxHeightIn), align: g.align }))}
          />
        </ActionForm>
      </section>
      {business.placementGuides !== null && (
        <ActionForm action={resetGuidesAction} submitLabel="Go back to the standard guides" confirm="Replace your guides with the standard set?">
          <span />
        </ActionForm>
      )}
    </div>
  );
}
