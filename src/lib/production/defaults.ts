import type { DecorationKind } from "@prisma/client";

/** Steps a method's jobs get until the business sets its own. */
export const DEFAULT_WORKFLOW_STEPS: Record<DecorationKind, string[]> = {
  SCREEN_PRINT: ["Films & screens", "Press setup", "Print", "Cure", "Fold & pack"],
  EMBROIDERY: ["Digitize & sew-out", "Hoop", "Embroider", "Trim & finish", "Fold & pack"],
  DTF: ["Print transfers", "Press", "Fold & pack"],
  DIGITAL: ["Pretreat", "Print", "Cure", "Fold & pack"],
  VINYL: ["Cut & weed", "Press", "Fold & pack"],
  TRANSFER: ["Transfers in", "Press", "Fold & pack"],
  ENGRAVING: ["Set up", "Engrave", "Clean & pack"],
  OTHER: ["Produce", "Check", "Pack"],
};

/** Production runs Monday to Friday. */
export const isWorkday = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

/** Today's date (UTC midnight), the way date-only fields are stored. */
export const today = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export const nextWorkday = (d: Date) => {
  let x = d;
  while (!isWorkday(x)) x = addDays(x, 1);
  return x;
};

/** "2026-10-26" → Date at UTC midnight, or null. */
export function parseDay(raw: string | null | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
