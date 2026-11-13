import { redirect } from "next/navigation";
import { requireUser, canManage } from "@/lib/auth";
import { db } from "@/lib/db";
import { StageManager } from "@/components/admin/StageManager";

export const dynamic = "force-dynamic";

export default async function BoardSettingsPage() {
  const user = await requireUser();
  if (!canManage(user.role)) redirect("/projects");
  const stages = await db.stage.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { projects: true } } } });
  return <StageManager stages={stages.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind, count: s._count.projects }))} />;
}
