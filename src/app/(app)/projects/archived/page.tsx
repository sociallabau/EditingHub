import { requireUser } from "@/lib/auth";
import { getBoardMeta, getBoardProjects } from "@/lib/queries";
import { ArchivedList } from "@/components/ArchivedList";

export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  const user = await requireUser();
  const [projects, meta] = await Promise.all([getBoardProjects(true), getBoardMeta()]);
  return <ArchivedList projects={projects} stages={meta.stages} canDelete={user.role === "ADMIN" || user.role === "ACCOUNT_MANAGER"} />;
}
