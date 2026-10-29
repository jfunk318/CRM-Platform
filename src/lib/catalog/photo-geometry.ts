// Where the collar is on a model photo, measured from the pixels, so print
// areas land on the garment whatever the model's height (a youth shirt sits
// lower in the frame than an adult's). Garments are centered in the frame
// and fill about the same share of its width (adult or youth), so the
// collar line is the one thing that varies. Positions are fractions of the
// square frame the photo is shown in (contained, centered), like print
// areas. Pure: give it the frame's pixels.

type Pixels = { data: ArrayLike<number>; width: number; height: number; channels: number };

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The typical color around a point (median of a small block), to read heathers and textures. */
function sample(px: Pixels, cx: number, cy: number, r: number): number[] {
  const values: number[][] = [];
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const i = (y * px.width + x) * px.channels;
      values.push([px.data[i], px.data[i + 1], px.data[i + 2]]);
    }
  }
  return [0, 1, 2].map((c) => values.map((v) => v[c]).sort((a, b) => a - b)[Math.floor(values.length / 2)]);
}

/**
 * The collar line: sample the garment at mid-chest, then walk up the
 * center (a narrow band, past drawstrings and plackets) until it's no longer
 * the garment: the neck. Null if it doesn't read clearly.
 */
export function measureCollar(px: Pixels, o: { tolerance?: number } = {}): number | null {
  const S = px.width;
  const tol = o.tolerance ?? 40;
  const cx = Math.round(S / 2);
  const chestY = Math.round(S * 0.5);
  const garment = sample(px, cx, chestY, 3);
  const isGarment = (x: number, y: number) => dist(sample(px, x, y, 1), garment) < tol;
  let misses = 0;
  for (let y = chestY; y > S * 0.1; y--) {
    const hits = [-4, 0, 4].filter((dx) => isGarment(cx + dx, y)).length;
    misses = hits === 0 ? misses + 1 : 0;
    if (misses >= 3) {
      const collar = (y + 3) / S;
      // Collars sit in the top half, below the head.
      return collar >= 0.15 && collar <= 0.48 ? Math.round(collar * 1000) / 1000 : null;
    }
  }
  return null;
}

