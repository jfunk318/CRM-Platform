"use client";

import { useRef, useState } from "react";
import { resetHomepageAction, saveHomepageAction, uploadHomeImageAction } from "@/app/admin/(stores)/stores/actions";
import { blankRow, blankSection, type FieldSpec, fieldsOf, type FieldValue, type Link, type Section, SECTION_KINDS, type SectionKind, SINGLE } from "@/lib/store/homepage";
import { ActionForm } from "./action-form";

/** Places a button can point to, offered as suggestions. */
const LINK_SUGGESTIONS = [
  ["/quote", "Request a quote"],
  ["/stores", "Team stores"],
  ["/shop", "Shop"],
  ["/catalog", "Catalog"],
  ["/design", "Design your own"],
  ["/#services", "Services"],
  ["/#about", "About"],
  ["/#contact", "Contact"],
  ["/track", "Track an order"],
];

/**
 * A store's homepage, as a list of sections: drag (or nudge) them
 * into order, switch them on and off, open one to edit its words, buttons
 * and photos, add more from the list below, then save. The preview beside
 * it reloads after each save.
 */
export function HomepageBuilder({ storeId, initial, url, custom, kinds, affiliate = false }: { storeId: string; initial: Section[]; url: string; custom: boolean; kinds: SectionKind[]; affiliate?: boolean }) {
  const [sections, setSections] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [mobile, setMobile] = useState(false);

  const change = (fn: (s: Section[]) => Section[]) => {
    setSections(fn);
    setDirty(true);
  };
  const update = (id: string, data: Record<string, FieldValue>) => change((l) => l.map((x) => (x.id === id ? { ...x, data } : x)));
  const move = (from: string, to: string) =>
    change((l) => {
      if (from === to) return l;
      const item = l.find((x) => x.id === from)!;
      const rest = l.filter((x) => x.id !== from);
      const at = rest.findIndex((x) => x.id === to);
      return [...rest.slice(0, at), item, ...rest.slice(at)];
    });
  const nudge = (id: string, by: -1 | 1) =>
    change((l) => {
      const i = l.findIndex((x) => x.id === id);
      const j = i + by;
      if (j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const add = (kind: SectionKind) => {
    const s = blankSection(kind);
    // Before the contact section, which usually ends the page.
    change((l) => {
      const at = l.findIndex((x) => x.kind === "contact");
      return at < 0 ? [...l, s] : [...l.slice(0, at), s, ...l.slice(at)];
    });
    setOpen(s.id);
  };
  const reload = () => setPreviewKey((k) => k + 1);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur" data-testid="homepage-savebar">
          <div className="text-sm">
            {dirty ? <span className="font-medium text-warn-800">Unsaved changes</span> : <span className="text-gray-500">{custom ? "Saved" : affiliate ? "A suggested homepage. Save to use it instead of the classic one." : "The starting homepage. Change anything and save to make it yours."}</span>}
          </div>
          <ActionForm
            action={saveHomepageAction}
            submitLabel="Save homepage"
            className="flex flex-row-reverse items-center gap-3"
            onSaved={() => {
              setDirty(false);
              reload();
            }}
          >
            <input type="hidden" name="storeId" value={storeId} />
            <input type="hidden" name="sections" value={JSON.stringify(sections)} />
          </ActionForm>
        </div>

        <ol className="space-y-2" data-testid="homepage-sections">
          {sections.map((s, i) => {
            const kind = SECTION_KINDS[s.kind];
            const isOpen = open === s.id;
            return (
              <li
                key={s.id}
                className={`rounded-xl border bg-white transition ${over === s.id && dragging !== s.id ? "border-brand-400 ring-2 ring-brand-200" : "border-gray-200"} ${dragging === s.id ? "opacity-50" : ""} ${s.on ? "" : "bg-gray-50"}`}
                data-testid={`section-${s.kind}`}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setOver(s.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) move(dragging, s.id);
                  setDragging(null);
                  setOver(null);
                }}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span
                    className="cursor-grab px-1 text-gray-400 select-none"
                    draggable
                    onDragStart={(e) => {
                      setDragging(s.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    title="Drag to reorder"
                    aria-hidden="true"
                  >
                    ⠿
                  </span>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                    <span className={`block font-medium ${s.on ? "" : "text-gray-500"}`}>{kind.label}</span>
                    <span className="block truncate text-xs text-gray-500">{summary(s) || kind.description}</span>
                  </button>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600" title={s.on ? "Shown on the homepage" : "Hidden"}>
                    <input type="checkbox" checked={s.on} onChange={(e) => change((l) => l.map((x) => (x.id === s.id ? { ...x, on: e.target.checked } : x)))} aria-label={`Show ${kind.label}`} />
                    Show
                  </label>
                  <span className="flex text-xs">
                    <button type="button" className="rounded px-1.5 py-1 hover:bg-gray-100 disabled:opacity-30" disabled={i === 0} onClick={() => nudge(s.id, -1)} aria-label={`Move ${kind.label} up`}>↑</button>
                    <button type="button" className="rounded px-1.5 py-1 hover:bg-gray-100 disabled:opacity-30" disabled={i === sections.length - 1} onClick={() => nudge(s.id, 1)} aria-label={`Move ${kind.label} down`}>↓</button>
                    <button
                      type="button"
                      className="rounded px-1.5 py-1 text-red-700 hover:bg-red-50"
                      onClick={() => window.confirm(`Remove the ${kind.label} section?`) && change((l) => l.filter((x) => x.id !== s.id))}
                      aria-label={`Remove ${kind.label}`}
                    >
                      ✕
                    </button>
                  </span>
                  <button type="button" className="rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50" onClick={() => setOpen(isOpen ? null : s.id)}>{isOpen ? "Close" : "Edit"}</button>
                </div>
                {isOpen && (
                  <div className="space-y-3 border-t border-gray-100 px-4 py-4" data-testid="section-editor">
                    <p className="text-xs text-gray-500">{kind.description}</p>
                    <Fields fields={fieldsOf(s.kind)} data={s.data} onChange={(data) => update(s.id, data)} storeId={storeId} prefix={s.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="rounded-xl border border-dashed border-gray-300 p-4" data-testid="section-palette">
          <h3 className="mb-2 text-sm font-semibold">Add a section</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {kinds.map((k) => {
              const taken = SINGLE.includes(k) && sections.some((x) => x.kind === k);
              return (
                <button key={k} type="button" disabled={taken} onClick={() => add(k)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-brand-400 disabled:opacity-40" title={taken ? "Already on the page" : undefined}>
                  <span className="block text-sm font-medium">+ {SECTION_KINDS[k].label}</span>
                  <span className="block text-xs text-gray-500">{SECTION_KINDS[k].description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {custom && (
          <ActionForm
            action={resetHomepageAction}
            submitLabel={affiliate ? "Go back to the classic homepage" : "Start over with the starting homepage"}
            danger
            confirm={affiliate ? "Go back to the classic homepage (banner and featured items)? These sections are lost." : "Replace your homepage with the starting one? Your sections are lost."} className="flex items-center gap-3" onSaved={() => window.location.reload()}>
            <input type="hidden" name="storeId" value={storeId} />
          </ActionForm>
        )}
      </div>

      <div className="space-y-2 xl:sticky xl:top-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold">Preview {dirty && <span className="font-normal text-gray-500">(save to see changes)</span>}</span>
          <span className="flex items-center gap-3">
            <span className="inline-flex overflow-hidden rounded-md border border-gray-200 text-xs" role="group" aria-label="Preview width">
              <button type="button" className={`px-2 py-1 ${!mobile ? "bg-brand-600 text-white" : ""}`} onClick={() => setMobile(false)}>Desktop</button>
              <button type="button" className={`px-2 py-1 ${mobile ? "bg-brand-600 text-white" : ""}`} onClick={() => setMobile(true)}>Phone</button>
            </span>
            <button type="button" className="text-brand-700 hover:underline" onClick={reload}>Reload</button>
            <a href={url} target="_blank" className="text-brand-700 hover:underline">Open ↗</a>
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          <iframe key={previewKey} src={url} title="Homepage preview" className={`mx-auto block h-[78vh] bg-white ${mobile ? "w-[390px]" : "w-full"}`} data-testid="homepage-preview" />
        </div>
      </div>
    </div>
  );
}

/** A line about what a section holds, for its collapsed row. */
function summary(s: Section): string {
  const d = s.data;
  const first = (["headline", "title"] as const).map((k) => d[k]).find((v) => typeof v === "string" && v);
  const list = Object.values(d).find(Array.isArray);
  const count = list ? ` · ${list.length} ${list.length === 1 ? "item" : "items"}` : "";
  return `${(first as string) ?? ""}${count}`.replace(/^ · /, "");
}

function Fields({ fields, data, onChange, storeId, prefix }: { fields: FieldSpec[]; data: Record<string, FieldValue>; onChange: (d: Record<string, FieldValue>) => void; storeId: string; prefix: string }) {
  const set = (key: string, v: FieldValue) => onChange({ ...data, [key]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={f.type === "textarea" || f.type === "list" || f.type === "link" || f.type === "image" ? "sm:col-span-2" : ""}>
          <Field spec={f} value={data[f.key]} onChange={(v) => set(f.key, v)} storeId={storeId} id={`${prefix}-${f.key}`} />
        </div>
      ))}
    </div>
  );
}

function Field({ spec, value, onChange, storeId, id }: { spec: FieldSpec; value: FieldValue | undefined; onChange: (v: FieldValue) => void; storeId: string; id: string }) {
  const hint = "hint" in spec && spec.hint ? <p className="mt-1 text-xs text-gray-500">{spec.hint}</p> : null;
  switch (spec.type) {
    case "text":
      return (
        <>
          <label className="label" htmlFor={id}>{spec.label}</label>
          <input className="input" id={id} value={typeof value === "string" ? value : ""} maxLength={spec.max} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value)} />
          {hint}
        </>
      );
    case "textarea":
      return (
        <>
          <label className="label" htmlFor={id}>{spec.label}</label>
          <textarea className="input" id={id} rows={spec.markdown ? 6 : 3} value={typeof value === "string" ? value : ""} maxLength={spec.max} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value)} />
          {spec.markdown && <p className="mt-1 text-xs text-gray-500">Markdown: **bold**, *italic*, [a link](/quote), - lists.</p>}
          {hint}
        </>
      );
    case "number":
      return (
        <>
          <label className="label" htmlFor={id}>{spec.label}</label>
          <input className="input w-28" id={id} type="number" min={spec.min} max={spec.max} value={typeof value === "number" ? value : spec.min} onChange={(e) => onChange(Number(e.target.value))} />
        </>
      );
    case "select":
      return (
        <>
          <label className="label" htmlFor={id}>{spec.label}</label>
          <select className="input" id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
            {Object.entries(spec.options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </>
      );
    case "toggle":
      return (
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {spec.label}
          {"hint" in spec && spec.hint && <span className="text-xs text-gray-500">({spec.hint})</span>}
        </label>
      );
    case "link": {
      const l = (value && typeof value === "object" && !Array.isArray(value) ? value : { label: "", href: "" }) as Link;
      return (
        <fieldset>
          <legend className="label">{spec.label}{"hint" in spec && spec.hint ? <span className="font-normal text-gray-400"> · {spec.hint}</span> : null}</legend>
          <div className="grid gap-2 sm:grid-cols-[1fr_1.3fr]">
            <input className="input" value={l.label} placeholder="Button text" aria-label={`${spec.label} text`} maxLength={40} onChange={(e) => onChange({ ...l, label: e.target.value })} />
            <input className="input" value={l.href} placeholder="/quote or https://…" aria-label={`${spec.label} link`} list="homepage-links" onChange={(e) => onChange({ ...l, href: e.target.value })} />
          </div>
          <datalist id="homepage-links">
            {LINK_SUGGESTIONS.map(([href, label]) => <option key={href} value={href}>{label}</option>)}
          </datalist>
        </fieldset>
      );
    }
    case "color": {
      const v = typeof value === "string" ? value : "";
      return (
        <>
          <span className="label">{spec.label}</span>
          <span className="flex items-center gap-2">
            <input type="color" className="h-9 w-12 cursor-pointer rounded border border-gray-300" value={v || "#888888"} onChange={(e) => onChange(e.target.value)} aria-label={spec.label} />
            {v ? <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => onChange("")}>Use the accent color</button> : <span className="text-xs text-gray-500">The store&apos;s accent color</span>}
          </span>
        </>
      );
    }
    case "image":
      return <ImageField label={spec.label} hint={hint} value={typeof value === "string" ? value : null} onChange={onChange} storeId={storeId} id={id} />;
    case "list": {
      const rows = Array.isArray(value) ? value : [];
      const setRow = (i: number, row: Record<string, FieldValue>) => onChange(rows.map((r, j) => (j === i ? row : r)));
      const blank = blankRow(spec.fields);
      return (
        <div className="space-y-2">
          <div className="label">{spec.label}</div>
          {rows.map((row, i) => (
            <div key={i} className="relative rounded-lg border border-gray-200 bg-gray-50/60 p-3 pr-20">
              <span className="absolute top-2 right-2 flex text-xs">
                <button type="button" className="rounded px-1.5 py-0.5 hover:bg-gray-200 disabled:opacity-30" disabled={i === 0} onClick={() => onChange(swap(rows, i, i - 1))} aria-label={`Move ${spec.item} up`}>↑</button>
                <button type="button" className="rounded px-1.5 py-0.5 hover:bg-gray-200 disabled:opacity-30" disabled={i === rows.length - 1} onClick={() => onChange(swap(rows, i, i + 1))} aria-label={`Move ${spec.item} down`}>↓</button>
                <button type="button" className="rounded px-1.5 py-0.5 text-red-700 hover:bg-red-50" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${spec.item}`}>✕</button>
              </span>
              <Fields fields={spec.fields} data={row} onChange={(r) => setRow(i, r)} storeId={storeId} prefix={`${id}-${i}`} />
            </div>
          ))}
          {rows.length < spec.max && (
            <button type="button" className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm hover:border-brand-400" onClick={() => onChange([...rows, blank])}>
              + Add {spec.item}
            </button>
          )}
        </div>
      );
    }
  }
}

const swap = <T,>(l: T[], i: number, j: number) => {
  const c = [...l];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
};

function ImageField({ label, hint, value, onChange, storeId, id }: { label: string; hint: React.ReactNode; value: string | null; onChange: (v: FieldValue) => void; storeId: string; id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("storeId", storeId);
    form.set("image", file);
    const res = await uploadHomeImageAction(form);
    setBusy(false);
    if (res.error) setError(res.error);
    else if (res.id) onChange(res.id);
    if (input.current) input.current.value = "";
  };
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/admin/files/${value}`} alt="" className="h-16 w-24 rounded border border-gray-200 object-cover" />
        ) : (
          <span className="grid h-16 w-24 place-items-center rounded border border-dashed border-gray-300 text-xs text-gray-400">No photo</span>
        )}
        <div className="space-y-1 text-sm">
          <input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="block text-xs" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {busy && <span className="text-xs text-gray-500">Uploading…</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
          {value && <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => onChange(null)}>Remove photo</button>}
        </div>
      </div>
      {hint}
    </div>
  );
}
