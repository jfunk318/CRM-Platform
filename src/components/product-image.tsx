import Image from "next/image";
import { canResize } from "@/lib/catalog/image-hosts";

/**
 * A product photo. Supplier photos are full-size (often 1200 px, 400 KB), so
 * they're resized to what's shown; other links are used as they are.
 */
export function ProductImage({ src, alt, width, height, sizes, className }: { src: string; alt: string; width: number; height: number; sizes?: string; className?: string }) {
  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} className={className} unoptimized={!canResize(src)} />;
}
