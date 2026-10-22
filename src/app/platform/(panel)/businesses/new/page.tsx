import { requirePlatformUser } from "@/lib/auth/platform-session";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { PLATFORM_DOMAIN } from "@/lib/hosts";
import { ActionForm } from "@/components/admin/action-form";
import { createBusiness } from "../../actions";

export default async function NewBusinessPage() {
  await requirePlatformUser();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="page-title">Add a business</h1>
      <p className="text-sm text-gray-500">
        Creates the business with starting order statuses, an Apparel product type and a Retail pricing group, plus
        its first admin, who can then set up the catalog, prices and staff.
      </p>
      <div className="card">
        <ActionForm action={createBusiness} submitLabel="Create business">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Business name</label>
              <input className="input" id="name" name="name" placeholder="Company Name" required />
            </div>
            <div>
              <label className="label" htmlFor="slug">Web address</label>
              <div className="flex items-center gap-1">
                <input className="input" id="slug" name="slug" placeholder="from name" />
                <span className="text-sm whitespace-nowrap text-gray-500">.{PLATFORM_DOMAIN ?? "localhost"}</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="customDomain">Their own domain (optional)</label>
              <input className="input" id="customDomain" name="customDomain" placeholder="companyname.com" />
              <p className="mt-1 text-xs text-gray-500">
                Their DNS must point this domain, and <span className="font-mono">*.domain</span> for affiliate stores,
                at the platform.
              </p>
            </div>
          </div>
          <h2 className="font-semibold">First admin</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="adminName">Name</label>
              <input className="input" id="adminName" name="adminName" />
            </div>
            <div>
              <label className="label" htmlFor="adminEmail">Email</label>
              <input className="input" id="adminEmail" name="adminEmail" type="email" required />
            </div>
            <div>
              <label className="label" htmlFor="adminPassword">Temporary password</label>
              <input className="input" id="adminPassword" name="adminPassword" type="password" minLength={MIN_PASSWORD_LENGTH} required />
            </div>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
