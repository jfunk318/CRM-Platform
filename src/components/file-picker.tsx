"use client";

import { useEffect, useRef, useState } from "react";

const size = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

/**
 * A file input that looks like one: a "Choose file" button in a drop area,
 * listing what's been picked. The real <input type="file"> stays in the form
 * (visually hidden), so labels, `required` and form submission work as usual.
 */
export function FilePicker({
  id,
  name,
  multiple,
  accept,
  required,
  maxMb,
  hint,
}: {
  id: string;
  name: string;
  multiple?: boolean;
  accept?: string;
  required?: boolean;
  /** Warn before upload when a file is over this size. */
  maxMb?: number;
  /** Shown under the button, e.g. "PNG, JPG or PDF". */
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);

  // Clear the list when the form is reset (e.g. after a successful upload).
  useEffect(() => {
    const form = input.current?.form;
    const clear = () => setFiles([]);
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  const use = (list: File[]) => {
    const picked = multiple ? list : list.slice(0, 1);
    const dt = new DataTransfer();
    picked.forEach((f) => dt.items.add(f));
    if (input.current) input.current.files = dt.files;
    setFiles(picked);
  };
  const tooBig = maxMb ? files.filter((f) => f.size > maxMb * 1_000_000) : [];

  return (
    <div
      className={`rounded-md border-2 border-dashed px-3 py-3 transition ${over ? "border-amber-500 bg-amber-50" : "border-gray-300 bg-gray-50"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        use([...(multiple ? files : []), ...Array.from(e.dataTransfer.files)]);
      }}
      data-testid="file-picker"
    >
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        multiple={multiple}
        accept={accept}
        required={required}
        className="sr-only"
        // Picking again adds to the list (for multiple files) instead of replacing it.
        onChange={(e) => use([...(multiple ? files : []), ...Array.from(e.target.files ?? [])])}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" className="btn-secondary" onClick={() => input.current?.click()}>
          <span aria-hidden>📎</span> {files.length ? (multiple ? "Add more files" : "Change file") : multiple ? "Choose files" : "Choose file"}
        </button>
        <span className="text-xs text-gray-500">
          or drag {multiple ? "them" : "it"} here{hint ? ` · ${hint}` : ""}
        </span>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm" aria-live="polite">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2">
              <span className="truncate font-medium">{f.name}</span>
              <span className="shrink-0 text-xs text-gray-500">{size(f.size)}</span>
              <button
                type="button"
                className="shrink-0 text-gray-400 hover:text-red-600"
                aria-label={`Remove ${f.name}`}
                onClick={() => use(files.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {tooBig.length > 0 && (
        <p className="mt-1 text-xs text-red-700">
          {tooBig.map((f) => f.name).join(", ")} {tooBig.length === 1 ? "is" : "are"} over {maxMb} MB and won&apos;t upload.
        </p>
      )}
    </div>
  );
}
