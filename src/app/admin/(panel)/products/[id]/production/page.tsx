import { ActionForm } from "@/components/admin/action-form";
import { saveProductionSettings } from "../../actions";
import { loadProduct } from "../load";
import { Field, SectionFrame } from "../section";

export default async function ProductProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { product } = await loadProduct((await params).id);
  return (
    <SectionFrame
      title="Production"
      intro={<p>How long this product takes to produce. Leave blank to use each decoration method&apos;s lead time; set it for products that take longer (special blanks, finishing).</p>}
    >
      <ActionForm action={saveProductionSettings} className="max-w-sm space-y-4">
        <input type="hidden" name="id" value={product.id} />
        <Field label="Production lead days" name="productionLeadDays" value={product.productionLeadDays?.toString() ?? ""} placeholder="Method default" />
      </ActionForm>
    </SectionFrame>
  );
}
