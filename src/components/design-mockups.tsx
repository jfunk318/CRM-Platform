import { Mockup } from "@/components/mockup";
import type { DesignMockup } from "@/lib/design/mockups";

/**
 * A design's mockups, one per decorated view. `artBase` is where this viewer
 * may load artwork from (staff files, or a customer's link).
 */
export function DesignMockups({ mockups, artBase, className = "w-28" }: { mockups: DesignMockup[]; artBase: string; className?: string }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2" data-testid="design-mockups">
      {mockups.map((m) => (
        <figure key={m.viewId} className={className}>
          <Mockup
            photoUrl={m.photoUrl}
            label={m.viewName}
            className="border border-gray-200"
            layers={m.layers.map((l) => ({ src: `${artBase}${l.fileId}`, left: l.left, top: l.top, width: l.width, rotation: l.rotation }))}
          />
          <figcaption className="mt-0.5 text-center text-[11px] text-gray-500">{m.viewName}</figcaption>
        </figure>
      ))}
    </div>
  );
}
