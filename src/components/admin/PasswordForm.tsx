"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="panel space-y-3 p-4">
      <div className="text-[13px] font-semibold">Change password</div>
      <input className="input" type="password" name="current" placeholder="Current password" required />
      <input className="input" type="password" name="next" placeholder="New password (8+ characters)" required minLength={8} />
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-xs text-green-500">{state.ok}</p>}
      <button className="btn-primary" disabled={pending}>Update password</button>
    </form>
  );
}
