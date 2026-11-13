"use client";
import { useActionState } from "react";
import { login } from "@/lib/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="panel space-y-3 p-5">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label">Email</label>
        <input className="input" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      <button className="btn-primary w-full justify-center py-2" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
