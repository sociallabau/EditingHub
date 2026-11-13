"use client";

import { useRef, useState, useTransition } from "react";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Check, Download, ImagePlus, Star, Trash2 } from "lucide-react";
import { addLinks, deleteLink, setCover } from "@/lib/actions";
import { safeName, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type Item = { id: string; url: string; label: string; addedBy: string };

export function Thumbnails({
  projectId,
  items,
  coverUrl,
  frameUrl,
}: {
  projectId: string;
  items: Item[];
  coverUrl: string | null;
  frameUrl: string | null;
}) {
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  // what the board card shows right now
  const active = coverUrl ?? items[0]?.url ?? null;

  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return setError("Thumbnails need to be image files (JPG, PNG, WebP).");
    setError("");
    try {
      const done = [];
      for (const f of list) {
        setBusy({ name: f.name, pct: 0 });
        const res = await uploadFile(f, `projects/${projectId}/thumbnails/${safeName(f.name)}`, (pct) => setBusy({ name: f.name, pct }));
        done.push({ url: res.url, label: f.name, kind: "UPLOAD" as const, size: f.size });
      }
      await addLinks({ projectId }, "thumbnails", done);
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Thumbnails</h2>
          <p className="text-xs text-muted">
            Cover options for this video. The starred one shows on the project board
            {frameUrl ? " — with none uploaded, the board uses a frame from the latest edit." : "."}
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => input.current?.click()} disabled={!!busy}>
          <ImagePlus className="h-3.5 w-3.5" /> Upload thumbnail
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>

      {busy && (
        <div className="mt-4">
          <ProgressBar label={`Uploading ${busy.name}`} value={busy.pct} max={100} hasValueLabel />
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div
        className={cn("mt-5 grid grid-cols-2 gap-3 rounded-2xl sm:grid-cols-3", over && "outline-2 outline-dashed outline-accent")}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files);
        }}
      >
        {items.map((t) => {
          const isCover = t.url === active;
          return (
            <div key={t.id} className={cn("lux-card group overflow-hidden", isCover && "border-accent")}>
              <div className="relative aspect-video bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.url} alt={t.label} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.url} alt={t.label} className="relative mx-auto h-full object-contain" />
                {isCover && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">
                    <Check className="h-3 w-3" /> Board cover
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 p-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{t.label}</div>
                  <div className="text-[11px] text-muted">{t.addedBy}</div>
                </div>
                {!isCover && (
                  <button className="btn-ghost p-1.5" title="Use as board cover" onClick={() => start(() => setCover(projectId, t.url))}>
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <a className="btn-ghost p-1.5" href={t.url} download={t.label} target="_blank" rel="noreferrer" title="Download">
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  className="btn-ghost p-1.5"
                  title="Delete"
                  onClick={() => confirm(`Delete thumbnail "${t.label}"?`) && start(() => deleteLink(t.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && !busy && (
          <button
            onClick={() => input.current?.click()}
            className="col-span-full flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center hover:bg-panel"
          >
            <ImagePlus className="h-6 w-6 text-muted" />
            <div className="mt-2 text-[13px] font-medium">Drop thumbnail images here</div>
            <div className="text-xs text-muted">JPG, PNG or WebP. Upload a few options and star the one to use.</div>
          </button>
        )}
      </div>
    </div>
  );
}
