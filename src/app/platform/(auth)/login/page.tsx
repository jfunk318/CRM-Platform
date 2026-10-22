import { notFound, redirect } from "next/navigation";
import { isPlatformRequest } from "@/lib/business";
import { getCurrentPlatformUser } from "@/lib/auth/platform-session";
import { PLATFORM_NAME } from "@/lib/platform";
import { PlatformLoginForm } from "./login-form";

export const metadata = { title: `Platform sign in · ${PLATFORM_NAME}` };

export default async function PlatformLoginPage() {
  if (!(await isPlatformRequest())) notFound();
  if (await getCurrentPlatformUser()) redirect("/platform");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-semibold">{PLATFORM_NAME}</h1>
        <p className="mb-4 text-sm text-gray-500">Platform administration</p>
        <PlatformLoginForm />
      </div>
    </main>
  );
}
