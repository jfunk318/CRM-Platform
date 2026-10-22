import { Prisma } from "@prisma/client";

/** Result returned by admin server actions and shown by <ActionForm>. */
export type ActionResult = { ok?: string; error?: string };

/** Thrown by the parse helpers; actions catch it and return its message. */
export class FormError extends Error {}

const str = (v: FormDataEntryValue | null | undefined) => (typeof v === "string" ? v.trim() : "");

export function text(form: FormData, name: string, label = name): string {
  const v = str(form.get(name));
  if (!v) throw new FormError(`${label} is required`);
  return v;
}

export function optionalText(form: FormData, name: string): string | null {
  return str(form.get(name)) || null;
}

export function checkbox(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

function parseNumber(raw: string, label: string): number {
  const n = Number(raw.replace(/[$,%\s]/g, ""));
  if (!Number.isFinite(n)) throw new FormError(`${label} must be a number`);
  if (n < 0) throw new FormError(`${label} can't be negative`);
  return n;
}

export function int(raw: string, label: string): number {
  const n = parseNumber(raw, label);
  if (!Number.isInteger(n)) throw new FormError(`${label} must be a whole number`);
  return n;
}

export function optionalInt(raw: string, label: string): number | null {
  return raw.trim() === "" ? null : int(raw, label);
}

/** Money or measurement, kept exact. */
export function decimal(raw: string, label: string): Prisma.Decimal {
  if (raw.trim() === "") throw new FormError(`${label} is required`);
  return new Prisma.Decimal(parseNumber(raw, label).toString());
}

export function optionalDecimal(raw: string, label: string): Prisma.Decimal | null {
  return raw.trim() === "" ? null : decimal(raw, label);
}

/** "40" or "40%" → 0.40 */
export function percent(raw: string, label: string): Prisma.Decimal {
  const n = parseNumber(raw, label);
  if (n > 100) throw new FormError(`${label} can't be over 100%`);
  return new Prisma.Decimal(n).dividedBy(100);
}

/** 0.4 → "40" for showing fractions as percentages in inputs. */
export const toPercentInput = (v: Prisma.Decimal | null | undefined) =>
  v == null ? "" : new Prisma.Decimal(v).times(100).toDecimalPlaces(4).toString();

/** Values of a repeated field (inputs sharing one name), aligned by position. */
export const all = (form: FormData, name: string) => form.getAll(name).map((v) => str(v));

/** Run an action body, turning validation errors into a friendly result. */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    return { ok: (await fn()) || "Saved" };
  } catch (e) {
    if (e instanceof FormError) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That would create a duplicate (a name or code is already in use)" };
    }
    throw e;
  }
}
