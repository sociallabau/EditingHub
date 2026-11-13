import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { TeamManager } from "@/components/admin/TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <TeamManager
      me={me.id}
      users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, color: u.color, active: u.active }))}
    />
  );
}
