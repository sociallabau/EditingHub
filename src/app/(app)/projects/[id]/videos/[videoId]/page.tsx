import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBoardMeta, getProject } from "@/lib/queries";
import { VideoReview } from "@/components/review/VideoReview";

export const dynamic = "force-dynamic";

export default async function VideoPage({ params }: { params: Promise<{ id: string; videoId: string }> }) {
  const { id, videoId } = await params;
  const user = await requireUser();
  const [project, meta] = await Promise.all([getProject(id), getBoardMeta()]);
  const video = await db.video.findFirst({
    where: { id: videoId, projectId: id },
    include: {
      uploadedBy: { select: { name: true } },
      transcript: true,
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, color: true } } },
      },
    },
  });
  if (!video) notFound();

  return (
    <VideoReview
      key={video.id}
      me={{ id: user.id, role: user.role }}
      users={meta.users}
      project={{ id: project.id, title: project.title }}
      versions={project.videos.map((v) => ({ id: v.id, version: v.version, name: v.name, status: v.status }))}
      video={{
        id: video.id,
        name: video.name,
        url: video.url,
        version: video.version,
        status: video.status,
        contentType: video.contentType,
        duration: video.duration,
        uploadedBy: video.uploadedBy.name,
        createdAt: video.createdAt.toISOString(),
      }}
      transcript={(video.transcript?.segments as never) ?? null}
      aiQa={(video.aiQa as never) ?? null}
      aiQaAt={video.aiQaAt?.toISOString() ?? null}
      comments={video.comments.map((c) => ({
        id: c.id,
        body: c.body,
        timestamp: c.timestamp,
        resolved: c.resolved,
        drawing: (c.drawing as never) ?? null,
        parentId: c.parentId,
        createdAt: c.createdAt.toISOString(),
        author: c.author,
      }))}
    />
  );
}
