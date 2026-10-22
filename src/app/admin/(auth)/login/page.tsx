import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/session";
import { getShop } from "@/lib/shop";
import { PLATFORM_NAME } from "@/lib/platform";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  return { title: `Staff sign in · ${(await getShop()).name}` };
}

export default async function LoginPage() {
  if (await getCurrentStaff()) redirect("/admin");
  const shop = await getShop();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-semibold">{shop.name} staff</h1>
        <p className="mb-4 text-sm text-gray-500">Sign in to the back office.</p>
        <LoginForm />
        <p className="mt-4 text-center text-[11px] text-gray-400">Powered by {PLATFORM_NAME}</p>
      </div>
    </main>
  );
}
