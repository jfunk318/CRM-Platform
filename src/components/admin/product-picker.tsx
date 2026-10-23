"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ProductHit } from "@/app/admin/api/products/search/route";
import { ProductThumb } from "./product-thumb";

export type PickedProduct = { id: string; name: string; styleCode: string };

const label = (p: PickedProduct) => `${p.name} (${p.styleCode})`;

/**
 * Type a style code, name or brand and pick a product. Catalogs can hold
 * thousands of styles, so matches come from the server as you type.
 * Submits the product id under `name`.
 */
export function ProductPicker({
  id,
  name,
  selected,
  onChange,
  required,
  includeDiscontinued,
}: {
  id: string;
  name: string;
  selected: PickedProduct | null;
  onChange?: (p: PickedProduct) => void;
  required?: boolean;
  includeDiscontinued?: boolean;
}) {
  const [picked, setPicked] = useState(selected);
  const [text, setText] = useState(selected ? label(selected) : "");
  const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  // A parent may learn the product's name after mounting (e.g. once its options load).
  useEffect(() => {
    if (selected && selected.id === picked?.id && selected.name !== picked.name) {
      setPicked(selected);
      setText(label(selected));
    }
  }, [selected, picked]);

  const typed = picked ? (text === label(picked) ? "" : text) : text;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/admin/api/products/search?q=${encodeURIComponent(typed)}${includeDiscontinued ? "&all=1" : ""}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((h: ProductHit[]) => {
          if (cancelled) return;
          setHits(h);
          setActive(0);
        })
        .catch(() => !cancelled && setHits([]));
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [typed, open, includeDiscontinued]);

  useEffect(() => {
    input.current?.setCustomValidity(required && !(picked && text === label(picked)) ? "Choose a product from the list" : "");
  }, [required, picked, text]);

  const choose = (h: ProductHit) => {
    const p = { id: h.id, name: h.name, styleCode: h.styleCode };
    setPicked(p);
    setText(label(p));
    setOpen(false);
    onChange?.(p);
  };

  return (
    <div className="relative">
      <input type="hidden" name={name} value={picked && text === label(picked) ? picked.id : ""} />
      <input
        ref={input}
        className="input"
        id={id}
        value={text}
        placeholder="Type a style, name or brand…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          if (picked && text.trim() === "") setText(label(picked));
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || !hits?.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && hits && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {hits.length === 0 && <li className="px-3 py-1.5 text-gray-500">No products match.</li>}
          {hits.map((h, i) => (
            <li
              key={h.id}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-2 px-2 py-1 ${i === active ? "bg-amber-50" : ""}`}
              onMouseEnter={() => setActive(i)}
              // mousedown, not click: it lands before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(h);
              }}
            >
              <ProductThumb url={h.thumbnail} label={h.styleCode} size={36} />
              <span>
                <span className="font-mono text-xs text-gray-500">{h.styleCode}</span> {h.name}
                {h.brand && <span className="text-gray-500"> · {h.brand}</span>}
                {h.status !== "ACTIVE" && <span className="ml-1 text-xs text-gray-400">({h.status.toLowerCase().replace("_", " ")})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
