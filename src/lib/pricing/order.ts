import { D, Decimal, type DecimalLike, sum, toCents, ZERO } from "./money";
import type { FeeType, LineItemPrice } from "./line-item";

export interface TaxRateInput {
  name: string;
  /** 0.055 = 5.5% */
  rate: DecimalLike;
  taxShipping: boolean;
  taxArtworkFee: boolean;
  taxDigitizingFee: boolean;
  taxRushFee: boolean;
  taxScreenSetupFee: boolean;
  taxPaymentSurcharge: boolean;
}

export interface OrderInput {
  lines: LineItemPrice[];
  shipping?: DecimalLike;
  /** 0.15 = 15% of merchandise */
  rushFeePct?: DecimalLike;
  /** 0.03 = 3% of the pre-tax total, passed on for card processing */
  paymentSurchargePct?: DecimalLike;
  /** Rates that apply to the ship-to address; empty for tax-exempt customers. */
  taxRates?: TaxRateInput[];
}

export interface TaxLine {
  name: string;
  taxable: Decimal;
  amount: Decimal;
}

export interface OrderTotals {
  merchandise: Decimal;
  fees: Record<FeeType, Decimal>;
  rushFee: Decimal;
  shipping: Decimal;
  paymentSurcharge: Decimal;
  subtotal: Decimal;
  taxes: TaxLine[];
  tax: Decimal;
  total: Decimal;
}

const FEE_TYPES: FeeType[] = ["SCREEN_SETUP", "ARTWORK", "DIGITIZING", "PROOFING"];

export function priceOrder(input: OrderInput): OrderTotals {
  const merchandise = sum(input.lines.map((l) => l.merchandiseTotal));
  const fees = Object.fromEntries(
    FEE_TYPES.map((t) => [
      t,
      sum(input.lines.flatMap((l) => l.fees.filter((f) => f.type === t).map((f) => f.amount))),
    ]),
  ) as Record<FeeType, Decimal>;
  const rushFee = toCents(merchandise.times(input.rushFeePct ?? 0));
  const shipping = toCents(D(input.shipping ?? 0));
  const beforeSurcharge = merchandise.plus(sum(Object.values(fees))).plus(rushFee).plus(shipping);
  const paymentSurcharge = toCents(beforeSurcharge.times(input.paymentSurchargePct ?? 0));
  const subtotal = beforeSurcharge.plus(paymentSurcharge);

  const taxes: TaxLine[] = (input.taxRates ?? []).map((r) => {
    const taxable = merchandise
      .plus(r.taxScreenSetupFee ? fees.SCREEN_SETUP : ZERO)
      .plus(r.taxArtworkFee ? fees.ARTWORK : ZERO)
      .plus(r.taxDigitizingFee ? fees.DIGITIZING : ZERO)
      // Proofs are part of the decoration service; taxed with merchandise.
      .plus(fees.PROOFING)
      .plus(r.taxRushFee ? rushFee : ZERO)
      .plus(r.taxShipping ? shipping : ZERO)
      .plus(r.taxPaymentSurcharge ? paymentSurcharge : ZERO);
    return { name: r.name, taxable, amount: toCents(taxable.times(r.rate)) };
  });
  const tax = sum(taxes.map((t) => t.amount));

  return {
    merchandise,
    fees,
    rushFee,
    shipping,
    paymentSurcharge,
    subtotal,
    taxes,
    tax,
    total: subtotal.plus(tax),
  };
}
