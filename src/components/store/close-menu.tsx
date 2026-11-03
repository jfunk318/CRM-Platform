"use client";

import { useEffect } from "react";

/** Closes the phone menu (a <details>) after a link in it is tapped, including #section links on the same page. */
export function CloseMenuOnNavigate({ id }: { id: string }) {
  useEffect(() => {
    const menu = document.getElementById(id) as HTMLDetailsElement | null;
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) menu?.removeAttribute("open");
    };
    menu?.addEventListener("click", close);
    return () => menu?.removeEventListener("click", close);
  }, [id]);
  return null;
}
