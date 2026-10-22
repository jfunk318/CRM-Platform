/** "Ladies Premium Cotton T-Shirt" → "ladies-premium-cotton-t-shirt" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Our SKU for a variant: STYLE-COLOR-SIZE, uppercase, e.g. "DM104L-HEATHER-NAVY-2XL". */
export function variantSku(styleCode: string, colorName: string, sizeCode: string): string {
  const part = (s: string) => slugify(s).toUpperCase();
  return [part(styleCode), part(colorName), part(sizeCode)].filter(Boolean).join("-");
}

/**
 * Compare submitted rows (with ids for existing records) against what's
 * stored, so a save can update, create and delete in place. Keeping ids
 * stable matters: variants and images hang off colors, sizes and views.
 */
export function diffRows<T extends { id: string | null }>(existingIds: string[], rows: T[]) {
  type Fields = Omit<T, "id">;
  const known = new Set(existingIds);
  const isKnown = (r: T): r is T & { id: string } => r.id !== null && known.has(r.id);
  const withoutId = (r: T): Fields => {
    const copy: Partial<T> = { ...r };
    delete copy.id;
    return copy as Fields;
  };
  const update = rows.filter(isKnown).map((r) => ({ ...withoutId(r), id: r.id }));
  const kept = new Set(update.map((r) => r.id));
  return {
    update,
    create: rows.filter((r) => !isKnown(r)).map(withoutId),
    deleteIds: existingIds.filter((id) => !kept.has(id)),
  };
}
