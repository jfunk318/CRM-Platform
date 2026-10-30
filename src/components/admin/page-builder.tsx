"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_ITEMS,
  DEFAULT_SHOWCASE,
  ITEM_SORTS,
  type ItemsOptions,
  joinBlocks,
  type PageBlock,
  SHOWCASE_SORTS,
  type ShowcaseOptions,
  splitBlocks,
} from "@/lib/store/showcase";

type Keyed = PageBlock & { key: number };

const KIND_LABELS = { markdown: "Text", stores: "Store showcase", items: "Items" } as const;

/**
 * A page as blocks: text, store showcases and item grids, dragged (or moved
 * with the arrows) into order. Saves as the page's text (`body`), which can
 * also be edited directly.
 */
export function PageBuilder({ initial, groups }: { initial: string; groups: string[] }) {
  const next = useRef(0);
  const keyed = (b: PageBlock): Keyed => ({ ...b, key: next.current++ });
  const [blocks, setBlocks] = useState<Keyed[]>(() => splitBlocks(initial).map(keyed));
  const [source, setSource] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const body = source ?? joinBlocks(blocks);

  const update = (i: number, b: PageBlock) => setBlocks((bs) => bs.map((x, j) => (j === i ? { ...b, key: x.key } : x)));
  const move = (from: number, to: number) =>
    setBlocks((bs) => {
      if (to < 0 || to >= bs.length || from === to) return bs;
      const copy = [...bs];
      const [b] = copy.splice(from, 1);
      copy.splice(to, 0, b);
      return copy;
    });
  const add = (b: PageBlock) => setBlocks((bs) => [...bs, keyed(b)]);

  return (
    <div className="space-y-3" data-testid="page-builder">
      <input type="hidden" name="body" value={body} />
      <div className="flex items-center justify-between">
        <span className="label mb-0">Content</span>
        <button
          type="button"
          className="text-xs text-brand-700 hover:underline"
          onClick={() => {
            if (source === null) setSource(joinBlocks(blocks));
            else {
              setBlocks(splitBlocks(source).map(keyed));
              setSource(null);
            }
          }}
        >
          {source === null ? "Edit as text" : "Back to blocks"}
        </button>
      </div>

      {source !== null ? (
        <>
          <textarea className="input min-h-96 font-mono text-sm" aria-label="Page text" value={source} onChange={(e) => setSource(e.target.value)} />
          <p className="text-xs text-gray-500">
            Markdown, with widget lines like <code>[[stores sort=sales limit=6]]</code> and <code>[[items featured]]</code>.
          </p>
        </>
      ) : (
        <>
          {blocks.length === 0 && <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">An empty page. Add a block below.</p>}
          <ol className="space-y-2">
            {blocks.map((b, i) => (
              <li
                key={b.key}
                draggable
                onDragStart={(e) => {
                  setDragging(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragging === null) return;
                  e.preventDefault();
                  setOver(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging !== null) move(dragging, i);
                  setDragging(null);
                  setOver(null);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                className={`rounded-md border bg-white ${over === i && dragging !== i ? "border-brand-500 ring-2 ring-brand-200" : "border-gray-200"} ${dragging === i ? "opacity-50" : ""}`}
                data-testid="page-block"
              >
                <div className="flex items-center gap-2 border-b border-gray-100 px-2 py-1.5 text-xs">
                  <span className="cursor-grab select-none text-base text-gray-400" title="Drag to move" aria-hidden>⠿</span>
                  <span className="flex-1 font-medium text-gray-700">{KIND_LABELS[b.kind]}</span>
                  <button type="button" className="rounded px-1.5 py-0.5 hover:bg-gray-100 disabled:opacity-30" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up">↑</button>
                  <button type="button" className="rounded px-1.5 py-0.5 hover:bg-gray-100 disabled:opacity-30" onClick={() => move(i, i + 1)} disabled={i === blocks.length - 1} aria-label="Move down">↓</button>
                  <button type="button" className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50" onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))} aria-label="Remove block">✕</button>
                </div>
                <div className="p-2">
                  {b.kind === "markdown" && (
                    <>
                      <textarea
                        className="input min-h-28 font-mono text-sm"
                        aria-label="Text"
                        value={b.source}
                        onChange={(e) => update(i, { kind: "markdown", source: e.target.value })}
                      />
                      <p className="mt-1 text-[11px] text-gray-500">
                        <code># Heading</code> <code>**bold**</code> <code>- list</code> <code>[link](/shop)</code> <code>![picture](https://…)</code>
                      </p>
                    </>
                  )}
                  {b.kind === "stores" && <ShowcaseFields value={b.options} groups={groups} onChange={(options) => update(i, { kind: "stores", options })} />}
                  {b.kind === "items" && <ItemsFields value={b.options} onChange={(options) => update(i, { kind: "items", options })} />}
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => add({ kind: "markdown", source: "" })}>+ Text</button>
            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => add({ kind: "stores", options: DEFAULT_SHOWCASE })}>+ Store showcase</button>
            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => add({ kind: "items", options: DEFAULT_ITEMS })}>+ Items</button>
          </div>
        </>
      )}
    </div>
  );
}

function ShowcaseFields({ value, groups, onChange }: { value: ShowcaseOptions; groups: string[]; onChange: (v: ShowcaseOptions) => void }) {
  const set = (p: Partial<ShowcaseOptions>) => onChange({ ...value, ...p });
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-3">
      <Select label="Stores" value={value.group ?? ""} onChange={(v) => set({ group: v || null })} options={[["", "All groups"], ...groups.map((g) => [g, g] as [string, string])]} />
      <Select label="Order" value={value.sort} onChange={(v) => set({ sort: v as ShowcaseOptions["sort"] })} options={Object.entries(SHOWCASE_SORTS)} />
      <Num label="Show up to" value={value.limit} min={1} max={48} onChange={(limit) => set({ limit })} />
      <Select label="Layout" value={value.layout} onChange={(v) => set({ layout: v as ShowcaseOptions["layout"] })} options={[["grid", "Cards"], ["list", "List"]]} />
      {value.layout === "grid" && <Select label="Columns" value={String(value.columns)} onChange={(v) => set({ columns: Number(v) })} options={[1, 2, 3, 4, 5, 6].map((n) => [String(n), String(n)])} />}
      <div className="space-y-1 pt-1 sm:col-span-3">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.filters} onChange={(e) => set({ filters: e.target.checked })} /> Search box and group buttons for shoppers</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.includeClosed} onChange={(e) => set({ includeClosed: e.target.checked })} /> Include closed and upcoming stores</label>
      </div>
    </div>
  );
}

function ItemsFields({ value, onChange }: { value: ItemsOptions; onChange: (v: ItemsOptions) => void }) {
  const set = (p: Partial<ItemsOptions>) => onChange({ ...value, ...p });
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-3">
      <Select label="Order" value={value.sort} onChange={(v) => set({ sort: v as ItemsOptions["sort"] })} options={Object.entries(ITEM_SORTS)} />
      <Num label="Show up to" value={value.limit} min={1} max={48} onChange={(limit) => set({ limit })} />
      <Select label="Columns" value={String(value.columns)} onChange={(v) => set({ columns: Number(v) })} options={[1, 2, 3, 4, 5, 6].map((n) => [String(n), String(n)])} />
      <label className="flex items-center gap-2 sm:col-span-3"><input type="checkbox" checked={value.featuredOnly} onChange={(e) => set({ featuredOnly: e.target.checked })} /> Featured items only</label>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600">{label}</span>
      <input
        className="input"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </label>
  );
}
