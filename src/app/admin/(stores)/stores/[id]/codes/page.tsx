import Link from "next/link";
import { loadAdminStore } from "@/lib/store/admin";
import { ActionButton } from "@/components/admin/action-button";
import { toggleStoreCodeAction } from "../../actions";

const money = (v: { toFixed(n: number): string }) => `$${v.toFixed(2)}`;
const KINDS = { PERCENT: "% off", AMOUNT: "$ off", FREE_SHIPPING: "Free delivery" } as const;

/** Which of the business's codes this store accepts, and how they've been used here. */
export default async function StoreCodes({ params }: { params: Promise<{ id: string }> }) {
  const { db, store } = await loadAdminStore((await params).id);
  const [promos, gifts, promoUse, giftUse] = await Promise.all([
    db.promoCode.findMany({ include: { stores: true }, orderBy: [{ active: "desc" }, { code: "asc" }] }),
    db.giftCode.findMany({ include: { stores: true }, orderBy: [{ active: "desc" }, { code: "asc" }] }),
    db.order.groupBy({ by: ["promoCodeId"], where: { storeId: store.id, promoCodeId: { not: null } }, _count: true, _sum: { discount: true } }),
    db.giftCodeUse.groupBy({ by: ["giftCodeId"], where: { order: { storeId: store.id } }, _count: true, _sum: { amount: true } }),
  ]);
  const row = (c: { id: string; allStores: boolean; stores: { storeId: string } [] }, kind: "promo" | "gift") => {
    const here = c.allStores || c.stores.some((s) => s.storeId === store.id);
    return c.allStores ? (
      <span className="text-gray-500">All stores</span>
    ) : (
      <ActionButton
        action={toggleStoreCodeAction}
        fields={{ storeId: store.id, codeId: c.id, kind, on: here ? "0" : "1" }}
        label={here ? "✓ Accepted here" : "Accept here"}
        className={`rounded border px-2 py-0.5 text-xs ${here ? "border-green-300 bg-green-50 text-green-800" : "border-gray-200 bg-white"}`}
      />
    );
  };
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Codes are created on the global <Link href="/admin/stores/promo-codes" className="text-amber-700 hover:underline">Promo codes</Link> and{" "}
        <Link href="/admin/stores/gift-codes" className="text-amber-700 hover:underline">Gift codes</Link> pages, for every store or chosen ones. Codes for chosen stores can be switched on here.
      </p>
      <section className="card overflow-x-auto p-0">
        <table className="table" data-testid="store-promos">
          <thead>
            <tr><th>Promo code</th><th>Gives</th><th>Here</th><th className="text-right">Used here</th><th className="text-right">Discounts given</th></tr>
          </thead>
          <tbody>
            {promos.length === 0 && <tr><td colSpan={5} className="text-gray-500">No promo codes yet.</td></tr>}
            {promos.map((p) => {
              const use = promoUse.find((u) => u.promoCodeId === p.id);
              return (
                <tr key={p.id} className={p.active ? "" : "text-gray-400"}>
                  <td className="font-mono">{p.code}{!p.active && " (inactive)"}</td>
                  <td>{p.kind === "PERCENT" ? `${p.value}% off` : p.kind === "AMOUNT" ? `${money(p.value)} off` : KINDS[p.kind]}</td>
                  <td>{row(p, "promo")}</td>
                  <td className="text-right">{use?._count ?? 0}</td>
                  <td className="text-right">{money(use?._sum.discount ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto p-0">
        <table className="table" data-testid="store-gifts">
          <thead>
            <tr><th>Gift code</th><th>Balance</th><th>Here</th><th className="text-right">Used here</th><th className="text-right">Spent here</th></tr>
          </thead>
          <tbody>
            {gifts.length === 0 && <tr><td colSpan={5} className="text-gray-500">No gift codes yet.</td></tr>}
            {gifts.map((g) => {
              const use = giftUse.find((u) => u.giftCodeId === g.id);
              return (
                <tr key={g.id} className={g.active ? "" : "text-gray-400"}>
                  <td className="font-mono">{g.code}{!g.active && " (inactive)"}</td>
                  <td>{money(g.balance)} of {money(g.initialAmount)}</td>
                  <td>{row(g, "gift")}</td>
                  <td className="text-right">{use?._count ?? 0}</td>
                  <td className="text-right">{money(use?._sum.amount ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
