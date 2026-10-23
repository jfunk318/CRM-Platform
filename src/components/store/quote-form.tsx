import { MAX_UPLOAD_MB } from "@/lib/files/types";
import { ActionForm } from "@/components/admin/action-form";
import { FilePicker } from "@/components/file-picker";
import { Honeypot } from "./honeypot";
import { quoteRequestAction } from "@/app/(store)/actions";

type Product = { id: string; colors: { id: string; name: string }[]; sizes: { id: string; code: string }[] };

/** Ask for a quote, optionally for a specific product with sizes. */
export function QuoteForm({ product }: { product?: Product }) {
  return (
    <ActionForm action={quoteRequestAction} submitLabel="Request a quote" resetOnSuccess className="space-y-4" >
      <Honeypot />
      {product && (
        <>
          <input type="hidden" name="productId" value={product.id} />
          <div>
            <label className="label" htmlFor="q-color">Color</label>
            <select className="input" id="q-color" name="colorId" required>
              {product.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <fieldset>
            <legend className="label">How many of each size?</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {product.sizes.map((s) => (
                <label key={s.id} className="text-sm">
                  <span className="block font-medium">{s.code}</span>
                  <input className="input mt-1" name={`qty_${s.id}`} inputMode="numeric" placeholder="0" aria-label={`Quantity ${s.code}`} />
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <div>
        <label className="label" htmlFor="q-details">{product ? "What should we print or embroider, and where?" : "What are you looking for?"}</label>
        <textarea className="input min-h-28" id="q-details" name="details" required={!product} placeholder="e.g. 2-color logo on the front, names on the back" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="q-name">Your name</label>
          <input className="input" id="q-name" name="name" required autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="q-email">Email</label>
          <input className="input" id="q-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="q-phone">Phone (optional)</label>
          <input className="input" id="q-phone" name="phone" autoComplete="tel" />
        </div>
        <div>
          <label className="label" htmlFor="q-org">Team, school or company (optional)</label>
          <input className="input" id="q-org" name="organization" autoComplete="organization" />
        </div>
        <div>
          <label className="label" htmlFor="q-date">Needed by (optional)</label>
          <input className="input" id="q-date" name="neededBy" type="date" />
        </div>
        <div>
          <label className="label" htmlFor="q-files">Artwork or examples (optional, up to {MAX_UPLOAD_MB} MB each)</label>
          <FilePicker id="q-files" name="files" multiple maxMb={MAX_UPLOAD_MB} />
        </div>
      </div>
    </ActionForm>
  );
}
