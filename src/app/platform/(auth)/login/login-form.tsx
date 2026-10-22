"use client";

import { useActionState } from "react";
import { type LoginState, platformLogin } from "./actions";

export function PlatformLoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(platformLogin, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
