"use client";

import { useActionState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { KeyRound, UserPlus } from "lucide-react";
import { createUser, resetUserPassword, updateUser } from "@/lib/actions";
import { cn, ROLE_LABEL } from "@/lib/utils";
import { Avatar } from "../ui";

type U = { id: string; name: string; email: string; role: Role; color: string; active: boolean };
const ROLES: Role[] = ["ADMIN", "ACCOUNT_MANAGER", "EDITOR", "VIDEOGRAPHER"];

export function TeamManager({ users, me }: { users: U[]; me: string }) {
  const [state, action, pending] = useActionState(createUser, null);
  const [, start] = useTransition();
  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-line px-5 py-3">
        <h1 className="page-title">Team</h1>
      </header>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <form action={action} className="panel grid gap-2 p-4 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <div className="sm:col-span-5 mb-1 flex items-center gap-2 text-[13px] font-semibold">
            <UserPlus className="h-4 w-4" /> Add a team member
          </div>
          <input className="input" name="name" placeholder="Full name" required />
          <input className="input" name="email" type="email" placeholder="Email" required />
          <input className="input" name="password" placeholder="Temporary password (8+ chars)" required minLength={8} />
          <select className="input" name="role" defaultValue="EDITOR">
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <button className="btn-primary justify-center" disabled={pending}>Add</button>
          {state?.error && <p className="text-xs text-red-400 sm:col-span-5">{state.error}</p>}
          {state?.ok && <p className="text-xs text-green-500 sm:col-span-5">{state.ok}</p>}
        </form>

        <div className="text-xs text-muted">
          <b className="text-zinc-300">Admins</b> manage everything incl. team. <b className="text-zinc-300">Account managers</b> manage clients,
          templates & board columns and can delete projects. <b className="text-zinc-300">Editors</b> and <b className="text-zinc-300">videographers</b> create
          and work on projects, upload footage/edits and comment.
        </div>

        <div className="divide-y divide-line rounded-lg border border-line">
          {users.map((u) => (
            <div key={u.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !u.active && "opacity-50")}>
              <Avatar name={u.name} color={u.color} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{u.name} {u.id === me && <span className="text-muted">(you)</span>}</div>
                <div className="text-xs text-muted">{u.email}</div>
              </div>
              <select
                className="input w-44"
                value={u.role}
                disabled={u.id === me}
                onChange={(e) => start(() => updateUser(u.id, { role: e.target.value as Role }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <button
                className="btn"
                onClick={() => {
                  const pw = prompt(`New password for ${u.name} (8+ characters)`);
                  if (pw) start(async () => {
                    try {
                      await resetUserPassword(u.id, pw);
                      alert("Password updated — let them know.");
                    } catch (e) {
                      alert((e as Error).message);
                    }
                  });
                }}
              >
                <KeyRound className="h-3.5 w-3.5" /> Reset password
              </button>
              {u.id !== me && (
                <button className="btn" onClick={() => start(() => updateUser(u.id, { active: !u.active }))}>
                  {u.active ? "Deactivate" : "Reactivate"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
