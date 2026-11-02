"use client";

import Link from "next/link";
import { useState } from "react";
import { chooseDashboardAction, deleteTemplateAction, saveMyDashboardAction, saveTemplateAction, setDefaultDashboardAction } from "@/app/admin/(panel)/dashboard-actions";
import type { DashboardSource } from "@/lib/dashboard/layouts";
import { DEFAULT_LAYOUTS, type LayoutItem, type Section, SECTIONS, type WidgetKey, type WidgetSize } from "@/lib/dashboard/widgets";
import { ActionForm } from "../action-form";

type WidgetInfo = { key: WidgetKey; title: string; description: string };
type Choice = { id: string; name: string; ownerId: string | null; isDefault: boolean };

const SPAN: Record<WidgetSize, string> = { full: "lg:col-span-6", half: "lg:col-span-3", third: "lg:col-span-2" };
const SIZE_LABEL: Record<WidgetSize, string> = { third: "⅓", half: "½", full: "Full" };

/**
 * The dashboard: widgets in a grid, in the chosen order and sizes. In edit
 * mode the real widgets are dragged into order, resized, removed or added
 * from the palette, then saved as your own dashboard or (admins) as a
 * template everyone can use, optionally everyone's default.
 */
export function DashboardBoard({
  section,
  title,
  name,
  layout: initial,
  rendered,
  widgets,
  source,
  choices,
  isAdmin,
  editing,
}: {
  section: Section;
  /** The heading; the Sales dashboard welcomes the person instead. */
  title?: string;
  name: string;
  layout: LayoutItem[];
  rendered: Partial<Record<WidgetKey, React.ReactNode>>;
  /** Every widget this person may use. */
  widgets: WidgetInfo[];
  source: DashboardSource;
  choices: Choice[];
  isAdmin: boolean;
  editing: boolean;
}) {
  const [layout, setLayout] = useState(initial);
  const [dragging, setDragging] = useState<WidgetKey | null>(null);
  const [over, setOver] = useState<WidgetKey | null>(null);
  const info = (k: WidgetKey) => widgets.find((w) => w.key === k)!;
  const unused = widgets.filter((w) => !layout.some((i) => i.key === w.key));
  const json = JSON.stringify(layout);
  const path = SECTIONS[section].path;
  // Every form here says which section's dashboard it's about.
  const sectionField = <input type="hidden" name="section" value={section} />;

  const move = (from: WidgetKey, to: WidgetKey) =>
    setLayout((l) => {
      if (from === to) return l;
      const item = l.find((i) => i.key === from)!;
      const rest = l.filter((i) => i.key !== from);
      const at = rest.findIndex((i) => i.key === to);
      return [...rest.slice(0, at), item, ...rest.slice(at)];
    });
  const nudge = (key: WidgetKey, by: -1 | 1) =>
    setLayout((l) => {
      const i = l.findIndex((x) => x.key === key);
      const j = i + by;
      if (j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const resize = (key: WidgetKey, size: WidgetSize) => setLayout((l) => l.map((i) => (i.key === key ? { ...i, size } : i)));
  const remove = (key: WidgetKey) => setLayout((l) => l.filter((i) => i.key !== key));
  const add = (w: WidgetInfo) => setLayout((l) => [...l, { key: w.key, size: w.key === "assigned-to-me" || w.key === "my-tasks" ? "full" : "half" }]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{title ?? `Welcome, ${name}`}</h1>
          {!editing && source.locked && <p className="mt-1 text-xs text-gray-500">Your dashboard ({source.name}) is set by an admin.</p>}
        </div>
        {!editing && !source.locked && (
          <div className="flex flex-wrap items-center gap-2">
            {choices.length > 0 && (
              <ActionForm action={chooseDashboardAction} submitLabel="Use" className="flex items-center gap-2">{sectionField}
                <label className="sr-only" htmlFor="db-choose">Dashboard</label>
                <select className="input w-auto" id="db-choose" name="layoutId" defaultValue={source.businessDefault ? "" : (source.id ?? "")}>
                  <option value="">The business default</option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>{c.ownerId ? "My dashboard" : c.name}{c.isDefault ? " (default)" : ""}</option>
                  ))}
                </select>
              </ActionForm>
            )}
            <Link href={`${path}?edit=1`} className="btn-secondary" data-testid="customize">Customize</Link>
          </div>
        )}
      </div>

      {editing && (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4" data-testid="dashboard-editor">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-900">Drag widgets to reorder them (or use the arrows), pick a size, remove what you don&apos;t need, and add more below.</p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setLayout(DEFAULT_LAYOUTS[section].filter((i) => widgets.some((w) => w.key === i.key)))}>Start over</button>
              <Link href={path} className="btn-secondary">Done</Link>
            </div>
          </div>
          {unused.length > 0 && (
            <div className="flex flex-wrap gap-2" data-testid="widget-palette">
              {unused.map((w) => (
                <button key={w.key} type="button" className="rounded-lg border border-dashed border-brand-300 bg-white px-3 py-1.5 text-left text-sm hover:border-brand-500" title={w.description} onClick={() => add(w)}>
                  + {w.title}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-start gap-6 border-t border-brand-200 pt-3">
            <ActionForm action={saveMyDashboardAction} submitLabel="Save as my dashboard" className="flex items-center gap-3">{sectionField}
              <input type="hidden" name="layout" value={json} />
            </ActionForm>
            {isAdmin && (
              <ActionForm action={saveTemplateAction} submitLabel="Save as template" className="flex flex-wrap items-center gap-3">{sectionField}
                <input type="hidden" name="layout" value={json} />
                <input className="input w-48" name="name" placeholder="Template name" aria-label="Template name" defaultValue={source.personal || !source.id ? "" : source.name} />
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="makeDefault" /> Everyone&apos;s default</label>
              </ActionForm>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-6" data-testid="dashboard">
        {layout.map((item) => {
          const content = rendered[item.key];
          if (!editing && (content === null || content === undefined)) return null;
          const w = info(item.key);
          return (
            <section
              key={item.key}
              className={`card min-w-0 space-y-3 ${SPAN[item.size]} ${editing ? "cursor-grab" : ""} ${editing && over === item.key && dragging !== item.key ? "ring-2 ring-brand-400" : ""} ${dragging === item.key ? "opacity-50" : ""}`}
              data-testid={`widget-${item.key}`}
              draggable={editing}
              onDragStart={(e) => {
                setDragging(item.key);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(item.key);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) move(dragging, item.key);
                setDragging(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold">
                  {editing && <span className="text-gray-400" aria-hidden="true">⠿</span>}
                  {w.title}
                </h2>
                {editing && (
                  <div className="flex items-center gap-1 text-xs">
                    <button type="button" className="rounded px-1.5 py-0.5 hover:bg-gray-100" aria-label={`Move ${w.title} earlier`} onClick={() => nudge(item.key, -1)}>↑</button>
                    <button type="button" className="rounded px-1.5 py-0.5 hover:bg-gray-100" aria-label={`Move ${w.title} later`} onClick={() => nudge(item.key, 1)}>↓</button>
                    <span className="mx-1 inline-flex overflow-hidden rounded-md border border-gray-200" role="group" aria-label="Width">
                      {(["third", "half", "full"] as const).map((s) => (
                        <button key={s} type="button" className={`px-2 py-0.5 ${item.size === s ? "bg-brand-600 text-white" : "hover:bg-gray-50"}`} aria-pressed={item.size === s} onClick={() => resize(item.key, s)}>
                          {SIZE_LABEL[s]}
                        </button>
                      ))}
                    </span>
                    <button type="button" className="rounded px-1.5 py-0.5 text-red-700 hover:bg-red-50" aria-label={`Remove ${w.title}`} onClick={() => remove(item.key)}>✕</button>
                  </div>
                )}
              </div>
              {content ?? <p className="text-sm text-gray-500">Nothing to show right now; it appears when there is.</p>}
            </section>
          );
        })}
        {layout.length === 0 && <p className="text-sm text-gray-500 lg:col-span-6">No widgets. Add some from the list above.</p>}
      </div>

      {editing && isAdmin && choices.some((c) => !c.ownerId) && (
        <section className="card space-y-2" data-testid="templates">
          <h2 className="font-semibold">Templates</h2>
          <p className="text-sm text-gray-600">Shared dashboards anyone can switch to. You can also set someone&apos;s dashboard (and lock it) under Admin → Staff &amp; permissions.</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {choices.filter((c) => !c.ownerId).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{c.name}{c.isDefault && <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800">Everyone&apos;s default</span>}</span>
                <span className="flex gap-3">
                  {!c.isDefault && (
                    <ActionForm action={setDefaultDashboardAction} submitLabel="Make default" className="flex items-center gap-2">{sectionField}
                      <input type="hidden" name="layoutId" value={c.id} />
                    </ActionForm>
                  )}
                  <ActionForm action={deleteTemplateAction} submitLabel="Delete" danger confirm={`Delete the "${c.name}" template? Anyone using it goes back to the default.`} className="flex items-center gap-2">{sectionField}
                    <input type="hidden" name="layoutId" value={c.id} />
                  </ActionForm>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
