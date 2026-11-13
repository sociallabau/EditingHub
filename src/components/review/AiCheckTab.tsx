"use client";

import { useEffect, useState, useTransition } from "react";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Check, MessageSquarePlus, ScanText, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { addComment, saveVideoQa } from "@/lib/actions";
import { fmtTime } from "@/lib/utils";

export type QaIssue = { time: number; seen: string; issue: string; suggestion: string };

async function captureFrames(url: string, onProgress: (pct: number) => void) {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  await new Promise<void>((res, rej) => {
    v.onloadedmetadata = () => res();
    v.onerror = () => rej(new Error("Couldn't load the video to capture frames."));
  });
  const d = v.duration;
  const step = Math.max(1.5, d / 48);
  const w = Math.min(540, v.videoWidth);
  const h = Math.round((v.videoHeight / v.videoWidth) * w);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const frames: { time: number; data: string }[] = [];
  for (let t = Math.min(0.5, d / 2); t < d; t += step) {
    await new Promise<void>((res) => {
      v.onseeked = () => res();
      v.currentTime = t;
    });
    ctx.drawImage(v, 0, 0, w, h);
    frames.push({ time: Math.round(t * 10) / 10, data: canvas.toDataURL("image/jpeg", 0.7).split(",")[1] });
    onProgress(Math.round((t / d) * 100));
  }
  v.removeAttribute("src");
  v.load();
  return frames;
}

export function AiCheckTab({
  projectId,
  videoId,
  videoUrl,
  issues,
  checkedAt,
  hasTranscript,
  onSeek,
}: {
  projectId: string;
  videoId: string;
  videoUrl: string;
  issues: QaIssue[] | null;
  checkedAt: string | null;
  hasTranscript: boolean;
  onSeek: (t: number) => void;
}) {
  const [, start] = useTransition();
  const [local, setLocal] = useState(issues);
  const [state, setState] = useState<{ label: string; pct: number } | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Set<number>>(new Set());
  useEffect(() => setLocal(issues), [issues]);

  const run = async () => {
    setError("");
    try {
      setState({ label: "Capturing frames", pct: 0 });
      const frames = await captureFrames(videoUrl, (pct) => setState({ label: "Capturing frames", pct }));
      const found: QaIssue[] = [];
      const BATCH = 12;
      for (let i = 0; i < frames.length; i += BATCH) {
        setState({ label: "Reading on-screen text", pct: Math.round((i / frames.length) * 100) });
        const res = await fetch("/api/ai/qa", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ videoId, frames: frames.slice(i, i + BATCH) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "AI check failed");
        for (const issue of json.issues as QaIssue[]) {
          const key = `${issue.seen}|${issue.suggestion}`.toLowerCase();
          if (!found.some((f) => `${f.seen}|${f.suggestion}`.toLowerCase() === key)) found.push(issue);
        }
      }
      found.sort((a, b) => a.time - b.time);
      setLocal(found);
      setAdded(new Set());
      start(() => saveVideoQa(videoId, found));
    } catch (e) {
      const msg = (e as Error).message;
      setError(/tainted|insecure|SecurityError/i.test(msg) ? "The browser blocked reading frames from this video file." : msg);
    } finally {
      setState(null);
    }
  };

  const addNote = (i: number, q: QaIssue) => {
    setAdded((s) => new Set(s).add(i));
    start(() =>
      addComment({ projectId, videoId, timestamp: q.time, body: `Caption fix: "${q.seen}" → "${q.suggestion}" (${q.issue})` }),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line p-3">
        {state ? (
          <ProgressBar label={state.label} value={state.pct} max={100} hasValueLabel />
        ) : (
          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={run}>
              <Sparkles className="h-3.5 w-3.5" /> {local ? "Check again" : "Check captions"}
            </button>
            <span className="text-[11px] text-muted">
              {checkedAt ? `Checked ${formatDistanceToNow(new Date(checkedAt), { addSuffix: true })}` : "Spelling & caption-vs-speech check"}
            </span>
          </div>
        )}
        {!hasTranscript && !state && (
          <p className="mt-2 text-[11px] text-muted">Tip: let the transcript finish first — the check compares captions against what was said.</p>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {local && local.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-muted">
            <Check className="h-5 w-5 text-green-500" /> No caption problems found.
          </div>
        )}
        {!local && !state && (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-muted">
            <ScanText className="h-5 w-5" />
            Reads the on-screen text frame by frame and flags typos or captions that don&apos;t match what was said — before an account manager has to.
          </div>
        )}
        {local?.map((q, i) => (
          <div key={i} className="border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <button className="font-mono text-xs text-sky-400 hover:underline" onClick={() => onSeek(q.time)}>
                {fmtTime(q.time)}
              </button>
              <span className="text-[11px] text-muted">{q.issue}</span>
            </div>
            <div className="mt-1 text-[13px]">
              <span className="text-red-400 line-through decoration-1">{q.seen}</span>
              <span className="mx-1.5 text-muted">→</span>
              <span className="font-medium text-green-500">{q.suggestion}</span>
            </div>
            <button className="btn-ghost mt-1 -ml-2" disabled={added.has(i)} onClick={() => addNote(i, q)}>
              {added.has(i) ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Added to feedback
                </>
              ) : (
                <>
                  <MessageSquarePlus className="h-3.5 w-3.5" /> Add as note
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
