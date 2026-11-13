import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { VersionCompare } from "@/components/review/VersionCompare";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  const { a, b } = await searchParams;
  await requireUser();
  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, title: true, videos: { orderBy: { version: "asc" }, select: { id: true, version: true, name: true, url: true } } },
  });
  if (!project || project.videos.length < 2) notFound();
  const newer = project.videos.find((v) => v.id === b) ?? project.videos[project.videos.length - 1];
  const older = project.videos.find((v) => v.id === a && v.id !== newer.id) ?? project.videos.filter((v) => v.version < newer.version).pop() ?? project.videos[0];
  const notes = await db.comment.findMany({
    where: { videoId: older.id, parentId: null },
    orderBy: [{ timestamp: "asc" }, { createdAt: "asc" }],
    include: { author: { select: { id: true, name: true, color: true } } },
  });
  return (
    <VersionCompare
      key={`${older.id}-${newer.id}`}
      project={{ id: project.id, title: project.title }}
      versions={project.videos.map((v) => ({ id: v.id, version: v.version }))}
      older={older}
      newer={newer}
      notes={notes.map((n) => ({
        id: n.id,
        body: n.body,
        timestamp: n.timestamp,
        resolved: n.resolved,
        drawing: (n.drawing as never) ?? null,
        author: n.author,
      }))}
    />
  );
}
