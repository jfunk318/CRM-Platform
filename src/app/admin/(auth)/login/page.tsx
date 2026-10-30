import { notFound, redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/session";
import { getRequestBusiness, getRequestStoreSlug } from "@/lib/business";
import { PLATFORM_NAME } from "@/lib/platform";
import { BrandMark } from "@/components/admin/shell";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  return { title: `Staff sign in · ${(await getRequestBusiness())?.name ?? PLATFORM_NAME}` };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suspended?: string }> }) {
  if (await getCurrentStaff()) redirect("/admin");
  const business = await getRequestBusiness();
  if (!business || (await getRequestStoreSlug())) notFound();
  const { suspended } = await searchParams;
  return (
    <main className="admin-ui flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="card w-full max-w-sm p-6">
        <BrandMark onLight className="mb-4" />
        <h1 className="text-xl font-bold tracking-tight">{business.name} staff</h1>
        <p className="mb-4 text-sm text-gray-500">Sign in to the back office.</p>
        {(suspended || business.status !== "ACTIVE") && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">This business&apos;s account is suspended.</p>
        )}
        <LoginForm />
        <p className="mt-4 text-center text-[11px] text-gray-400">Powered by {PLATFORM_NAME}</p>
      </div>
    </main>
  );
}
