"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, FolderKanban, Archive, Building2, LayoutTemplate, Users, Columns3, LogOut, KeyRound } from "lucide-react";
import { logout } from "@/lib/actions";
import { cn, ROLE_LABEL } from "@/lib/utils";
import { Avatar, Menu, MenuItem } from "./ui";

export function Sidebar({
  user,
  unread: initialUnread,
}: {
  user: { name: string; color: string; role: string; email: string };
  unread: number;
}) {
  const path = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const last = useRef(initialUnread);
  useEffect(() => setUnread(initialUnread), [initialUnread]);

  // Poll for new notifications so people see them without refreshing.
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/notifications", { cache: "no-store" });
        if (!r.ok) return;
        const { unread: n } = await r.json();
        setUnread(n);
        if (n > last.current) router.refresh();
        last.current = n;
      } catch {}
    };
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [router]);

  const manager = user.role === "ADMIN" || user.role === "ACCOUNT_MANAGER";
  const nav = [
    { href: "/notifications", label: "Notifications", icon: Bell, badge: unread },
    { href: "/projects", label: "Projects", icon: FolderKanban, exact: true },
    { href: "/projects/archived", label: "Archived", icon: Archive },
    { href: "/clients", label: "Clients", icon: Building2 },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    ...(manager ? [{ href: "/settings/board", label: "Board Columns", icon: Columns3 }] : []),
    ...(user.role === "ADMIN" ? [{ href: "/team", label: "Team", icon: Users }] : []),
  ];
  const isActive = (href: string, exact?: boolean) =>
    exact ? path === href || (path.startsWith("/projects/") && !path.startsWith("/projects/archived")) : path.startsWith(href);

  return (
    <aside className="flex w-[52px] shrink-0 flex-col border-r border-line bg-panel md:w-[200px]">
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
          <svg viewBox="0 0 32 32" className="h-4 w-4"><path d="M12 9l11 7-11 7z" fill="#fff" /></svg>
        </div>
        <span className="hidden text-sm font-semibold md:inline">Editing Hub</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-zinc-400 hover:bg-hover hover:text-zinc-100",
              isActive(n.href, n.exact) && "bg-hover text-zinc-100",
            )}
          >
            <n.icon className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{n.label}</span>
            {!!n.badge && (
              <span className="absolute left-5 top-0.5 rounded-full bg-accent px-1 text-[9px] font-bold leading-[14px] text-white md:static md:ml-auto md:px-1.5 md:text-[10px] md:leading-4">
                {n.badge > 99 ? "99+" : n.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="border-t border-line p-2">
        <Menu
          width={200}
          trigger={() => (
            <button className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-hover">
              <Avatar name={user.name} color={user.color} size={24} />
              <span className="hidden min-w-0 md:block">
                <span className="block truncate text-xs font-medium">{user.name}</span>
                <span className="block truncate text-[11px] text-muted">{ROLE_LABEL[user.role]}</span>
              </span>
            </button>
          )}
        >
          {() => (
            <>
              <div className="px-2 py-1.5 text-[11px] text-muted">{user.email}</div>
              <MenuItem onClick={() => router.push("/account")}>
                <KeyRound className="h-3.5 w-3.5" /> Change password
              </MenuItem>
              <MenuItem danger onClick={() => logout()}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </aside>
  );
}
