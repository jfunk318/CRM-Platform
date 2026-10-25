"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * New store requests, kept current while the page is open: checks every 30
 * seconds and refreshes the page's own flags when the count changes.
 */
export function LiveRequestBadge({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const last = useRef(initial);
  const router = useRouter();
  useEffect(() => {
    last.current = initial;
    setCount(initial);
  }, [initial]);
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/admin/api/store-requests", { cache: "no-store" });
        if (!r.ok) return;
        const { total } = (await r.json()) as { total: number };
        if (total !== last.current) {
          last.current = total;
          setCount(total);
          router.refresh();
        }
      } catch {
        // Offline for a moment; try again next time.
      }
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [router]);
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white" title={`${count} new store request${count === 1 ? "" : "s"}`} data-testid="request-badge">
      {count}
    </span>
  );
}
