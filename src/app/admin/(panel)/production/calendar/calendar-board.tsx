"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveJob } from "../actions";

export type CalendarJob = {
  id: string;
  orderId: string;
  ref: string;
  customer: string;
  method: string;
  methodId: string;
  pieces: number;
  day: string | null; // "2026-10-26"
  due: string | null;
  late: boolean;
  rush: boolean;
  done: boolean;
  step: string | null; // next step, or null when done
  behind: boolean; // scheduled before this week and not done
};

export type CalendarDay = { key: string; label: string; isToday: boolean };
export type Capacity = { methodId: string; name: string; capacity: number | null };

/** A week of production days; drag a job to another day, or use its "Move to" menu. */
export function CalendarBoard({ days, jobs, capacities }: { days: CalendarDay[]; jobs: CalendarJob[]; capacities: Capacity[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // Moves show straight away and settle when the server answers.
  const [moved, setMoved] = useState<Record<string, string | null>>({});
  const dayOf = (j: CalendarJob) => (j.id in moved ? moved[j.id] : j.day);

  const move = (jobId: string, day: string | null) => {
    setMoved((m) => ({ ...m, [jobId]: day }));
    setError(null);
    startTransition(async () => {
      const r = await moveJob(jobId, day);
      if (r.error) {
        setError(r.error);
        setMoved((m) => {
          const next = { ...m };
          delete next[jobId];
          return next;
        });
      }
      router.refresh();
    });
  };

  const column = (key: string | null, title: React.ReactNode, sub?: React.ReactNode) => {
    // Unfinished jobs from before this week wait with the unscheduled ones.
    const list = jobs.filter((j) => dayOf(j) === key || (key === null && j.behind && dayOf(j) === j.day));
    const id = key ?? "none";
    return (
      <section
        key={id}
        data-testid={`day-${id}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(id);
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(null);
          const jobId = e.dataTransfer.getData("text/plain");
          if (jobId) move(jobId, key);
        }}
        className={`min-h-40 space-y-2 rounded-lg border p-2 ${over === id ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white"}`}
      >
        <div className="text-sm font-semibold">{title}</div>
        {sub}
        {list.map((j) => (
          <article
            key={j.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", j.id)}
            className={`cursor-grab rounded border p-2 text-xs shadow-sm active:cursor-grabbing ${j.done ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}
            data-testid="cal-job"
          >
            <div className="flex justify-between gap-1">
              <a href={`/admin/orders/${j.orderId}`} className="font-semibold text-brand-700 hover:underline">{j.ref}</a>
              <span className="font-semibold">{j.pieces} pcs</span>
            </div>
            <div>{j.method}</div>
            <div className="text-gray-600">{j.customer}</div>
            <div className={j.late ? "font-medium text-red-600" : "text-gray-500"}>
              {j.rush && <span className="mr-1 rounded bg-red-100 px-1 text-red-700">Rush</span>}
              Due {j.due ?? "—"}
            </div>
            <div className="text-gray-500">{j.done ? "✓ Done" : `Next: ${j.step}`}</div>
            {j.behind && <div className="font-medium text-red-600">Was due on the floor {j.day}</div>}
            <label className="mt-1 block">
              <span className="sr-only">Move {j.ref} {j.method} to</span>
              <select
                className="w-full rounded border border-gray-200 bg-white px-1 py-0.5"
                value={dayOf(j) ?? ""}
                onChange={(e) => move(j.id, e.target.value || null)}
                aria-label={`Move ${j.ref} ${j.method}`}
              >
                <option value="">Not scheduled</option>
                {days.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                {dayOf(j) && !days.some((d) => d.key === dayOf(j)) && <option value={dayOf(j)!}>{dayOf(j)}</option>}
              </select>
            </label>
          </article>
        ))}
      </section>
    );
  };

  return (
    <div className="space-y-3">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="status">{error}</p>}
      <div className={`grid gap-3 md:grid-cols-6 ${pending ? "opacity-80" : ""}`}>
        {column(null, "Not scheduled", <p className="text-xs text-gray-500">Drag jobs onto a day.</p>)}
        {days.map((d) => {
          const load = capacities
            .map((c) => ({ ...c, used: jobs.filter((j) => dayOf(j) === d.key && j.methodId === c.methodId).reduce((n, j) => n + j.pieces, 0) }))
            .filter((c) => c.used > 0);
          return column(
            d.key,
            <span className={d.isToday ? "text-brand-700" : ""}>{d.label}{d.isToday ? " · today" : ""}</span>,
            load.length > 0 && (
              <ul className="space-y-0.5 text-[11px]">
                {load.map((c) => (
                  <li key={c.methodId} className={c.capacity && c.used > c.capacity ? "font-medium text-red-600" : "text-gray-500"}>
                    {c.name}: {c.used}{c.capacity ? ` / ${c.capacity}` : ""} pcs
                  </li>
                ))}
              </ul>
            ),
          );
        })}
      </div>
    </div>
  );
}
