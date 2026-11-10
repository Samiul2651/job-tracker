"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <form action={action} className="card w-full max-w-sm p-6 space-y-4">
        <h1 className="text-xl font-bold">Job Tracker</h1>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="input" autoComplete="current-password" required autoFocus />
        </div>
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Checking…" : "Open"}</button>
      </form>
    </main>
  );
}
