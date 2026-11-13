"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import type { Priority, Role, StageKind, VideoStatus, LinkKind, Prisma } from "@prisma/client";
import { db } from "./db";
import { canManage, requireUser } from "./auth";
import { SESSION_COOKIE, signSession } from "./session";
import { findMentions, logAndNotify } from "./notify";
import { PRIORITY_LABEL, type Section, type TemplatePage, slugKey } from "./utils";
import { format } from "date-fns";

const refresh = () => revalidatePath("/", "layout");

async function assertManager() {
  const u = await requireUser();
  if (!canManage(u.role)) throw new Error("Only admins and account managers can do that");
  return u;
}
async function assertAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("Only admins can do that");
  return u;
}

async function removeBlob(url?: string | null) {
  if (url && url.includes(".blob.vercel-storage.com") && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(url);
    } catch (e) {
      console.error("blob delete failed", e);
    }
  }
}

/* ───────────────────────── auth ───────────────────────── */

export async function login(_: unknown, form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Wrong email or password" };
  }
  (await cookies()).set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(String(form.get("next") || "/pulse"));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePassword(_: unknown, form: FormData) {
  const user = await requireUser();
  const current = String(form.get("current") || "");
  const next = String(form.get("next") || "");
  if (next.length < 8) return { error: "New password must be at least 8 characters" };
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Current password is wrong" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: "Password updated" };
}

/* ───────────────────────── team ───────────────────────── */

const COLORS = ["#977c58", "#7b6a9c", "#5f8a6a", "#b8687e", "#4f8391", "#c4674f", "#c99a3c", "#6b7a4a"];

export async function createUser(_: unknown, form: FormData) {
  await assertAdmin();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const name = String(form.get("name") || "").trim();
  const password = String(form.get("password") || "");
  const role = String(form.get("role") || "EDITOR") as Role;
  if (!email || !name) return { error: "Name and email are required" };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters" };
  if (await db.user.findUnique({ where: { email } })) return { error: "Someone already has that email" };
  const count = await db.user.count();
  await db.user.create({
    data: { email, name, role, color: COLORS[count % COLORS.length], passwordHash: await bcrypt.hash(password, 10) },
  });
  refresh();
  return { ok: `Added ${name}. Send them their email + temporary password.` };
}

export async function updateUser(id: string, data: { role?: Role; active?: boolean; name?: string }) {
  const me = await assertAdmin();
  if (id === me.id && (data.active === false || (data.role && data.role !== "ADMIN"))) {
    throw new Error("You can't demote or deactivate yourself");
  }
  await db.user.update({ where: { id }, data });
  refresh();
}

export async function resetUserPassword(id: string, password: string) {
  await assertAdmin();
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
}

/* ───────────────────────── projects ───────────────────────── */

export async function createProject(input: {
  title: string;
  templateId?: string | null;
  clientId?: string | null;
  stageId: string;
  priority?: Priority;
  dueDate?: string | null;
  shootDate?: string | null;
  memberIds?: string[];
}) {
  const user = await requireUser();
  const template = input.templateId ? await db.template.findUnique({ where: { id: input.templateId } }) : null;
  const sections = (template?.sections as Section[] | undefined) ?? [{ key: "raw", title: "Raw Video" }];
  const pages = (template?.pages as TemplatePage[] | undefined) ?? [];
  const top = await db.project.findFirst({
    where: { stageId: input.stageId, archived: false },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const memberIds = Array.from(new Set([user.id, ...(input.memberIds ?? [])]));
  const project = await db.project.create({
    data: {
      title: input.title.trim() || "Untitled project",
      stageId: input.stageId,
      clientId: input.clientId || null,
      templateId: template?.id ?? null,
      priority: input.priority ?? template?.defaultPriority ?? "NONE",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      shootDate: input.shootDate ? new Date(input.shootDate) : null,
      position: (top?.position ?? 1000) - 1000,
      sections: sections as Prisma.InputJsonValue,
      createdById: user.id,
      members: { create: memberIds.map((userId) => ({ userId })) },
      pages: { create: pages.map((p, i) => ({ title: p.title, content: p.content, order: i })) },
    },
  });
  await logAndNotify({
    projectId: project.id,
    actorId: user.id,
    message: `${user.name} created "${project.title}"${template ? ` from the ${template.name} template` : ""} and tagged you`,
  });
  refresh();
  return project.id;
}

export async function updateProject(
  id: string,
  patch: {
    title?: string;
    description?: string;
    priority?: Priority;
    dueDate?: string | null;
    shootDate?: string | null;
    stageId?: string;
    clientId?: string | null;
  },
) {
  const user = await requireUser();
  const before = await db.project.findUniqueOrThrow({ where: { id }, include: { stage: true } });
  const data: Prisma.ProjectUncheckedUpdateInput = {};
  const changes: string[] = [];
  if (patch.title !== undefined && patch.title.trim() && patch.title !== before.title) {
    data.title = patch.title.trim();
    changes.push(`renamed the project to "${data.title}"`);
  }
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.priority && patch.priority !== before.priority) {
    data.priority = patch.priority;
    changes.push(`set priority to ${patch.priority === "NONE" ? "none" : PRIORITY_LABEL[patch.priority]}`);
  }
  if (patch.dueDate !== undefined) {
    data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
    changes.push(patch.dueDate ? `set the due date to ${format(new Date(patch.dueDate), "d MMM")}` : "cleared the due date");
  }
  if (patch.shootDate !== undefined) data.shootDate = patch.shootDate ? new Date(patch.shootDate) : null;
  if (patch.clientId !== undefined) data.clientId = patch.clientId;
  if (patch.stageId && patch.stageId !== before.stageId) {
    const stage = await db.stage.findUniqueOrThrow({ where: { id: patch.stageId } });
    data.stageId = stage.id;
    changes.push(`moved it to ${stage.name}`);
  }
  await db.project.update({ where: { id }, data });
  if (changes.length) {
    await logAndNotify({
      projectId: id,
      actorId: user.id,
      message: `${user.name} ${changes.join(", ")} on "${(data.title as string) ?? before.title}"`,
    });
  }
  refresh();
}

/** Drag & drop on the board. */
export async function moveProject(id: string, stageId: string, beforeId: string | null, afterId: string | null) {
  const user = await requireUser();
  const [before, after, project] = await Promise.all([
    beforeId ? db.project.findUnique({ where: { id: beforeId }, select: { position: true } }) : null,
    afterId ? db.project.findUnique({ where: { id: afterId }, select: { position: true } }) : null,
    db.project.findUniqueOrThrow({ where: { id }, include: { stage: true } }),
  ]);
  let position: number;
  if (before && after) position = (before.position + after.position) / 2;
  else if (before) position = before.position + 1000;
  else if (after) position = after.position - 1000;
  else position = 0;
  await db.project.update({ where: { id }, data: { stageId, position } });
  if (project.stageId !== stageId) {
    const stage = await db.stage.findUniqueOrThrow({ where: { id: stageId } });
    await logAndNotify({
      projectId: id,
      actorId: user.id,
      message: `${user.name} moved "${project.title}" from ${project.stage.name} to ${stage.name}`,
    });
  }
  refresh();
}

export async function setMembers(projectId: string, userIds: string[]) {
  const user = await requireUser();
  const current = await db.projectMember.findMany({ where: { projectId } });
  const currentIds = current.map((m) => m.userId);
  const added = userIds.filter((id) => !currentIds.includes(id));
  const removed = currentIds.filter((id) => !userIds.includes(id));
  await db.$transaction([
    db.projectMember.deleteMany({ where: { projectId, userId: { in: removed } } }),
    db.projectMember.createMany({ data: added.map((userId) => ({ projectId, userId })) }),
  ]);
  if (added.length) {
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    const names = await db.user.findMany({ where: { id: { in: added } }, select: { name: true } });
    await db.activity.create({
      data: { projectId, actorId: user.id, message: `${user.name} tagged ${names.map((n) => n.name).join(", ")}` },
    });
    const notifyIds = added.filter((id) => id !== user.id);
    if (notifyIds.length) {
      await db.notification.createMany({
        data: notifyIds.map((userId) => ({
          userId,
          actorId: user.id,
          projectId,
          message: `${user.name} tagged you on "${project.title}"`,
        })),
      });
    }
  }
  refresh();
}

export async function archiveProjects(ids: string[], archived = true) {
  const user = await requireUser();
  await db.project.updateMany({
    where: { id: { in: ids } },
    data: { archived, archivedAt: archived ? new Date() : null },
  });
  await db.activity.createMany({
    data: ids.map((projectId) => ({
      projectId,
      actorId: user.id,
      message: `${user.name} ${archived ? "archived" : "restored"} this project`,
    })),
  });
  refresh();
}

export async function deleteProjects(ids: string[]) {
  await assertManager();
  const videos = await db.video.findMany({ where: { projectId: { in: ids } } });
  const links = await db.link.findMany({ where: { projectId: { in: ids }, kind: "UPLOAD" } });
  await db.project.deleteMany({ where: { id: { in: ids } } });
  await Promise.all([
    ...videos.flatMap((v) => [removeBlob(v.url), removeBlob(v.thumbnailUrl)]),
    ...links.map((l) => removeBlob(l.url)),
  ]);
  refresh();
}

export async function duplicateProject(id: string) {
  const user = await requireUser();
  const p = await db.project.findUniqueOrThrow({ where: { id }, include: { pages: true, members: true } });
  const copy = await db.project.create({
    data: {
      title: `${p.title} (copy)`,
      description: p.description,
      priority: p.priority,
      dueDate: p.dueDate,
      stageId: p.stageId,
      clientId: p.clientId,
      templateId: p.templateId,
      sections: p.sections as Prisma.InputJsonValue,
      position: p.position - 1,
      createdById: user.id,
      members: { create: p.members.map((m) => ({ userId: m.userId })) },
      pages: { create: p.pages.map((pg) => ({ title: pg.title, content: pg.content, order: pg.order })) },
    },
  });
  await db.activity.create({ data: { projectId: copy.id, actorId: user.id, message: `${user.name} duplicated "${p.title}"` } });
  refresh();
  return copy.id;
}

export async function saveProjectAsTemplate(id: string, name: string) {
  await assertManager();
  const p = await db.project.findUniqueOrThrow({ where: { id }, include: { pages: { orderBy: { order: "asc" } } } });
  const t = await db.template.create({
    data: {
      name: name.trim() || p.title,
      defaultPriority: p.priority,
      sections: p.sections as Prisma.InputJsonValue,
      pages: p.pages.map((pg) => ({ title: pg.title, content: pg.content })) as Prisma.InputJsonValue,
    },
  });
  refresh();
  return t.id;
}

/* ───────────────────────── sections / links ───────────────────────── */

export async function addSection(projectId: string, title: string, hint = "") {
  await requireUser();
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const sections = [...(p.sections as Section[]), { key: slugKey(title), title: title.trim(), hint }];
  await db.project.update({ where: { id: projectId }, data: { sections } });
  refresh();
}

export async function removeSection(projectId: string, key: string) {
  await requireUser();
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const sections = (p.sections as Section[]).filter((s) => s.key !== key);
  await db.project.update({ where: { id: projectId }, data: { sections } });
  const links = await db.link.findMany({ where: { projectId, section: key } });
  await db.link.deleteMany({ where: { projectId, section: key } });
  await Promise.all(links.filter((l) => l.kind === "UPLOAD").map((l) => removeBlob(l.url)));
  refresh();
}

export async function addLinks(
  target: { projectId?: string; clientId?: string },
  section: string,
  items: { url: string; label: string; kind: LinkKind; size?: number }[],
) {
  const user = await requireUser();
  if (!items.length) return;
  for (const it of items) {
    if (!/^https?:\/\//i.test(it.url) && !(it.kind === "UPLOAD" && it.url.startsWith("/uploads/"))) throw new Error("Links must start with http:// or https://");
  }
  await db.link.createMany({
    data: items.map((it) => ({
      ...target,
      section,
      url: it.url,
      label: it.label.trim() || it.url,
      kind: it.kind,
      size: it.size,
      addedById: user.id,
    })),
  });
  if (target.projectId) {
    const p = await db.project.findUniqueOrThrow({ where: { id: target.projectId } });
    const sec = (p.sections as Section[]).find((s) => s.key === section);
    const what = items.some((i) => i.kind === "UPLOAD") ? "uploaded" : "linked";
    await logAndNotify({
      projectId: p.id,
      actorId: user.id,
      message: `${user.name} ${what} ${items.length === 1 ? `"${items[0].label}"` : `${items.length} files`} to ${sec?.title ?? "footage"} on "${p.title}"`,
    });
  }
  refresh();
}

export async function deleteLink(id: string) {
  await requireUser();
  const link = await db.link.delete({ where: { id } });
  if (link.kind === "UPLOAD") await removeBlob(link.url);
  if (link.projectId) await db.project.updateMany({ where: { id: link.projectId, coverUrl: link.url }, data: { coverUrl: null } });
  refresh();
}

/* ───────────────────────── pages ───────────────────────── */

export async function createPage(projectId: string, title = "Untitled page") {
  await requireUser();
  const count = await db.page.count({ where: { projectId } });
  const page = await db.page.create({ data: { projectId, title, order: count } });
  refresh();
  return page.id;
}

export async function updatePage(id: string, data: { title?: string; content?: string }) {
  await requireUser();
  await db.page.update({ where: { id }, data });
  revalidatePath("/projects/[id]", "page");
}

export async function deletePage(id: string) {
  await requireUser();
  await db.page.delete({ where: { id } });
  refresh();
}

/* ───────────────────────── videos ───────────────────────── */

export async function createVideo(
  projectId: string,
  v: { name: string; url: string; thumbnailUrl?: string | null; size?: number; contentType?: string; duration?: number },
) {
  const user = await requireUser();
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const version = (await db.video.count({ where: { projectId } })) + 1;
  const video = await db.video.create({
    data: { ...v, version, projectId, uploadedById: user.id },
  });
  const review = await db.stage.findFirst({ where: { kind: "REVIEW" }, orderBy: { order: "asc" } });
  if (review && project.stageId !== review.id) {
    await db.project.update({ where: { id: projectId }, data: { stageId: review.id } });
  }
  await logAndNotify({
    projectId,
    actorId: user.id,
    videoId: video.id,
    message: `${user.name} uploaded edit v${version} of "${project.title}" — ready for review`,
  });
  refresh();
  return video.id;
}

export async function setVideoStatus(videoId: string, status: VideoStatus) {
  const user = await requireUser();
  const video = await db.video.update({ where: { id: videoId }, data: { status }, include: { project: true } });
  const kind: StageKind | null = status === "APPROVED" ? "APPROVED" : status === "CHANGES_REQUESTED" ? "REVISIONS" : null;
  if (kind) {
    const stage = await db.stage.findFirst({ where: { kind }, orderBy: { order: "asc" } });
    if (stage) await db.project.update({ where: { id: video.projectId }, data: { stageId: stage.id } });
  }
  const verb =
    status === "APPROVED" ? "approved" : status === "CHANGES_REQUESTED" ? "requested changes on" : "set back to pending";
  await logAndNotify({
    projectId: video.projectId,
    actorId: user.id,
    videoId,
    message: `${user.name} ${verb} v${video.version} of "${video.project.title}"`,
  });
  refresh();
}

export async function setVideoThumbnail(videoId: string, thumbnailUrl: string) {
  await requireUser();
  const old = await db.video.findUniqueOrThrow({ where: { id: videoId }, select: { thumbnailUrl: true } });
  await db.video.update({ where: { id: videoId }, data: { thumbnailUrl } });
  if (old.thumbnailUrl !== thumbnailUrl) await removeBlob(old.thumbnailUrl);
  refresh();
}

export async function setVideoDuration(videoId: string, duration: number) {
  await requireUser();
  await db.video.update({ where: { id: videoId }, data: { duration } });
}

export async function deleteVideo(videoId: string) {
  const user = await requireUser();
  const v = await db.video.delete({ where: { id: videoId }, include: { project: true } });
  await Promise.all([removeBlob(v.url), removeBlob(v.thumbnailUrl)]);
  await logAndNotify({
    projectId: v.projectId,
    actorId: user.id,
    message: `${user.name} deleted video "${v.name}"`,
    notify: false,
  });
  refresh();
}

/* ───────────────────────── comments ───────────────────────── */

export async function addComment(input: {
  projectId: string;
  videoId?: string | null;
  parentId?: string | null;
  body: string;
  timestamp?: number | null;
  drawing?: { color: string; points: [number, number][] }[] | null;
}) {
  const user = await requireUser();
  const body = input.body.trim() || (input.drawing?.length ? "See drawing" : "");
  if (!body) return;
  const comment = await db.comment.create({
    data: {
      body,
      projectId: input.projectId,
      videoId: input.videoId || null,
      parentId: input.parentId || null,
      timestamp: input.timestamp ?? null,
      drawing: input.drawing?.length ? (input.drawing as Prisma.InputJsonValue) : undefined,
      authorId: user.id,
    },
    include: { project: true, video: true },
  });
  const mentions = await findMentions(body);
  // Anyone @mentioned gets tagged on the project so they keep getting updates.
  if (mentions.length) {
    await db.projectMember.createMany({
      data: mentions.map((userId) => ({ projectId: input.projectId, userId })),
      skipDuplicates: true,
    });
  }
  const where = comment.video
    ? `v${comment.video.version} of "${comment.project.title}"${comment.timestamp != null ? ` at ${fmt(comment.timestamp)}` : ""}`
    : `"${comment.project.title}"`;
  const snippet = body.length > 80 ? body.slice(0, 77) + "…" : body;
  await logAndNotify({
    projectId: input.projectId,
    actorId: user.id,
    videoId: input.videoId ?? undefined,
    extraUserIds: mentions,
    message: `${user.name} ${input.parentId ? "replied" : "commented"} on ${where}: "${snippet}"`,
  });
  refresh();
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export async function resolveComment(id: string, resolved: boolean) {
  await requireUser();
  await db.comment.update({ where: { id }, data: { resolved } });
  refresh();
}

export async function deleteComment(id: string) {
  const user = await requireUser();
  const c = await db.comment.findUniqueOrThrow({ where: { id } });
  if (c.authorId !== user.id && !canManage(user.role)) throw new Error("You can only delete your own comments");
  await db.comment.delete({ where: { id } });
  refresh();
}

/* ───────────────────────── notifications ───────────────────────── */

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
  refresh();
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  refresh();
}

/* ───────────────────────── clients ───────────────────────── */

export async function createClient(name: string, color?: string) {
  await assertManager();
  const c = await db.client.create({ data: { name: name.trim(), color } });
  refresh();
  return c.id;
}

export async function updateClient(id: string, data: { name?: string; color?: string; notes?: string }) {
  await assertManager();
  await db.client.update({ where: { id }, data });
  refresh();
}

export async function deleteClient(id: string) {
  await assertManager();
  await db.client.delete({ where: { id } });
  refresh();
}

/* ───────────────────────── templates ───────────────────────── */

export async function createTemplate(name: string) {
  await assertManager();
  const t = await db.template.create({
    data: {
      name: name.trim() || "New template",
      sections: [{ key: "raw", title: "Raw Video", hint: "Link footage from Google Drive or upload" }],
      pages: [{ title: "Brief", content: "" }],
    },
  });
  refresh();
  return t.id;
}

export async function updateTemplate(
  id: string,
  data: {
    name?: string;
    description?: string;
    color?: string;
    defaultPriority?: Priority;
    sections?: Section[];
    pages?: TemplatePage[];
  },
) {
  await assertManager();
  await db.template.update({
    where: { id },
    data: {
      ...data,
      sections: data.sections as Prisma.InputJsonValue | undefined,
      pages: data.pages as Prisma.InputJsonValue | undefined,
    },
  });
  refresh();
}

export async function deleteTemplate(id: string) {
  await assertManager();
  await db.template.delete({ where: { id } });
  refresh();
}

/* ───────────────────────── board columns ───────────────────────── */

export async function createStage(name: string, color: string) {
  await assertManager();
  const max = await db.stage.aggregate({ _max: { order: true } });
  await db.stage.create({ data: { name: name.trim(), color, order: (max._max.order ?? 0) + 1 } });
  refresh();
}

export async function updateStage(id: string, data: { name?: string; color?: string; kind?: StageKind }) {
  await assertManager();
  if (data.kind && data.kind !== "NORMAL") {
    // only one column per special behaviour
    await db.stage.updateMany({ where: { kind: data.kind, NOT: { id } }, data: { kind: "NORMAL" } });
  }
  await db.stage.update({ where: { id }, data });
  refresh();
}

export async function reorderStages(ids: string[]) {
  await assertManager();
  await db.$transaction(ids.map((id, order) => db.stage.update({ where: { id }, data: { order } })));
  refresh();
}

export async function deleteStage(id: string) {
  await assertManager();
  const count = await db.project.count({ where: { stageId: id } });
  if (count > 0) throw new Error("Move or archive the projects in this column first (including archived ones)");
  await db.stage.delete({ where: { id } });
  refresh();
}

/* ───────────────────────── transcripts & AI checks ───────────────────────── */

export async function saveTranscript(input: {
  projectId: string;
  videoId?: string | null;
  sourceName: string;
  duration?: number | null;
  text: string;
  segments: { start: number; end: number; text: string }[];
}) {
  await requireUser();
  const data = {
    projectId: input.projectId,
    sourceName: input.sourceName,
    duration: input.duration ?? null,
    text: input.text,
    segments: input.segments as Prisma.InputJsonValue,
  };
  if (input.videoId) {
    await db.transcript.upsert({
      where: { videoId: input.videoId },
      create: { ...data, videoId: input.videoId, kind: "EDIT" },
      update: data,
    });
  } else {
    await db.transcript.create({ data: { ...data, kind: "RAW" } });
  }
  refresh();
}

export async function deleteTranscript(id: string) {
  await requireUser();
  await db.transcript.delete({ where: { id } });
  refresh();
}

export async function saveVideoQa(videoId: string, issues: { time: number; seen: string; issue: string; suggestion: string }[]) {
  await requireUser();
  await db.video.update({ where: { id: videoId }, data: { aiQa: issues as Prisma.InputJsonValue, aiQaAt: new Date() } });
  refresh();
}

/* ───────────────────────── thumbnails ───────────────────────── */

export async function setCover(projectId: string, url: string | null) {
  await requireUser();
  await db.project.update({ where: { id: projectId }, data: { coverUrl: url } });
  refresh();
}
