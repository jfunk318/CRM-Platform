import { ProductImage } from "@/components/product-image";

/** A product photo at a fixed square size, or the style code when there's no photo. */
export function ProductThumb({ url, label, size = 40 }: { url?: string | null; label: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 align-middle"
      style={{ width: size, height: size }}
    >
      {url ? (
        <ProductImage src={url} alt="" width={size} height={size} className="h-full w-full object-contain" />
      ) : (
        <span className="px-0.5 text-center font-mono text-[9px] leading-tight text-gray-400">{label.slice(0, 8)}</span>
      )}
    </span>
  );
}
