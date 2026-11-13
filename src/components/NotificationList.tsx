"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

type Item = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  actor: { name: string; color: string } | null;
  href: string | null;
};

export function NotificationList({ items, filter }: { items: Item[]; filter: "all" | "unread" }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <h1 className="page-title">Notifications</h1>
        <button className="btn-ghost" onClick={() => start(() => markAllNotificationsRead())}>
          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
        </button>
      </header>
      <div className="flex gap-1 px-4 py-2">
        {(["all", "unread"] as const).map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/notifications" : "/notifications?filter=unread"}
            className={cn("rounded-md px-2.5 py-1 text-xs capitalize", filter === f ? "bg-hover text-zinc-100" : "text-muted hover:text-zinc-200")}
          >
            {f}
          </Link>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mx-auto max-w-3xl divide-y divide-line rounded-lg border border-line">
          {items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-xs text-muted">
              <Bell className="h-5 w-5" /> You&apos;re all caught up.
            </div>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.read) start(() => markNotificationRead(n.id));
                if (n.href) router.push(n.href);
              }}
              className={cn("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-panel", !n.read && "bg-panel/60")}
            >
              {n.actor ? <Avatar name={n.actor.name} color={n.actor.color} size={26} /> : <Bell className="h-5 w-5 text-muted" />}
              <div className="min-w-0 flex-1">
                <div className={cn("text-[13px]", n.read ? "text-zinc-400" : "text-zinc-100")}>{n.message}</div>
                <div className="mt-0.5 text-[11px] text-muted">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</div>
              </div>
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
