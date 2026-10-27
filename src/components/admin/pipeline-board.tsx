"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveLeadAction } from "@/app/admin/(panel)/pipeline/actions";

export type BoardCard = {
  key: string;
  kind: "lead" | "quote";
  id: string;
  stage: string;
  title: string;
  who: string;
  value: number | null;
  owner: string | null;
  href: string;
  age: string;
  note: string | null;
};
export type BoardColumn = { stage: string; label: string; cards: BoardCard[]; total: number; leadDrop: boolean };

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const TONE: Record<string, string> = { WON: "border-t-green-500", LOST: "border-t-gray-400", NEW: "border-t-blue-500", CONTACTED: "border-t-amber-500", QUOTING: "border-t-purple-500", SENT: "border-t-sky-500" };

/**
 * The pipeline as columns. Lead cards can be dragged to New, Contacted or
 * Lost (asks why); quotes follow their quote's status.
 */
export function PipelineBoard({ columns }: { columns: BoardColumn[] }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const drop = (col: BoardColumn) => {
    const card = dragging;
    setDragging(null);
    setOver(null);
    if (!card || card.kind !== "lead" || !col.leadDrop || card.stage === col.stage) return;
    let reason: string | null = null;
    if (col.stage === "LOST") {
      reason = window.prompt(`Why was ${card.title} lost? (optional)`, "");
      if (reason === null) return;
    }
    start(async () => {
      const r = await moveLeadAction(card.id, col.stage as "NEW" | "CONTACTED" | "LOST", reason);
      setError(r.error ?? null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <div className={`grid gap-3 md:grid-cols-3 xl:grid-cols-6 ${pending ? "opacity-60" : ""}`} data-testid="pipeline">
        {columns.map((col) => {
          const canDrop = !!dragging && dragging.kind === "lead" && col.leadDrop && dragging.stage !== col.stage;
          return (
            <section
              key={col.stage}
              onDragOver={(e) => {
                if (!canDrop) return;
                e.preventDefault();
                setOver(col.stage);
              }}
              onDragLeave={() => setOver((o) => (o === col.stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                drop(col);
              }}
              className={`flex min-h-40 flex-col rounded-lg border border-t-4 bg-gray-50 ${TONE[col.stage] ?? ""} ${over === col.stage ? "ring-2 ring-amber-300" : canDrop ? "border-dashed border-amber-300" : "border-gray-200"}`}
              data-testid={`stage-${col.stage}`}
            >
              <header className="flex items-baseline justify-between px-2 py-2">
                <h2 className="text-sm font-semibold">
                  {col.label} <span className="font-normal text-gray-500">{col.cards.length}</span>
                </h2>
                <span className="text-xs text-gray-600">{col.total ? money(col.total) : ""}</span>
              </header>
              <ol className="flex-1 space-y-2 px-2 pb-2">
                {col.cards.map((c) => (
                  <li
                    key={c.key}
                    draggable={c.kind === "lead"}
                    onDragStart={(e) => {
                      setDragging(c);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={`rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm ${c.kind === "lead" ? "cursor-grab" : ""} ${dragging?.key === c.key ? "opacity-40" : ""}`}
                    data-testid="pipeline-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={c.href} className="line-clamp-2 font-medium text-amber-700 hover:underline" title={c.title}>{c.title}</Link>
                      {c.value !== null && <span className="shrink-0 text-xs font-medium">{money(c.value)}</span>}
                    </div>
                    {c.who && <div className="truncate text-xs text-gray-600">{c.who}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
                      <span className={`rounded px-1 ${c.kind === "lead" ? "bg-blue-50 text-blue-800" : "bg-gray-100"}`}>{c.kind === "lead" ? "Lead" : "Quote"}</span>
                      <span>{c.age}</span>
                      {c.owner && <span>{c.owner}</span>}
                    </div>
                    {c.note && <div className="mt-1 text-[11px] text-gray-600">{c.note}</div>}
                  </li>
                ))}
                {col.cards.length === 0 && <li className="py-4 text-center text-xs text-gray-400">{canDrop ? "Drop here" : "Nothing here"}</li>}
              </ol>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">Drag a lead to move it between New, Contacted and Lost. Quotes move with their status (send, approve, convert or decline the quote).</p>
    </div>
  );
}
