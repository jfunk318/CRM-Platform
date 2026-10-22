import Decimal from "decimal.js";

export { Decimal };

export type DecimalLike = Decimal | number | string;

export const D = (v: DecimalLike): Decimal => new Decimal(v);

export const ZERO = new Decimal(0);

export type PriceRounding = "CENT" | "UP_TO_99";

/** Round a customer-facing unit price according to shop settings. */
export function roundPrice(value: Decimal, mode: PriceRounding = "CENT"): Decimal {
  const cents = value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (mode === "CENT") return cents;
  // UP_TO_99: 12.10 → 12.99, 12.99 → 12.99, 13.00 → 13.99. Zero stays zero.
  if (cents.isZero()) return cents;
  return cents.floor().plus("0.99");
}

/** Round a money amount (totals, fees, tax) to cents. */
export const toCents = (value: Decimal): Decimal =>
  value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const sum = (values: Decimal[]): Decimal =>
  values.reduce((acc, v) => acc.plus(v), ZERO);
