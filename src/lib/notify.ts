import "server-only";
import { db } from "./db";

/**
 * Log an activity on a project and notify everyone tagged on it (except the person who did it),
 * plus any extra users (e.g. @mentioned people).
 */
export async function logAndNotify(opts: {
  projectId: string;
  actorId: string;
  message: string;
  videoId?: string;
  extraUserIds?: string[];
  notify?: boolean;
}) {
  const { projectId, actorId, message, videoId, extraUserIds = [], notify = true } = opts;
  await db.activity.create({ data: { projectId, actorId, message } });
  if (!notify) return;
  const members = await db.projectMember.findMany({ where: { projectId }, select: { userId: true } });
  const recipients = new Set([...members.map((m) => m.userId), ...extraUserIds]);
  recipients.delete(actorId);
  if (recipients.size === 0) return;
  await db.notification.createMany({
    data: [...recipients].map((userId) => ({ userId, actorId, projectId, videoId, message })),
  });
}

/** Find users @mentioned in text by first name or full name ("@Michal", "@Jai Smith"). */
export async function findMentions(text: string) {
  if (!text.includes("@")) return [];
  const users = await db.user.findMany({ where: { active: true }, select: { id: true, name: true } });
  const lower = text.toLowerCase();
  return users
    .filter((u) => {
      const full = u.name.toLowerCase();
      const first = full.split(" ")[0];
      return lower.includes("@" + full) || new RegExp(`@${escape(first)}\\b`).test(lower);
    })
    .map((u) => u.id);
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
