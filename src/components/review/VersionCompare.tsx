"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle, Minus, Pause, Play, Plus, Volume2 } from "lucide-react";
import { resolveComment } from "@/lib/actions";
import { cn, fmtTime } from "@/lib/utils";
import { Avatar } from "../ui";
import { CommentText, type MentionUser } from "../MentionInput";
import { DrawLayer, type Stroke } from "./DrawLayer";

type V = { id: string; version: number; name: string; url: string };
type Note = { id: string; body: string; timestamp: number | null; resolved: boolean; drawing: Stroke[] | null; author: MentionUser };

export function VersionCompare({
  project,
  versions,
  older,
  newer,
  notes,
}: {
  project: { id: string; title: string };
  versions: { id: string; version: number }[];
  older: V;
  newer: V;
  notes: Note[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const a = useRef<HTMLVideoElement>(null); // older
  const b = useRef<HTMLVideoElement>(null); // newer (master clock)
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audio, setAudio] = useState<"a" | "b">("b");
  const [offset, setOffset] = useState(0); // seconds the old version runs ahead (+) of the new one
  const [active, setActive] = useState<string | null>(null);
  const [local, setLocal] = useState(notes);
  useEffect(() => setLocal(notes), [notes]);

  const seek = useCallback(
    (t: number) => {
      if (!a.current || !b.current) return;
      b.current.currentTime = Math.max(0, t);
      a.current.currentTime = Math.max(0, t + offset);
      setTime(Math.max(0, t));
    },
    [offset],
  );

  const toggle = useCallback(() => {
    const va = a.current;
    const vb = b.current;
    if (!va || !vb) return;
    if (vb.paused) {
      va.currentTime = Math.max(0, vb.currentTime + offset);
      vb.play().catch(() => {});
      va.play().catch(() => {});
    } else {
      vb.pause();
      va.pause();
    }
  }, [offset]);

  // keep the old version locked to the new one
  useEffect(() => {
    const id = setInterval(() => {
      const va = a.current;
      const vb = b.current;
      if (!va || !vb || vb.paused) return;
      const want = vb.currentTime + offset;
      if (want <= va.duration && Math.abs(va.currentTime - want) > 0.12) va.currentTime = want;
    }, 400);
    return () => clearInterval(id);
  }, [offset]);

  useEffect(() => {
    if (a.current) a.current.muted = audio !== "a";
    if (b.current) b.current.muted = audio !== "b";
  }, [audio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === " ") (e.preventDefault(), toggle());
      if (e.key === "ArrowLeft") seek(time - 2);
      if (e.key === "ArrowRight") seek(time + 2);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, time]);

  const nudge = (d: number) => {
    const next = Math.round((offset + d) * 10) / 10;
    setOffset(next);
    if (a.current && b.current) a.current.currentTime = Math.max(0, b.current.currentTime + next);
  };

  const activeNote = local.find((n) => n.id === active);
  const open = local.filter((n) => !n.resolved).length;

  const pane = (v: V, ref: React.RefObject<HTMLVideoElement | null>, side: "a" | "b") => (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <span>
          <span className="font-semibold">v{v.version}</span> <span className="text-muted">{side === "a" ? "previous" : "new"}</span>
        </span>
        <button
          onClick={() => setAudio(side)}
          className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1", audio === side ? "bg-hover text-ink" : "text-muted hover:text-ink")}
        >
          <Volume2 className="h-3.5 w-3.5" /> {audio === side ? "Audio on" : "Listen"}
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={toggle}>
        <video
          ref={ref}
          src={v.url}
          playsInline
          preload="metadata"
          muted={audio !== side}
          className="max-h-full max-w-full"
          {...(side === "b"
            ? {
                onPlay: () => setPlaying(true),
                onPause: () => setPlaying(false),
                onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => setTime(e.currentTarget.currentTime),
                onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => setDuration(e.currentTarget.duration),
                onEnded: () => a.current?.pause(),
              }
            : {})}
        />
        {side === "a" && activeNote?.drawing?.length ? (
          <DrawLayer videoRef={ref} strokes={activeNote.drawing} drawing={false} color="#fff" />
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
          <Link href={`/projects/${project.id}`} className="truncate text-muted hover:text-ink">
            {project.title}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="font-medium">Compare versions</span>
        </div>
        <select
          className="input w-auto py-1 text-xs"
          value={older.id}
          onChange={(e) => router.push(`/projects/${project.id}/compare?a=${e.target.value}&b=${newer.id}`)}
        >
          {versions.filter((v) => v.id !== newer.id).map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">vs</span>
        <select
          className="input w-auto py-1 text-xs"
          value={newer.id}
          onChange={(e) => router.push(`/projects/${project.id}/compare?a=${older.id}&b=${e.target.value}`)}
        >
          {versions.filter((v) => v.id !== older.id).map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version}
            </option>
          ))}
        </select>
        <Link href={`/projects/${project.id}/videos/${newer.id}`} className="btn">
          Back to review
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="scheme-dark flex min-h-[50vh] min-w-0 flex-1 flex-col bg-black">
          <div className="flex min-h-0 flex-1 divide-x divide-white/10">
            {pane(older, a, "a")}
            {pane(newer, b, "b")}
          </div>
          <div className="border-t border-line bg-solid px-4 pb-3 pt-3">
            <div
              className="group relative h-5 cursor-pointer"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - r.left) / r.width) * duration);
              }}
            >
              <div className="absolute inset-x-0 top-1 h-1.5 rounded bg-zinc-700">
                <div className="h-full rounded bg-zinc-200" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
              </div>
              {local
                .filter((n) => n.timestamp != null)
                .map((n) => (
                  <span
                    key={n.id}
                    title={n.body}
                    className={cn("absolute top-0 h-3.5 w-1 -translate-x-1/2 rounded-full", n.resolved ? "bg-green-500" : "bg-amber-400")}
                    style={{ left: `${duration ? ((n.timestamp! - offset) / duration) * 100 : 0}%` }}
                  />
                ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={toggle} className="text-zinc-200" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>
              <span className="font-mono text-xs text-zinc-300">
                {fmtTime(time)} / {fmtTime(duration)}
              </span>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted" title="If the new cut is shorter or longer, shift the old version so both show the same moment">
                Old version offset
                <button className="btn-ghost p-1" onClick={() => nudge(-0.5)}>
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-10 text-center font-mono text-zinc-300">{offset > 0 ? "+" : ""}{offset.toFixed(1)}s</span>
                <button className="btn-ghost p-1" onClick={() => nudge(0.5)}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col border-l border-line lg:w-[360px]">
          <div className="border-b border-line px-4 py-3">
            <div className="text-xs font-semibold">Notes from v{older.version}</div>
            <div className="text-[11px] text-muted">
              {open ? `${open} still to confirm — click a note to jump both videos there, tick it when it's fixed.` : "Every note is ticked off."}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {local.length === 0 && <p className="p-4 text-xs text-muted">No notes were left on v{older.version}.</p>}
            {local.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  setActive(n.id);
                  if (n.timestamp != null) {
                    b.current?.pause();
                    a.current?.pause();
                    seek(n.timestamp - offset);
                  }
                }}
                className={cn("flex cursor-pointer gap-2.5 border-b border-line px-4 py-3 hover:bg-hover/60", active === n.id && "bg-hover/60", n.resolved && "opacity-60")}
              >
                <button
                  title={n.resolved ? "Mark not fixed" : "Mark fixed"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocal((l) => l.map((x) => (x.id === n.id ? { ...x, resolved: !x.resolved } : x)));
                    start(() => resolveComment(n.id, !n.resolved));
                  }}
                >
                  {n.resolved ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-zinc-500 hover:text-green-500" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Avatar name={n.author.name} color={n.author.color} size={16} className="ring-0" />
                    <span className="text-xs font-semibold">{n.author.name}</span>
                    {n.timestamp != null && <span className="font-mono text-xs text-sky-400">{fmtTime(n.timestamp)}</span>}
                  </div>
                  <div className={cn("mt-0.5 text-[13px]", n.resolved && "line-through decoration-zinc-500")}>
                    <CommentText text={n.body} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
