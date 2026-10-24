import { Prisma, type PersonalizationMode } from "@prisma/client";

/** A store item's name/number options. */
export type PersonalizationOptions = {
  nameMode: PersonalizationMode;
  nameMaxLength: number;
  namePrice: Prisma.Decimal;
  numberMode: PersonalizationMode;
  numberMaxDigits: number;
  numberPrice: Prisma.Decimal;
};

export class PersonalizationError extends Error {}

export const offersPersonalization = (o: Pick<PersonalizationOptions, "nameMode" | "numberMode">) => o.nameMode !== "OFF" || o.numberMode !== "OFF";

// Letters (any language), spaces and the punctuation names use.
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

/**
 * Check what a shopper typed against the item's options. Returns the cleaned
 * name (spaces tidied) and number, and what they add to each piece's price.
 */
export function checkPersonalization(o: PersonalizationOptions, raw: { name?: string | null; number?: string | null }) {
  const name = o.nameMode === "OFF" ? "" : (raw.name ?? "").trim().replace(/\s+/g, " ");
  const number = o.numberMode === "OFF" ? "" : (raw.number ?? "").trim();
  if (o.nameMode === "REQUIRED" && !name) throw new PersonalizationError("Enter the name to print");
  if (o.numberMode === "REQUIRED" && !number) throw new PersonalizationError("Enter the number to print");
  if (name && !NAME.test(name)) throw new PersonalizationError("Names can use letters, spaces, hyphens, periods and apostrophes");
  if ([...name].length > o.nameMaxLength) throw new PersonalizationError(`Names can be up to ${o.nameMaxLength} characters`);
  if (number && !/^\d+$/.test(number)) throw new PersonalizationError("Numbers can only use digits");
  if (number.length > o.numberMaxDigits) throw new PersonalizationError(`Numbers can be up to ${o.numberMaxDigits} digit${o.numberMaxDigits === 1 ? "" : "s"}`);
  const charge = (name ? o.namePrice : new Prisma.Decimal(0)).plus(number ? o.numberPrice : 0);
  return { name, number, charge };
}

/** How a name/number reads on a cart line or roster: `SMITH #12`. */
export const personalizationLabel = (p: { name: string; number: string }) => [p.name, p.number && `#${p.number}`].filter(Boolean).join(" ");

/**
 * A roster typed by staff, one piece per line: size, name, number
 * ("L, Smith, 12" or "L Smith 12"; the number may be left off). Sizes are
 * matched by code; quantities of the same entry add up.
 */
export function parseRoster(text: string, sizeCodes: string[]): { sizeCode: string; name: string; number: string; qty: number }[] {
  const out: { sizeCode: string; name: string; number: string; qty: number }[] = [];
  const codes = new Map(sizeCodes.map((c) => [c.toUpperCase(), c]));
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.includes(",") || line.includes("\t") ? line.split(/[,\t]/).map((p) => p.trim()) : line.split(/\s+/);
    const size = codes.get((parts.shift() ?? "").toUpperCase());
    if (!size) throw new PersonalizationError(`Roster line ${i + 1}: start with a size (${sizeCodes.join(", ")})`);
    let number = "";
    if (parts.length && /^\d+$/.test(parts[parts.length - 1])) number = parts.pop()!;
    const name = parts.join(" ").replace(/\s+/g, " ").trim();
    if (!name && !number) throw new PersonalizationError(`Roster line ${i + 1}: add a name or number`);
    if (number.length > 3) throw new PersonalizationError(`Roster line ${i + 1}: numbers can be up to 3 digits`);
    const same = out.find((e) => e.sizeCode === size && e.name === name && e.number === number);
    if (same) same.qty++;
    else out.push({ sizeCode: size, name, number, qty: 1 });
  });
  return out;
}

/** A roster as staff type it, for the editor. */
export const rosterText = (entries: { sizeCode: string; name: string; number: string; qty: number }[]) =>
  entries.flatMap((e) => Array.from({ length: e.qty }, () => [e.sizeCode, e.name, e.number].filter(Boolean).join(", "))).join("\n");
