"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const KEY = "store-visit";

/** Counts each page shown, and the first one of a browser session as a visit. Nothing about the shopper is sent. */
export function VisitBeacon() {
  const path = usePathname();
  useEffect(() => {
    let first = false;
    try {
      first = !sessionStorage.getItem(KEY);
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Storage blocked: count the view, not a visit.
    }
    const body = JSON.stringify({ first });
    if (!navigator.sendBeacon?.("/api/visit", new Blob([body], { type: "application/json" }))) {
      fetch("/api/visit", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  }, [path]);
  return null;
}
