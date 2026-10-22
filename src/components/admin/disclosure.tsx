"use client";

import { type ReactNode, useState } from "react";

/**
 * A <details> that starts open or closed but then stays the way the user left
 * it, so a re-render after a form submit doesn't snap it shut and hide the result.
 */
export function Disclosure({ initiallyOpen, className, children }: { initiallyOpen: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {children}
    </details>
  );
}
