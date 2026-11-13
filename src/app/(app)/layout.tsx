import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await db.notification.count({ where: { userId: user.id, read: false } });
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={{ name: user.name, color: user.color, role: user.role, email: user.email }} unread={unread} />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
