import { getProject, getBoardMeta } from "@/lib/queries";
import { ProjectNav } from "@/components/project/ProjectNav";
import type { Section } from "@/lib/utils";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, meta] = await Promise.all([getProject(id), getBoardMeta()]);
  const sections = p.sections as Section[];
  return (
    <div className="flex h-full">
      <ProjectNav
        project={{
          id: p.id,
          title: p.title,
          archived: p.archived,
          stageId: p.stageId,
          dueDate: p.dueDate?.toISOString() ?? null,
          thumb: p.videos[0]?.thumbnailUrl ?? null,
          sections: sections.map((s) => ({ ...s, count: p.links.filter((l) => l.section === s.key).length })),
          pages: p.pages,
          videos: p.videos.map((v) => ({ id: v.id, name: v.name, version: v.version, status: v.status })),
        }}
        stages={meta.stages}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
