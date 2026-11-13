"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { RefreshCw, Search } from "lucide-react";
import { saveTranscript } from "@/lib/actions";
import { STAGE_LABEL, transcribe, type Progress, type Segment } from "@/lib/transcribe";
import { cn, fmtTime } from "@/lib/utils";

const started = new Set<string>();

export function TranscriptTab({
  projectId,
  videoId,
  videoUrl,
  videoName,
  segments,
  time,
  onSeek,
}: {
  projectId: string;
  videoId: string;
  videoUrl: string;
  videoName: string;
  segments: Segment[] | null;
  time: number;
  onSeek: (t: number) => void;
}) {
  const [, start] = useTransition();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [local, setLocal] = useState(segments);
  const [query, setQuery] = useState("");
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => setLocal(segments), [segments]);

  const run = async () => {
    setError("");
    setProgress({ stage: "audio", pct: 0 });
    try {
      const res = await transcribe(videoUrl, setProgress);
      setLocal(res.segments);
      start(() =>
        saveTranscript({ projectId, videoId, sourceName: videoName, duration: res.duration, text: res.text, segments: res.segments }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  // First person to open a new edit transcribes it automatically; everyone after reads the saved copy.
  useEffect(() => {
    if (segments || started.has(videoId)) return;
    started.add(videoId);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (local ?? []).filter((s) => !q || s.text.toLowerCase().includes(q));
  }, [local, query]);
  const activeIdx = shown.findIndex((s) => time >= s.start && time < s.end);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  if (progress)
    return (
      <div className="p-4">
        <ProgressBar label={STAGE_LABEL[progress.stage]} value={progress.pct} max={100} hasValueLabel />
        <p className="mt-3 text-xs text-muted">
          Runs in your browser — the audio never leaves this computer. You can keep reviewing while it works.
        </p>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input className="input py-1 pl-8 text-xs" placeholder="Search what was said…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="btn-ghost p-1.5" title="Transcribe again" onClick={run}>
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && (
        <div className="p-4 text-xs text-red-400">
          {error}
          <button className="btn mt-2" onClick={run}>
            Try again
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2">
        {local && local.length === 0 && !error && <p className="p-2 text-xs text-muted">No speech found in this video.</p>}
        {!local && !error && (
          <div className="p-2">
            <p className="text-xs text-muted">No transcript yet.</p>
            <button className="btn mt-2" onClick={run}>
              Transcribe this edit
            </button>
          </div>
        )}
        {shown.map((s, i) => (
          <div
            key={`${s.start}-${i}`}
            ref={i === activeIdx ? activeRef : undefined}
            className={cn("flex gap-3 rounded-lg px-2 py-1.5 text-[13px] leading-relaxed transition-colors", i === activeIdx && "bg-hover")}
          >
            <button className="w-10 shrink-0 pt-0.5 text-left font-mono text-[11px] text-sky-400 hover:underline" onClick={() => onSeek(s.start)}>
              {fmtTime(s.start)}
            </button>
            <span className={cn(i === activeIdx ? "text-ink" : "text-zinc-300")}>
              {s.words?.length
                ? s.words.map((w, j) => (
                    <span
                      key={j}
                      onClick={() => onSeek(w.start)}
                      className={cn(
                        "cursor-pointer rounded px-px hover:bg-accent/20",
                        time >= w.start && time < w.end && "bg-accent/25 text-ink",
                      )}
                    >
                      {w.text}{" "}
                    </span>
                  ))
                : <span className="cursor-pointer" onClick={() => onSeek(s.start)}>{s.text}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
