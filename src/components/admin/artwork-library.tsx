import type { Prisma } from "@prisma/client";
import { removeArtworkAction, uploadArtworkAction } from "@/app/admin/(panel)/customers/artwork-actions";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { FilePicker } from "@/components/file-picker";
import { PLACEABLE_ACCEPT, staffFileUrl } from "@/lib/design/artwork";
import { MAX_UPLOAD_MB } from "@/lib/files/types";

type Asset = Prisma.ArtworkAssetGetPayload<{ include: { file: { select: { id: true; name: true; size: true; sha256: true } }; customer: { select: { firstName: true; lastName: true } } } }>;

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * A customer's or company's saved artwork: the gallery the design studio
 * offers when placing artwork, with uploads and removal.
 */
export function ArtworkLibrary({ assets, owner, sharedWith }: { assets: Asset[]; owner: { customerId?: string; companyId?: string }; sharedWith?: string }) {
  return (
    <section className="card space-y-3" data-testid="artwork-library">
      <div>
        <h2 className="font-semibold">Artwork</h2>
        <p className="text-sm text-gray-500">
          Logos and art saved for reuse. They&apos;re offered first when placing artwork on their quotes, orders and stores; images uploaded to their orders are added here automatically.
          {sharedWith ? ` Shared with everyone at ${sharedWith}.` : ""}
        </p>
      </div>
      {assets.length === 0 ? (
        <p className="text-sm text-gray-500">No artwork saved yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {assets.map((a) => (
            <figure key={a.id} className="space-y-1 text-xs" data-testid="library-item">
              <a href={staffFileUrl(a.fileId)} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded border border-gray-200 bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={staffFileUrl(a.fileId)} alt={a.name} loading="lazy" className="h-full w-full object-contain" />
              </a>
              <figcaption>
                <div className="truncate font-medium" title={a.name}>{a.name}</div>
                <div className="text-gray-500">
                  {a.customer ? `${a.customer.firstName} ${a.customer.lastName}`.trim() : "Company"} · {day(a.lastUsedAt ?? a.createdAt)}
                </div>
                <ActionButton action={removeArtworkAction} fields={{ assetId: a.id }} label="Remove" className="text-red-700 hover:underline" confirm={`Remove ${a.name} from saved artwork?`} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <ActionForm action={uploadArtworkAction} submitLabel="Add artwork" resetOnSuccess className="max-w-md space-y-2">
        {owner.customerId && <input type="hidden" name="customerId" value={owner.customerId} />}
        {owner.companyId && <input type="hidden" name="companyId" value={owner.companyId} />}
        <FilePicker id="library-files" name="files" multiple required accept={PLACEABLE_ACCEPT} maxMb={MAX_UPLOAD_MB} hint="PNG, JPG, GIF, WebP or SVG" />
      </ActionForm>
    </section>
  );
}
