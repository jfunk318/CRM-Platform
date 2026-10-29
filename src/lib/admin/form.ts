import { Prisma } from "@prisma/client";
import { unstable_rethrow } from "next/navigation";

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
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { error: "That would create a duplicate (a name or code is already in use)" };
      // A link to a record that's still in use, or to one that doesn't exist (or belongs to another business).
      if (e.code === "P2003") return { error: "That's still used by other records (such as quotes or orders), or refers to something that doesn't exist" };
      if (e.code === "P2025") return { error: "That record no longer exists. Reload the page." };
      // A column or table the code expects isn't in the database yet.
      if (e.code === "P2021" || e.code === "P2022") return { error: OUT_OF_DATE };
    }
    if (e instanceof Prisma.PrismaClientValidationError && /Unknown (argument|field)/.test(e.message)) return { error: OUT_OF_DATE };
    // Redirects and other framework signals pass through.
    unstable_rethrow(e);
    // Anything else: say so on the form instead of failing silently; details go to the server log.
    console.error(e);
    return { error: "Something went wrong and this wasn't saved. Try again; if it keeps happening, the details are in the terminal running the app." };
  }
}

const OUT_OF_DATE = "This wasn't saved: the database is behind the app. Run `npx prisma migrate dev`, restart the app, and try again.";
