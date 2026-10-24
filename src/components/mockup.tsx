import { ProductImage } from "@/components/product-image";

/** Artwork drawn on a product photo; positions are fractions of the photo. */
export type MockupLayer = { src: string; left: number; top: number; width: number; rotation: number };

/**
 * A product photo with artwork laid over it. Purely presentational, so it
 * renders the same on staff pages, customer pages and inside the studio.
 */
export function Mockup({
  photoUrl,
  layers,
  label,
  outline,
  className,
  children,
}: {
  photoUrl: string | null;
  layers: MockupLayer[];
  label: string;
  /** A print area box to outline (fractions of the photo). */
  outline?: { x: number; y: number; w: number; h: number } | null;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-md bg-gray-100 ${className ?? ""}`} data-testid="mockup">
      {photoUrl ? (
        <ProductImage src={photoUrl} alt={label} width={900} height={900} sizes="(min-width: 768px) 480px, 100vw" className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">No product photo</span>
      )}
      {outline && (
        <div
          className="pointer-events-none absolute border border-dashed border-amber-500/80"
          style={{ left: `${outline.x * 100}%`, top: `${outline.y * 100}%`, width: `${outline.w * 100}%`, height: `${outline.h * 100}%` }}
        />
      )}
      {layers.map((l, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={l.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute h-auto select-none"
          style={{ left: `${l.left * 100}%`, top: `${l.top * 100}%`, width: `${l.width * 100}%`, transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined, transformOrigin: "center" }}
        />
      ))}
      {children}
    </div>
  );
}
