"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTransition } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Info,
  FolderOpen,
  FileText,
  Film,
  Plus,
  Calendar,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  History,
  Image as ImageIcon,
  Sparkles,
  Archive,
} from "lucide-react";
import { createPage, updateProject } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Menu, MenuItem, StageDot } from "../ui";

type NavProject = {
  id: string;
  title: string;
  archived: boolean;
  stageId: string;
  dueDate: string | null;
  thumb: string | null;
  thumbCount: number;
  sections: { key: string; title: string; count: number }[];
  pages: { id: string; title: string }[];
  videos: { id: string; name: string; version: number; status: string }[];
};

export const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <CircleDashed className="h-3.5 w-3.5 text-zinc-400" />,
  CHANGES_REQUESTED: <AlertCircle className="h-3.5 w-3.5 text-orange-400" />,
  APPROVED: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
};

export function ProjectNav({ project: p, stages }: { project: NavProject; stages: { id: string; name: string; color: string }[] }) {
  const path = usePathname();
  const tab = useSearchParams().get("tab") ?? "overview";
  const router = useRouter();
  const [, start] = useTransition();
  const base = `/projects/${p.id}`;
  const stage = stages.find((s) => s.id === p.stageId);
  const onBase = path === base;

  const item = (href: string, active: boolean, icon: React.ReactNode, label: React.ReactNode, extra?: React.ReactNode, indent = false) => (
    <Link
      key={href}
      href={href}
      prefetch
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-zinc-300 hover:bg-hover",
        active && "bg-hover text-zinc-50",
        indent && "ml-3 border-l border-line pl-3",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {extra}
    </Link>
  );

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel p-3 lg:flex">
      <Link href={p.archived ? "/projects/archived" : "/projects"} className="btn-ghost mb-2 self-start px-1.5">
        <ArrowLeft className="h-3.5 w-3.5" /> {p.archived ? "Archived" : "Projects"}
      </Link>
      {p.thumb && (
        <div className="relative mb-3 aspect-video overflow-hidden rounded-lg border border-line bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumb} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumb} alt="" className="relative mx-auto h-full object-contain" />
        </div>
      )}
      {p.archived && (
        <div className="mb-2 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300">
          <Archive className="h-3.5 w-3.5" /> Archived project
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Menu
          width={210}
          trigger={() => (
            <button className="chip hover:bg-hover">
              <StageDot color={stage?.color ?? "#666"} /> {stage?.name}
            </button>
          )}
        >
          {(close) =>
            stages.map((s) => (
              <MenuItem
                key={s.id}
                active={s.id === p.stageId}
                onClick={() => {
                  close();
                  start(() => updateProject(p.id, { stageId: s.id }));
                }}
              >
                <StageDot color={s.color} /> {s.name}
              </MenuItem>
            ))
          }
        </Menu>
        <label className="chip relative cursor-pointer hover:bg-hover">
          <Calendar className="h-3.5 w-3.5 text-muted" />
          {p.dueDate ? format(new Date(p.dueDate), "do MMM yyyy") : "Not Scheduled"}
          <input
            type="date"
            className="absolute inset-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full"
            value={p.dueDate ? p.dueDate.slice(0, 10) : ""}
            onChange={(e) => start(() => updateProject(p.id, { dueDate: e.target.value || null }))}
            title="Due date"
          />
        </label>
      </div>

      <div className="mb-3 flex gap-1" title={`Stage ${stages.findIndex((s) => s.id === p.stageId) + 1} of ${stages.length}: ${stage?.name}`}>
        {stages.map((s, i) => (
          <span
            key={s.id}
            className={cn("h-1 flex-1 rounded-full", i <= stages.findIndex((x) => x.id === p.stageId) ? "bg-accent shadow-[0_0_8px_var(--eh-glow)]" : "bg-hover")}
          />
        ))}
      </div>

      <nav className="space-y-0.5">
        {item(base, onBase && tab === "overview", <Info className="h-4 w-4 text-muted" />, "Overview")}

        <div className="flex items-center justify-between px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Footage & Assets
        </div>
        {p.sections.map((s) =>
          item(
            `${base}?tab=section-${s.key}`,
            onBase && tab === `section-${s.key}`,
            <FolderOpen className="h-4 w-4 text-muted" />,
            s.title,
            <span className="text-[11px] text-muted">{s.count || ""}</span>,
          ),
        )}

        {item(
          `${base}?tab=thumbnails`,
          onBase && tab === "thumbnails",
          <ImageIcon className="h-4 w-4 text-muted" />,
          "Thumbnails",
          <span className="text-[11px] text-muted">{p.thumbCount || ""}</span>,
        )}

        <div className="flex items-center justify-between px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Pages
          <button
            title="Add page"
            className="rounded p-0.5 hover:bg-hover hover:text-zinc-200"
            onClick={() =>
              start(async () => {
                const id = await createPage(p.id);
                router.push(`${base}?tab=page-${id}`);
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {p.pages.map((pg) =>
          item(`${base}?tab=page-${pg.id}`, onBase && tab === `page-${pg.id}`, <FileText className="h-4 w-4 text-muted" />, pg.title || "Untitled"),
        )}
        {item(`${base}?tab=ai-brief`, onBase && tab === "ai-brief", <Sparkles className="h-4 w-4 text-accent" />, "AI Brief")}

        <div className="flex items-center justify-between px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Edited Video
          <Link href={`${base}?tab=videos`} title="Upload edit" className="rounded p-0.5 hover:bg-hover hover:text-zinc-200">
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>
        {item(`${base}?tab=videos`, onBase && tab === "videos", <Film className="h-4 w-4 text-muted" />, "All versions", <span className="text-[11px] text-muted">{p.videos.length || ""}</span>)}
        {p.videos.map((v) =>
          item(
            `${base}/videos/${v.id}`,
            path === `${base}/videos/${v.id}`,
            STATUS_ICON[v.status],
            <>
              <span className="mr-1 text-muted">v{v.version}</span>
              {v.name}
            </>,
            undefined,
            true,
          ),
        )}

        <div className="pt-3" />
        {item(`${base}?tab=activity`, onBase && tab === "activity", <History className="h-4 w-4 text-muted" />, "Activity")}
      </nav>
    </aside>
  );
}
