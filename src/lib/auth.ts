import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export const getUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = await verifySession(token);
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  return user && user.active ? user : null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/projects");
  return user;
}

/** Admins and account managers manage clients, templates and the board. */
export function canManage(role: string) {
  return role === "ADMIN" || role === "ACCOUNT_MANAGER";
}
