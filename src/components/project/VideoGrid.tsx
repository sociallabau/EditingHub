"use client";

import Link from "next/link";
import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, MessageSquare, Trash2, Film } from "lucide-react";
import { deleteVideo } from "@/lib/actions";
import { Menu, MenuItem } from "../ui";
import { STATUS_ICON } from "./ProjectNav";

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

export type GridVideo = {
  id: string;
  name: string;
  version: number;
  status: string;
  thumbnailUrl: string | null;
  createdAt: string;
  uploadedBy: string;
  openComments: number;
};

export function VideoGrid({ projectId, videos }: { projectId: string; videos: GridVideo[] }) {
  const [, start] = useTransition();
  if (!videos.length) return <p className="text-xs text-muted">No edits uploaded yet.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {videos.map((v) => (
        <div key={v.id} className="overflow-hidden rounded-lg border border-line bg-card">
          <Link href={`/projects/${projectId}/videos/${v.id}`} className="relative block aspect-video bg-black">
            {v.thumbnailUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnailUrl} alt="" className="relative mx-auto h-full object-contain" />
              </>
            ) : (
              <Film className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-zinc-600" />
            )}
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px]">
              {STATUS_ICON[v.status]} {STATUS_LABEL[v.status]}
            </span>
            <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold">v{v.version}</span>
          </Link>
          <div className="flex items-start gap-2 p-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{v.name}</div>
              <div className="text-[11px] text-muted">
                {v.uploadedBy} · {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
              </div>
            </div>
            {v.openComments > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                <MessageSquare className="h-3 w-3" /> {v.openComments}
              </span>
            )}
            <Menu
              align="right"
              width={160}
              trigger={() => (
                <button className="btn-ghost p-1">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              )}
            >
              {(close) => (
                <MenuItem
                  danger
                  onClick={() => {
                    close();
                    if (confirm(`Delete "${v.name}" and all its review comments?`)) start(() => deleteVideo(v.id));
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete video
                </MenuItem>
              )}
            </Menu>
          </div>
        </div>
      ))}
    </div>
  );
}
