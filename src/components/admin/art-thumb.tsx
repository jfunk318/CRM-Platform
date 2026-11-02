import { isPicture, staffFileUrl } from "@/lib/design/artwork";

/** An artwork file's thumbnail: the picture itself, or a tile with its type (PDF, AI, EPS…) for files browsers can't show. */
export function ArtThumb({ fileId, name, alt = "" }: { fileId: string; name: string; alt?: string }) {
  if (!isPicture(name)) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-50 text-gray-600" aria-label={alt || undefined}>
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
        <span className="text-[11px] font-semibold uppercase">{name.split(".").pop()}</span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={staffFileUrl(fileId)} alt={alt} loading="lazy" className="h-full w-full object-contain" />;
}
