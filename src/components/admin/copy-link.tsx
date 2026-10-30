"use client";

import { useState } from "react";

/** A link with a copy button, for sending customer links by text or chat. */
export function CopyLink({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <a href={url} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-brand-700 hover:underline">
        {url}
      </a>
      <button
        type="button"
        className="btn-secondary shrink-0 px-2 py-0.5 text-xs"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : label}
      </button>
    </span>
  );
}
