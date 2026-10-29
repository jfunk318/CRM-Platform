"use client";

import { useEffect, useState } from "react";
import type { LinePreview } from "@/lib/orders/pricing";
import type { DecorationValue } from "./design-studio";

export type { LinePreview };

/** A line as the price preview takes it. */
export type PriceLine = {
  key: string;
  lineId?: string | null;
  productId: string;
  colorId: string;
  quantities: Record<string, number>;
  decorations: ReturnType<typeof decorationForPrice>[];
};

const n = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

/** A decoration's pricing facts, from the editor's values. */
export function decorationForPrice(d: Pick<DecorationValue, "methodId" | "location" | "colors" | "stitches" | "widthIn" | "heightIn" | "needsArtwork" | "needsDigitizing" | "reuseScreens">) {
  return {
    methodId: d.methodId,
    location: d.location,
    colors: n(d.colors),
    stitches: n(d.stitches),
    widthIn: n(d.widthIn),
    heightIn: n(d.heightIn),
    needsArtwork: d.needsArtwork,
    needsDigitizing: d.needsDigitizing,
    reuseScreens: d.reuseScreens,
  };
}

/** "12" → 12, blanks and junk dropped. */
export const quantitiesForPrice = (q: Record<string, string>) =>
  Object.fromEntries(Object.entries(q).flatMap(([k, v]) => (Number(v) > 0 ? [[k, Math.floor(Number(v))]] : [])));

/**
 * Prices for lines as they're being designed, refreshed a moment after
 * each change (older answers are dropped), keyed by each line's key.
 */
export function useLivePrices(orderId: string | null | undefined, lines: PriceLine[] | null): { prices: Map<string, LinePreview>; loading: boolean } {
  const [prices, setPrices] = useState<Map<string, LinePreview>>(new Map());
  const [loading, setLoading] = useState(false);
  const body = lines && lines.length ? JSON.stringify({ orderId: orderId ?? null, lines }) : null;
  useEffect(() => {
    if (!body) {
      setPrices(new Map());
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch("/admin/api/price-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((list: LinePreview[]) => {
          setPrices(new Map(list.map((p) => [p.key, p])));
          setLoading(false);
        })
        .catch(() => !ctrl.signal.aborted && setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [body]);
  return { prices, loading };
}

export const money = (v: string | number) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One line's price: each, total, the decoration's share, fees and problems. */
export function PriceSummary({ price, loading, focus, compact }: { price: LinePreview | undefined; loading?: boolean; focus?: string; compact?: boolean }) {
  if (!price) return <p className="text-xs text-gray-500" data-testid="live-price">{loading ? "Pricing…" : "Price shows once a method is chosen"}</p>;
  const mine = focus ? price.decorations.find((d) => d.location === focus) : null;
  const fees = focus ? price.fees.filter((f) => f.location === focus) : price.fees;
  const errors = price.issues.filter((i) => i.severity === "error");
  return (
    <div className={`space-y-0.5 ${loading ? "opacity-60" : ""}`} data-testid="live-price">
      <div className={compact ? "text-sm" : "text-base"}>
        <span className="font-semibold" data-testid="live-each">{money(price.each)}</span> <span className="text-gray-500">each</span>
        <span className="text-gray-400"> · </span>
        <span data-testid="live-total">{money(price.total)}</span> <span className="text-gray-500">for {price.qty}{price.assumedQty ? " (example)" : ""}</span>
      </div>
      {mine && (
        <div className="text-xs text-gray-600" data-testid="live-decoration">
          This decoration: {money(mine.unitPrice)} a piece{fees.length ? ` + ${fees.map((f) => `${f.description.toLowerCase()} ${money(f.amount)}`).join(", ")}` : ""}
        </div>
      )}
      {!focus && !compact && fees.length > 0 && <div className="text-xs text-gray-600">Setup: {fees.map((f) => `${f.location} ${f.description.toLowerCase()} ${money(f.amount)}`).join(" · ")}</div>}
      {price.assumedQty && !compact && <div className="text-[11px] text-gray-500">No quantities yet, so priced as {price.qty} pieces.</div>}
      {errors.length > 0 && <div className="text-xs text-red-700">{errors.map((e) => (e.location ? `${e.location}: ` : "") + e.message).join(" · ")}</div>}
    </div>
  );
}
