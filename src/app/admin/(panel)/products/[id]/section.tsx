/**
 * One section of the product page: its title and explanation in the middle
 * column (plus anything in `aside`), its settings on the right.
 */
export function SectionFrame({ title, intro, aside, children }: { title: string; intro?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    // Side by side on very wide screens; otherwise the explanation sits above the settings.
    <div className="2xl:flex 2xl:min-h-full">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-5 2xl:w-80 2xl:shrink-0 2xl:border-r 2xl:border-b-0">
        <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold">{title}</h2>
        <div className="gap-8 md:flex 2xl:block">
          {intro && <div className="mt-3 max-w-2xl space-y-2 text-sm text-gray-600">{intro}</div>}
          {aside && <div className="mt-4 space-y-1 text-sm md:min-w-64 2xl:min-w-0">{aside}</div>}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-6 bg-white px-6 py-5" data-testid="section-body">{children}</div>
    </div>
  );
}

export function Field({ label, name, value, required, placeholder, hint }: { label: string; name: string; value: string; required?: boolean; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} defaultValue={value} required={required} placeholder={placeholder} />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Select({ label, name, value, children }: { label: string; name: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="input" id={name} name={name} defaultValue={value}>{children}</select>
    </div>
  );
}
