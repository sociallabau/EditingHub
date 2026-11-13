"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, FileVideo, UploadCloud } from "lucide-react";
import { createVideo } from "@/lib/actions";
import { safeName, uploadFile, videoThumbnail } from "@/lib/upload-client";
import { cn, fmtSize } from "@/lib/utils";

const ACCEPT = "video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v";

export function VideoUpload({ projectId, compact, rawHref }: { projectId: string; compact?: boolean; rawHref?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ name: string; size: number; pct: number; step: string } | null>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  const start = async (file?: File) => {
    if (!file) return;
    if (!/\.(mp4|mov|m4v|webm)$/i.test(file.name) && !file.type.startsWith("video/")) {
      setError("Please upload an .mp4 or .mov video");
      return;
    }
    setError("");
    setState({ name: file.name, size: file.size, pct: 0, step: "Preparing…" });
    try {
      const { thumb, duration } = await videoThumbnail(file);
      let thumbnailUrl: string | null = null;
      if (thumb) {
        thumbnailUrl = (await uploadFile(thumb, `projects/${projectId}/thumbs/${safeName(file.name)}.jpg`)).url;
      }
      setState((s) => s && { ...s, step: "Uploading" });
      const res = await uploadFile(file, `projects/${projectId}/edits/${safeName(file.name)}`, (pct) =>
        setState((s) => s && { ...s, pct }),
      );
      setState((s) => s && { ...s, pct: 100, step: "Finishing…" });
      const id = await createVideo(projectId, {
        name: file.name,
        url: res.url,
        thumbnailUrl,
        size: file.size,
        contentType: file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4"),
        duration: duration ?? undefined,
      });
      router.push(`/projects/${projectId}/videos/${id}`);
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
      setState(null);
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const dropProps = {
    onDragOver: (e: React.DragEvent) => (e.preventDefault(), setOver(true)),
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      start(e.dataTransfer.files[0]);
    },
  };

  return (
    <div>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => start(e.target.files?.[0])} />
      {state ? (
        <div className="rounded-lg border border-line bg-card p-4">
          <div className="flex items-center gap-3">
            <FileVideo className="h-5 w-5 text-sky-400" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{state.name}</div>
              <div className="text-[11px] text-muted">
                {fmtSize(state.size)} · {state.step} {state.step === "Uploading" && `${state.pct}%`}
              </div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded bg-line">
            <div className="h-full bg-accent transition-all" style={{ width: `${state.pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted">Keep this tab open until the upload finishes.</p>
        </div>
      ) : compact ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" {...dropProps}>
          <button
            onClick={() => input.current?.click()}
            className={cn("rounded-lg border border-line bg-card p-4 text-left hover:bg-hover", over && "border-accent")}
          >
            <Clapperboard className="h-4 w-4 text-muted" />
            <div className="mt-6 text-[13px] font-medium">Edited Video</div>
            <div className="text-xs text-muted">Upload .mp4 / .mov for review</div>
          </button>
          {rawHref && (
            <Link href={rawHref} className="rounded-lg border border-line bg-card p-4 text-left hover:bg-hover">
              <FileVideo className="h-4 w-4 text-muted" />
              <div className="mt-6 text-[13px] font-medium">Raw Video</div>
              <div className="text-xs text-muted">Link Google Drive footage or upload</div>
            </Link>
          )}
        </div>
      ) : (
        <button
          {...dropProps}
          onClick={() => input.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-10 text-center hover:bg-card",
            over && "border-accent bg-card",
          )}
        >
          <UploadCloud className="h-6 w-6 text-muted" />
          <div className="mt-2 text-[13px] font-medium">Upload a new edit</div>
          <div className="text-xs text-muted">Drop an .mp4 or .mov here, or click to browse. Each upload becomes a new version.</div>
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
