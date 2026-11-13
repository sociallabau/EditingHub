import "server-only";
import { db } from "./db";

export type BoardProject = {
  id: string;
  title: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  dueDate: string | null;
  createdAt: string;
  archivedAt: string | null;
  stageId: string;
  position: number;
  client: { id: string; name: string; color: string } | null;
  members: { id: string; name: string; color: string }[];
  thumb: string | null;
  videos: number;
  openComments: number;
};

export async function getBoardProjects(archived: boolean): Promise<BoardProject[]> {
  const rows = await db.project.findMany({
    where: { archived },
    orderBy: archived ? { archivedAt: "desc" } : { position: "asc" },
    include: {
      client: { select: { id: true, name: true, color: true } },
      members: { include: { user: { select: { id: true, name: true, color: true } } }, orderBy: { addedAt: "asc" } },
      videos: { orderBy: { createdAt: "desc" }, take: 1, select: { thumbnailUrl: true } },
      _count: { select: { videos: true, comments: { where: { resolved: false, videoId: { not: null } } } } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    priority: p.priority,
    dueDate: p.dueDate?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    archivedAt: p.archivedAt?.toISOString() ?? null,
    stageId: p.stageId,
    position: p.position,
    client: p.client,
    members: p.members.map((m) => m.user),
    thumb: p.videos[0]?.thumbnailUrl ?? null,
    videos: p._count.videos,
    openComments: p._count.comments,
  }));
}

export async function getBoardMeta() {
  const [stages, users, clients, templates] = await Promise.all([
    db.stage.findMany({ orderBy: { order: "asc" } }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true, role: true } }),
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    db.template.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, description: true, color: true, defaultPriority: true, sections: true },
    }),
  ]);
  return {
    stages: stages.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind })),
    users,
    clients,
    templates: templates.map((t) => ({ ...t, sections: t.sections as { key: string; title: string }[] })),
  };
}
export type BoardMeta = Awaited<ReturnType<typeof getBoardMeta>>;

import { cache } from "react";
import { notFound } from "next/navigation";

export const getProject = cache(async (id: string) => {
  const p = await db.project.findUnique({
    where: { id },
    include: {
      stage: true,
      client: true,
      template: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true, color: true, role: true } } }, orderBy: { addedAt: "asc" } },
      pages: { orderBy: { order: "asc" }, select: { id: true, title: true } },
      videos: {
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
          _count: { select: { comments: { where: { resolved: false, parentId: null } } } },
        },
      },
      links: { orderBy: { createdAt: "asc" }, include: { addedBy: { select: { name: true, color: true } } } },
    },
  });
  if (!p) notFound();
  return p;
});
export type FullProject = Awaited<ReturnType<typeof getProject>>;
