import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { FolderOpen, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getBoardMeta, getProject } from "@/lib/queries";
import type { Section } from "@/lib/utils";
import { ProjectHeader } from "@/components/project/ProjectHeader";
import { FootageSection } from "@/components/project/FootageSection";
import { PageEditor } from "@/components/project/PageEditor";
import { VideoGrid } from "@/components/project/VideoGrid";
import { VideoUpload } from "@/components/project/VideoUpload";
import { ProjectChat } from "@/components/project/ProjectChat";
import { AddSection } from "@/components/project/AddSection";
import { AiBrief } from "@/components/project/AiBrief";
import { Thumbnails } from "@/components/project/Thumbnails";
import { Avatar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const user = await requireUser();
  const [p, meta] = await Promise.all([getProject(id), getBoardMeta()]);
  const sections = p.sections as Section[];

  const chat = await db.comment.findMany({
    where: { projectId: id, videoId: null },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, color: true } } },
  });

  const clientLinks = p.clientId
    ? await db.link.findMany({ where: { clientId: p.clientId }, orderBy: { createdAt: "asc" } })
    : [];

  const linkProps = (key: string) =>
    p.links
      .filter((l) => l.section === key)
      .map((l) => ({
        id: l.id,
        label: l.label,
        url: l.url,
        kind: l.kind,
        size: l.size,
        createdAt: l.createdAt.toISOString(),
        addedBy: l.addedBy,
      }));

  const videos = p.videos.map((v) => ({
    id: v.id,
    name: v.name,
    version: v.version,
    status: v.status,
    thumbnailUrl: v.thumbnailUrl,
    createdAt: v.createdAt.toISOString(),
    uploadedBy: v.uploadedBy.name,
    openComments: v._count.comments,
  }));

  let main: React.ReactNode;

  if (tab.startsWith("section-")) {
    const key = tab.slice("section-".length);
    const section = sections.find((s) => s.key === key);
    if (!section) notFound();
    main = (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-1 text-xs text-muted">{p.title}</div>
        <FootageSection projectId={p.id} section={section} links={linkProps(key)} removable />
      </div>
    );
  } else if (tab.startsWith("page-")) {
    const page = await db.page.findFirst({ where: { id: tab.slice(5), projectId: id } });
    if (!page) notFound();
    main = (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-1 text-xs text-muted">{p.title}</div>
        <PageEditor key={page.id} page={{ id: page.id, title: page.title, content: page.content, updatedAt: page.updatedAt.toISOString() }} />
      </div>
    );
  } else if (tab === "thumbnails") {
    const thumbs = p.links.filter((l) => l.section === "thumbnails").reverse();
    main = (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-1 text-xs text-muted">{p.title}</div>
        <Thumbnails
          projectId={p.id}
          coverUrl={p.coverUrl}
          frameUrl={p.videos[0]?.thumbnailUrl ?? null}
          items={thumbs.map((l) => ({ id: l.id, url: l.url, label: l.label, addedBy: l.addedBy.name }))}
        />
      </div>
    );
  } else if (tab === "ai-brief") {
    const clips = await db.transcript.findMany({ where: { projectId: id, kind: "RAW" }, orderBy: { createdAt: "asc" } });
    main = (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-1 text-xs text-muted">{p.title}</div>
        <AiBrief
          projectId={p.id}
          hasBrief={p.pages.some((pg) => pg.title === "AI Brief")}
          clips={clips.map((c) => ({ id: c.id, sourceName: c.sourceName, duration: c.duration, words: c.text.split(/\s+/).filter(Boolean).length }))}
        />
      </div>
    );
  } else if (tab === "videos") {
    main = (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-1 text-xs text-muted">{p.title}</div>
        <h2 className="mb-4 text-lg font-semibold">Edited Video</h2>
        <VideoUpload projectId={p.id} />
        <div className="mt-6">
          <VideoGrid projectId={p.id} videos={videos} />
        </div>
      </div>
    );
  } else if (tab === "activity") {
    const activity = await db.activity.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { name: true, color: true } } },
    });
    main = (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-1 text-xs text-muted">{p.title}</div>
        <h2 className="mb-4 text-lg font-semibold">Activity · {activity.length}</h2>
        <ol className="space-y-3">
          {activity.map((a) => (
            <li key={a.id} className="flex gap-3">
              <Avatar name={a.actor.name} color={a.actor.color} size={22} />
              <div>
                <div className="text-[13px] text-zinc-200">{a.message}</div>
                <div className="text-[11px] text-muted">{formatDistanceToNow(a.createdAt, { addSuffix: true })}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  } else {
    main = (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ProjectHeader
          project={{
            id: p.id,
            title: p.title,
            description: p.description,
            priority: p.priority,
            clientId: p.clientId,
            shootDate: p.shootDate?.toISOString() ?? null,
            archived: p.archived,
            templateName: p.template?.name ?? null,
            memberIds: p.members.map((m) => m.userId),
          }}
          meta={meta}
          canManage={user.role === "ADMIN" || user.role === "ACCOUNT_MANAGER"}
        />

        <h3 className="mb-3 mt-8 text-[15px] font-semibold">File Upload</h3>
        <VideoUpload projectId={p.id} compact rawHref={sections[0] ? `/projects/${p.id}?tab=section-${sections[0].key}` : undefined} />

        {videos.length > 0 && (
          <>
            <div className="mb-3 mt-8 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Edited Video</h3>
              <Link href={`/projects/${p.id}?tab=videos`} className="btn-ghost">
                All versions <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <VideoGrid projectId={p.id} videos={videos.slice(0, 3)} />
          </>
        )}

        {sections.map((s) => (
          <div key={s.key} className="mt-8">
            <FootageSection projectId={p.id} section={s} links={linkProps(s.key)} compact />
          </div>
        ))}
        <div className="mt-4">
          <AddSection projectId={p.id} />
        </div>

        {p.client && (
          <div className="mt-10 rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">{p.client.name} — style guide & brand assets</h3>
              <Link href={`/clients/${p.client.id}`} className="btn-ghost">
                Open client <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {p.client.notes && <p className="mb-3 whitespace-pre-wrap text-[13px] text-zinc-300">{p.client.notes}</p>}
            {clientLinks.length ? (
              <ul className="space-y-1">
                {clientLinks.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] text-sky-400 hover:underline">
                      <FolderOpen className="h-3.5 w-3.5" /> {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No brand assets linked for this client yet.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto">{main}</div>
      <ProjectChat
        projectId={p.id}
        me={user.id}
        comments={chat.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          author: c.author,
        }))}
        members={meta.users}
      />
    </div>
  );
}
