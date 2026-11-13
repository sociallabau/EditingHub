"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { FileAudio, Mic, Sparkles, Trash2 } from "lucide-react";
import { deleteTranscript, saveTranscript } from "@/lib/actions";
import { STAGE_LABEL, transcribe, type Progress } from "@/lib/transcribe";
import { fmtTime } from "@/lib/utils";

type Clip = { id: string; sourceName: string; duration: number | null; words: number };

export function AiBrief({ projectId, clips, hasBrief }: { projectId: string; clips: Clip[]; hasBrief: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<{ name: string; index: number; total: number; progress: Progress } | null>(null);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const addClips = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files);
    try {
      for (const [index, file] of list.entries()) {
        const res = await transcribe(file, (progress) => setJob({ name: file.name, index, total: list.length, progress }));
        await saveTranscript({ projectId, sourceName: file.name, duration: res.duration, text: res.text, segments: res.segments });
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJob(null);
      if (input.current) input.current.value = "";
    }
  };

  const generate = async () => {
    setError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't generate the brief");
      router.push(`/projects/${projectId}?tab=page-${json.pageId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <Sparkles className="h-4 w-4 text-accent" /> AI Brief
      </h2>
      <p className="mt-1 max-w-xl text-[13px] text-muted">
        Pick the raw clips from your computer or card. They&apos;re transcribed right here in the browser — nothing is uploaded — then the brief
        is drafted from what was actually said: hooks, best soundbites with timestamps, and a suggested cut.
      </p>

      <div className="mt-5 rounded-xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-[13px] font-semibold">Raw clips · {clips.length}</div>
          <button className="btn" onClick={() => input.current?.click()} disabled={!!job}>
            <Mic className="h-3.5 w-3.5" /> Add clips to transcribe
          </button>
          <input ref={input} type="file" accept="video/*,audio/*,.mov,.mp4,.m4a,.wav,.mp3" multiple hidden onChange={(e) => addClips(e.target.files)} />
        </div>
        {job && (
          <div className="border-b border-line px-4 py-3">
            <ProgressBar
              label={`${job.name} (${job.index + 1}/${job.total}) — ${STAGE_LABEL[job.progress.stage]}`}
              value={job.progress.pct}
              max={100}
              hasValueLabel
            />
          </div>
        )}
        {clips.length === 0 && !job && (
          <p className="px-4 py-6 text-center text-xs text-muted">No clips yet. Interview and piece-to-camera clips work best — skip the b-roll.</p>
        )}
        {clips.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <FileAudio className="h-4 w-4 text-muted" />
            <span className="min-w-0 flex-1 truncate text-[13px]">{c.sourceName}</span>
            <span className="text-[11px] text-muted">
              {c.duration ? fmtTime(c.duration) : ""} · {c.words} words
            </span>
            <button className="btn-ghost p-1" title="Remove" onClick={() => start(() => deleteTranscript(c.id))}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <label className="label mt-5">Anything the editor should know? (optional)</label>
      <textarea
        className="input leading-relaxed"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. Agent wants it under 45s, lead with the price growth stat, second take of the intro is the good one"
      />

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={generate} disabled={generating || !!job || (!clips.length && !notes.trim())}>
          <Sparkles className="h-3.5 w-3.5" /> {generating ? "Writing the brief…" : hasBrief ? "Rewrite AI brief" : "Generate brief"}
        </button>
        <span className="text-[11px] text-muted">
          {generating ? "Usually takes under a minute." : "Uses the template, client notes and linked assets too. Saved as an “AI Brief” page."}
        </span>
      </div>
    </div>
  );
}
