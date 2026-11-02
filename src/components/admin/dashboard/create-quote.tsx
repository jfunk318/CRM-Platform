"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CustomerHit } from "@/app/admin/api/customers/search/route";
import { createQuoteAction } from "@/app/admin/(panel)/dashboard-actions";
import { ActionForm } from "../action-form";

/** The dashboard's "Create a quote": find the customer, name the job, go. */
export function CreateQuote() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [picked, setPicked] = useState<CustomerHit | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (picked) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/admin/api/customers/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then(setHits)
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, picked]);

  return (
    <ActionForm action={createQuoteAction} submitLabel="Create quote" className="space-y-3 text-sm">
      <div>
        <label className="label" htmlFor="cq-customer">Customer</label>
        {picked ? (
          <div className="flex items-center justify-between rounded-lg border border-brand-300 bg-brand-50 px-3 py-2">
            <span>
              <span className="font-medium">{picked.name}</span>
              {picked.company && <span className="text-gray-600"> · {picked.company}</span>}
            </span>
            <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => setPicked(null)}>Change</button>
            <input type="hidden" name="customerId" value={picked.id} />
          </div>
        ) : (
          <div className="relative">
            <input
              className="input"
              id="cq-customer"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              // Late enough for a click on a result to land first.
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Name, company, email or phone"
              autoComplete="off"
            />
            {focused && hits.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg" role="listbox">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" className="block w-full px-3 py-2 text-left hover:bg-gray-50" onClick={() => setPicked(h)} role="option" aria-selected="false">
                      <span className="font-medium">{h.name}</span>
                      {h.company && <span className="text-gray-600"> · {h.company}</span>}
                      {h.email && <span className="block text-xs text-gray-500">{h.email}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!picked && <p className="mt-1 text-xs text-gray-500">New customer? <Link href="/admin/customers#new-customer" className="text-brand-700 hover:underline">Add them first</Link>.</p>}
      </div>
      <div>
        <label className="label" htmlFor="cq-title">Job name</label>
        <input className="input" id="cq-title" name="title" placeholder="e.g. Tigers Football 2026" />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="forStore" /> For a webstore (no quantities needed)
      </label>
    </ActionForm>
  );
}
