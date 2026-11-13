"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ChevronRight,
  Clock,
  SendHorizonal,
  CheckCircle2,
  Circle,
  Trash2,
  Download,
  ArrowUpDown,
  AlertCircle,
  Check,
  Upload,
  Pencil,
  Undo2,
  Columns2,
  X,
} from "lucide-react";
import { addComment, deleteComment, resolveComment, setVideoDuration, setVideoStatus } from "@/lib/actions";
import { cn, fmtTime } from "@/lib/utils";
import { Avatar, Menu, MenuItem } from "../ui";
import { CommentText, MentionInput, type MentionInputHandle, type MentionUser } from "../MentionInput";
import { STATUS_ICON } from "../project/ProjectNav";
import { STATUS_LABEL } from "../project/VideoGrid";
import { DrawLayer, PEN_COLORS, type Stroke } from "./DrawLayer";
import { TranscriptTab } from "./TranscriptTab";
import { AiCheckTab, type QaIssue } from "./AiCheckTab";
import type { Segment } from "@/lib/transcribe";

type ReviewComment = {
  id: string;
  body: string;
  timestamp: number | null;
  resolved: boolean;
  parentId: string | null;
  createdAt: string;
  author: MentionUser;
  drawing: Stroke[] | null;
};

type Status = "PENDING" | "CHANGES_REQUESTED" | "APPROVED";
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export function VideoReview({
  me,
  users,
  project,
  versions,
  video,
  comments,
  transcript,
  aiQa,
  aiQaAt,
}: {
  me: { id: string; role: string };
  users: MentionUser[];
  project: { id: string; title: string };
  versions: { id: string; version: number; name: string; status: string }[];
  video: {
    id: string;
    name: string;
    url: string;
    version: number;
    status: string;
    contentType: string | null;
    duration: number | null;
    uploadedBy: string;
    createdAt: string;
  };
  comments: ReviewComment[];
  transcript: Segment[] | null;
  aiQa: QaIssue[] | null;
  aiQaAt: string | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<MentionInputHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(video.duration ?? 0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [playError, setPlayError] = useState(false);
  const [hoverMarker, setHoverMarker] = useState<string | null>(null);

  const [body, setBody] = useState("");
  const [stampOn, setStampOn] = useState(true);
  const [stamp, setStamp] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sort, setSort] = useState<"timestamp" | "newest">("timestamp");
  const [showResolved, setShowResolved] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);
  const [tab, setTab] = useState<"feedback" | "transcript" | "ai">("feedback");
  const [drawMode, setDrawMode] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [draft, setDraft] = useState<Stroke[]>([]);
  const [local, setLocal] = useState(comments);
  useEffect(() => setLocal(comments), [comments]);
  // until someone starts typing, the comment timestamp follows the playhead
  useEffect(() => {
    if (!body) setStamp(time);
  }, [time, body]);

  const roots = useMemo(() => {
    const r = local.filter((c) => !c.parentId && (showResolved || !c.resolved));
    return r.sort((a, b) =>
      sort === "timestamp"
        ? (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity) || a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    );
  }, [local, sort, showResolved]);
  const replies = (id: string) => local.filter((c) => c.parentId === id);
  const markers = local.filter((c) => !c.parentId && c.timestamp != null);
  const openCount = local.filter((c) => !c.parentId && !c.resolved).length;

  const seek = useCallback((t: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
    setTime(v.currentTime);
  }, []);

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  // keyboard shortcuts (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable) return;
      const v = ref.current;
      if (!v) return;
      if (e.key === " " || e.key === "k") (e.preventDefault(), toggle());
      else if (e.key === "ArrowLeft") (e.preventDefault(), seek(v.currentTime - 5));
      else if (e.key === "ArrowRight") (e.preventDefault(), seek(v.currentTime + 5));
      else if (e.key === ",") (v.pause(), seek(v.currentTime - 1 / 30));
      else if (e.key === ".") (v.pause(), seek(v.currentTime + 1 / 30));
      else if (e.key === "c") (e.preventDefault(), input.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek]);

  const onComposerFocus = () => {
    const v = ref.current;
    if (v) {
      v.pause();
      setStamp(v.currentTime);
    }
  };

  const send = () => {
    const text = body.trim() || (draft.length ? "See drawing" : "");
    if (!text) return;
    const ts = stampOn || draft.length ? stamp : null;
    const drawing = draft.length ? draft : null;
    setDraft([]);
    setDrawMode(false);
    const optimistic: ReviewComment = {
      id: `tmp-${Date.now()}`,
      body: text,
      timestamp: ts,
      resolved: false,
      parentId: null,
      drawing,
      createdAt: new Date().toISOString(),
      author: users.find((u) => u.id === me.id) ?? { id: me.id, name: "You", color: "#666" },
    };
    setLocal((l) => [...l, optimistic]);
    setBody("");
    start(() => addComment({ projectId: project.id, videoId: video.id, body: text, timestamp: ts, drawing }));
  };

  const sendReply = (parentId: string) => {
    const text = replyBody.trim();
    if (!text) return;
    setReplyBody("");
    setReplyTo(null);
    start(() => addComment({ projectId: project.id, videoId: video.id, parentId, body: text }));
  };

  const changeStatus = (s: Status) => {
    if (s === "APPROVED" && openCount > 0 && !confirm(`There are ${openCount} unresolved notes. Approve anyway?`)) return;
    start(() => setVideoStatus(video.id, s));
  };

  // strokes to show: the draft while drawing, otherwise any note pinned at (or selected for) this moment
  const shownStrokes = drawMode || draft.length
    ? draft
    : local
        .filter((c) => c.drawing?.length && (c.id === focused ? Math.abs((c.timestamp ?? -9) - time) < 1.5 : Math.abs((c.timestamp ?? -9) - time) < 0.4))
        .flatMap((c) => c.drawing!);
  const prev = versions.find((v) => v.version === video.version - 1);

  const toggleDraw = () => {
    const v = ref.current;
    if (!drawMode && v) {
      v.pause();
      setStamp(v.currentTime);
      setStampOn(true);
      setTab("feedback");
    }
    setDrawMode((d) => !d);
  };

  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);
  const canReview = me.role === "ADMIN" || me.role === "ACCOUNT_MANAGER" || me.role === "EDITOR";

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
          <Link href={`/projects/${project.id}`} className="truncate text-muted hover:text-zinc-100">
            {project.title}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate font-medium">{video.name}</span>
        </div>
        {versions.length > 1 && (
          <Menu
            align="right"
            width={240}
            trigger={() => (
              <button className="btn">
                v{video.version} <span className="text-muted">of {versions.length}</span>
              </button>
            )}
          >
            {(close) =>
              versions.map((v) => (
                <MenuItem key={v.id} active={v.id === video.id} onClick={() => (close(), router.push(`/projects/${project.id}/videos/${v.id}`))}>
                  {STATUS_ICON[v.status]} <span className="font-semibold">v{v.version}</span>
                  <span className="truncate text-muted">{v.name}</span>
                </MenuItem>
              ))
            }
          </Menu>
        )}
        {prev && (
          <Link href={`/projects/${project.id}/compare?a=${prev.id}&b=${video.id}`} className="btn" title="Compare with the previous version">
            <Columns2 className="h-3.5 w-3.5" /> Compare v{prev.version}
          </Link>
        )}
        <Link href={`/projects/${project.id}?tab=videos`} className="btn" title="Upload a new version">
          <Upload className="h-3.5 w-3.5" /> New version
        </Link>
        <a href={video.url} download={video.name} target="_blank" rel="noreferrer" className="btn" title="Download">
          <Download className="h-3.5 w-3.5" />
        </a>
        <Menu
          align="right"
          width={200}
          trigger={() => (
            <button className="btn">
              {STATUS_ICON[video.status]} {STATUS_LABEL[video.status]}
            </button>
          )}
        >
          {(close) =>
            (["PENDING", "CHANGES_REQUESTED", "APPROVED"] as Status[]).map((s) => (
              <MenuItem key={s} active={video.status === s} onClick={() => (close(), changeStatus(s))}>
                {STATUS_ICON[s]} {STATUS_LABEL[s]}
              </MenuItem>
            ))
          }
        </Menu>
        {canReview && video.status !== "APPROVED" && (
          <>
            <button className="btn text-orange-300" onClick={() => changeStatus("CHANGES_REQUESTED")}>
              <AlertCircle className="h-3.5 w-3.5" /> Request changes
            </button>
            <button className="btn-primary bg-green-600" onClick={() => changeStatus("APPROVED")}>
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
          </>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* player */}
        <div ref={wrap} className="scheme-dark flex min-h-[50vh] min-w-0 flex-1 flex-col bg-black">
          <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={() => !drawMode && toggle()}>
            <video
              ref={ref}
              src={video.url}
              className="max-h-full max-w-full"
              playsInline
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d)) {
                  setDuration(d);
                  if (!video.duration) setVideoDuration(video.id, d);
                }
              }}
              onError={() => setPlayError(true)}
            />
            <DrawLayer videoRef={ref} strokes={shownStrokes} drawing={drawMode} color={penColor} onChange={setDraft} />
            {drawMode && (
              <div
                className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-panel/95 px-3 py-1.5 text-xs shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-muted">Draw on the frame</span>
                {PEN_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setPenColor(c)}
                    className={cn("h-4 w-4 rounded-full border border-black/40", penColor === c && "ring-2 ring-white ring-offset-1 ring-offset-black")}
                    style={{ background: c }}
                    aria-label={`Pen colour ${c}`}
                  />
                ))}
                <button className="btn-ghost p-1" title="Undo" onClick={() => setDraft((d) => d.slice(0, -1))}>
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button className="btn-ghost p-1" title="Cancel drawing" onClick={() => (setDraft([]), setDrawMode(false))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {playError && (
              <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-lg bg-zinc-900/95 p-4 text-center text-[13px]">
                This browser can&apos;t play this file — it&apos;s probably a ProRes/HEVC .mov. Download it, or re-export as an H.264 .mp4 for review.
              </div>
            )}
            {!playing && !playError && !drawMode && shownStrokes.length === 0 && (
              <div className="pointer-events-none absolute flex h-14 w-14 items-center justify-center rounded-full bg-black/50">
                <Play className="ml-1 h-6 w-6 fill-white" />
              </div>
            )}
          </div>

          {/* timeline with comment markers */}
          <div className="border-t border-line bg-panel px-4 pb-2 pt-3">
            <div
              className="group relative h-6 cursor-pointer"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - r.left) / r.width) * duration);
              }}
            >
              <div className="absolute inset-x-0 top-1 h-1.5 rounded bg-zinc-700">
                <div className="h-full rounded bg-zinc-200" style={{ width: `${pct(time)}%` }} />
              </div>
              <div className="absolute top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white opacity-0 shadow group-hover:opacity-100" style={{ left: `${pct(time)}%` }} />
              {markers.map((c) => (
                <button
                  key={c.id}
                  className="absolute top-3.5 -translate-x-1/2"
                  style={{ left: `${pct(c.timestamp!)}%` }}
                  onMouseEnter={() => setHoverMarker(c.id)}
                  onMouseLeave={() => setHoverMarker(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    seek(c.timestamp!);
                    setFocused(c.id);
                    document.getElementById(`c-${c.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  }}
                >
                  <Avatar name={c.author.name} color={c.resolved ? "#3f3f46" : c.author.color} size={14} className="ring-1" />
                  {hoverMarker === c.id && (
                    <div className="absolute bottom-6 left-1/2 z-10 w-60 -translate-x-1/2 rounded-lg border border-line bg-card p-2.5 text-left shadow-xl">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-semibold">{c.author.name}</span>
                        <span className="text-[11px] text-sky-400">{fmtTime(c.timestamp!)}</span>
                      </div>
                      <div className="mt-0.5 line-clamp-3 text-xs text-zinc-300">{c.body}</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={toggle} className="text-zinc-200 hover:text-white" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>
              <button
                onClick={() => {
                  const v = ref.current!;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                }}
                className="text-zinc-300 hover:text-white"
              >
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = ref.current!;
                  v.volume = Number(e.target.value);
                  v.muted = false;
                  setMuted(false);
                  setVolume(v.volume);
                }}
                className="w-20 accent-[var(--color-accent)]"
              />
              <span className="font-mono text-xs text-zinc-300">
                {fmtTime(time)} / {fmtTime(duration)}
              </span>
              <div className="ml-auto flex items-center gap-3">
                <button
                  className="text-xs font-medium text-zinc-300 hover:text-white"
                  onClick={() => {
                    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
                    ref.current!.playbackRate = next;
                    setSpeed(next);
                  }}
                  title="Playback speed"
                >
                  {speed}x
                </button>
                <button
                  className="text-zinc-300 hover:text-white"
                  onClick={() => (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen())}
                  title="Fullscreen"
                >
                  <Maximize className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-1.5 hidden text-[10.5px] text-zinc-600 md:block">
              Space play/pause · ←/→ 5s · , / . frame step · C comment
            </div>
          </div>
        </div>

        {/* comments */}
        <aside className="flex w-full shrink-0 flex-col border-l border-line lg:w-[380px]">
          <div className="flex items-center gap-1 border-b border-line px-3 pt-2">
            {(
              [
                ["feedback", `Feedback${openCount ? ` · ${openCount}` : ""}`],
                ["transcript", "Transcript"],
                ["ai", `AI check${aiQa?.length ? ` · ${aiQa.length}` : ""}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "-mb-px border-b-2 px-2.5 pb-2 pt-1 text-xs font-medium transition-colors",
                  tab === k ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={tab === "transcript" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <TranscriptTab
              projectId={project.id}
              videoId={video.id}
              videoUrl={video.url}
              videoName={video.name}
              segments={transcript}
              time={time}
              onSeek={seek}
            />
          </div>
          {tab === "ai" && (
            <AiCheckTab
              projectId={project.id}
              videoId={video.id}
              videoUrl={video.url}
              issues={aiQa}
              checkedAt={aiQaAt}
              hasTranscript={!!transcript}
              onSeek={seek}
            />
          )}
          {tab === "feedback" && (
          <>
          <div className="flex items-center justify-end border-b border-line px-3 py-1.5">
            <div className="flex items-center gap-1">
              <button className="btn-ghost" onClick={() => setShowResolved((s) => !s)}>
                {showResolved ? "Hide resolved" : "Show resolved"}
              </button>
              <button className="btn-ghost" onClick={() => setSort((s) => (s === "timestamp" ? "newest" : "timestamp"))}>
                <ArrowUpDown className="h-3.5 w-3.5" /> {sort === "timestamp" ? "Timestamp" : "Newest"}
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto">
            {roots.length === 0 && (
              <p className="p-4 text-xs text-muted">
                No feedback yet. Pause on a moment and leave a note — it&apos;s pinned to that timestamp so the editor can jump straight to it.
              </p>
            )}
            {roots.map((c) => {
              const active = c.timestamp != null && Math.abs(c.timestamp - time) < 0.75 && !playing ? true : focused === c.id;
              return (
                <div
                  id={`c-${c.id}`}
                  key={c.id}
                  className={cn("group border-b border-line px-4 py-3", active && "bg-hover/60", c.resolved && "opacity-60")}
                >
                  <div className="flex gap-2.5">
                    <Avatar name={c.author.name} color={c.author.color} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[13px] font-semibold">{c.author.name}</span>
                        <span className="text-[11px] text-muted">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          <button
                            title={c.resolved ? "Mark unresolved" : "Mark resolved"}
                            onClick={() => {
                              setLocal((l) => l.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x)));
                              start(() => resolveComment(c.id, !c.resolved));
                            }}
                          >
                            {c.resolved ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-zinc-500 hover:text-green-500" />}
                          </button>
                          {(c.author.id === me.id || me.role === "ADMIN" || me.role === "ACCOUNT_MANAGER") && !c.id.startsWith("tmp-") && (
                            <button
                              className="opacity-0 group-hover:opacity-100"
                              title="Delete"
                              onClick={() => confirm("Delete this comment?") && start(() => deleteComment(c.id))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted hover:text-red-400" />
                            </button>
                          )}
                        </span>
                      </div>
                      {c.timestamp != null && (
                        <button
                          className="font-mono text-xs text-sky-400 hover:underline"
                          onClick={() => {
                            seek(c.timestamp!);
                            setFocused(c.id);
                          }}
                        >
                          {fmtTime(c.timestamp)}
                        </button>
                      )}
                      {c.drawing?.length ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-ink">
                          <Pencil className="h-2.5 w-2.5" /> drawing
                        </span>
                      ) : null}
                      <div className={cn("mt-0.5 text-[13px] text-zinc-100", c.resolved && "line-through decoration-zinc-500")}>
                        <CommentText text={c.body} />
                      </div>

                      {replies(c.id).map((r) => (
                        <div key={r.id} className="mt-2.5 flex gap-2 border-l border-line pl-3">
                          <Avatar name={r.author.name} color={r.author.color} size={20} />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-semibold">{r.author.name}</span>
                              <span className="text-[11px] text-muted">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                            </div>
                            <div className="text-[13px] text-zinc-200">
                              <CommentText text={r.body} />
                            </div>
                          </div>
                        </div>
                      ))}

                      {replyTo === c.id ? (
                        <div className="mt-2 rounded-md border border-line bg-card p-1.5">
                          <MentionInput
                            value={replyBody}
                            onChange={setReplyBody}
                            onSubmit={() => sendReply(c.id)}
                            users={users}
                            rows={2}
                            placeholder="Reply…"
                          />
                          <div className="flex justify-end gap-1">
                            <button className="btn-ghost" onClick={() => setReplyTo(null)}>
                              Cancel
                            </button>
                            <button className="btn" onClick={() => sendReply(c.id)}>
                              Reply
                            </button>
                          </div>
                        </div>
                      ) : (
                        !c.id.startsWith("tmp-") && (
                          <button className="mt-1 text-xs text-muted hover:text-zinc-200" onClick={() => (setReplyTo(c.id), setReplyBody(""))}>
                            Reply
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-line p-3">
            <div className="rounded-lg border border-line bg-card p-2 focus-within:border-zinc-500">
              <MentionInput
                ref={input}
                value={body}
                onChange={setBody}
                onSubmit={send}
                onFocus={onComposerFocus}
                users={users}
                placeholder="Leave feedback at this moment… (@ to mention)"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                <button
                  className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs", stampOn ? "bg-sky-500/15 text-sky-300" : "text-muted hover:bg-hover")}
                  onClick={() => {
                    setStampOn((s) => !s);
                    if (ref.current) setStamp(ref.current.currentTime);
                  }}
                  title="Pin this comment to the current timestamp"
                >
                  <Clock className="h-3.5 w-3.5" /> {stampOn ? fmtTime(stamp) : "No timestamp"}
                </button>
                <button
                  className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs", drawMode || draft.length ? "bg-accent/15 text-ink" : "text-muted hover:bg-hover")}
                  onClick={toggleDraw}
                  title="Draw on the frame"
                >
                  <Pencil className="h-3.5 w-3.5" /> {draft.length ? `${draft.length} mark${draft.length > 1 ? "s" : ""}` : "Draw"}
                </button>
                </div>
                <button className="btn-ghost p-1.5" onClick={send} disabled={!body.trim() && !draft.length}>
                  <SendHorizonal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          </>
          )}
        </aside>
      </div>
    </div>
  );
}
