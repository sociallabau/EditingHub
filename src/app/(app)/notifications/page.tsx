import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationList } from "@/components/NotificationList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const items = await db.notification.findMany({
    where: { userId: user.id, ...(filter === "unread" ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { actor: { select: { name: true, color: true } } },
  });
  return (
    <NotificationList
      filter={filter === "unread" ? "unread" : "all"}
      items={items.map((n) => ({
        id: n.id,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        actor: n.actor,
        href: n.videoId && n.projectId ? `/projects/${n.projectId}/videos/${n.videoId}` : n.projectId ? `/projects/${n.projectId}` : null,
      }))}
    />
  );
}
