import { requireUser } from "@/lib/auth";
import { getBoardMeta, getBoardProjects } from "@/lib/queries";
import { Board } from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();
  const [projects, meta] = await Promise.all([getBoardProjects(false), getBoardMeta()]);
  return <Board projects={projects} meta={meta} me={{ id: user.id, role: user.role }} />;
}
