import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in · Beeze Tees" };

export default async function LoginPage() {
  if (await getCurrentStaff()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-semibold">Beeze Tees staff</h1>
        <p className="mb-4 text-sm text-gray-500">Sign in to the back office.</p>
        <LoginForm />
      </div>
    </main>
  );
}
