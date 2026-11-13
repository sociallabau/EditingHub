"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Link2,
  Plus,
  Upload,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Eye,
  EyeOff,
  Folder,
  FileVideo,
  Globe,
  Copy,
  Calendar,
} from "lucide-react";
import { addLinks, deleteLink, removeSection } from "@/lib/actions";
import { driveEnabled, openDrivePicker } from "@/lib/drive-picker";
import { safeName, uploadFile } from "@/lib/upload-client";
import { cn, fmtSize, parseDrive, type Section } from "@/lib/utils";
import { Avatar, Menu, MenuItem } from "../ui";
import { useRouter } from "next/navigation";

export type LinkItem = {
  id: string;
  label: string;
  url: string;
  kind: "DRIVE_FOLDER" | "DRIVE_FILE" | "UPLOAD" | "URL";
  size: number | null;
  createdAt: string;
  addedBy: { name: string; color: string };
};

export function DriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className}>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

function KindIcon({ kind }: { kind: LinkItem["kind"] }) {
  if (kind === "DRIVE_FOLDER" || kind === "DRIVE_FILE") return <DriveIcon className="h-4 w-4" />;
  if (kind === "UPLOAD") return <FileVideo className="h-4 w-4 text-sky-400" />;
  return <Globe className="h-4 w-4 text-muted" />;
}

export function FootageSection({
  projectId,
  clientId,
  section,
  links,
  compact,
  removable,
}: {
  projectId?: string;
  clientId?: string;
  section: Section;
  links: LinkItem[];
  compact?: boolean;
  removable?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = projectId ? { projectId } : { clientId };

  const save = (items: Parameters<typeof addLinks>[2]) =>
    start(async () => {
      try {
        await addLinks(target, section.key, items);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
    });

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    const drive = parseDrive(withProto);
    save([
      {
        url: withProto,
        label: label.trim() || (drive ? `${section.title} — Google Drive` : withProto.replace(/^https?:\/\//, "").slice(0, 60)),
        kind: drive?.kind ?? "URL",
      },
    ]);
    setUrl("");
    setLabel("");
    setAdding(false);
  };

  const browseDrive = async () => {
    try {
      const picks = await openDrivePicker();
      if (picks.length)
        save(picks.map((p) => ({ url: p.url, label: p.name, kind: p.isFolder ? "DRIVE_FOLDER" : "DRIVE_FILE", size: p.size })));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploads(list.map((f) => ({ name: f.name, pct: 0 })));
    const done: Parameters<typeof addLinks>[2] = [];
    try {
      await Promise.all(
        list.map(async (f, i) => {
          const res = await uploadFile(f, `${projectId ? `projects/${projectId}` : `clients/${clientId}`}/${section.key}/${safeName(f.name)}`, (pct) =>
            setUploads((u) => u.map((x, j) => (j === i ? { ...x, pct } : x))),
          );
          done.push({ url: res.url, label: f.name, kind: "UPLOAD", size: f.size });
        }),
      );
      save(done);
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
      if (done.length) save(done);
    } finally {
      setUploads([]);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className={cn("font-semibold", compact ? "text-[15px]" : "text-lg")}>
            {compact && projectId ? (
              <Link href={`/projects/${projectId}?tab=section-${section.key}`} className="hover:underline">
                {section.title}
              </Link>
            ) : (
              section.title
            )}
          </h3>
          {section.hint && <p className="truncate text-xs text-muted">{section.hint}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {driveEnabled && (
            <button className="btn-ghost" onClick={browseDrive} disabled={pending}>
              <DriveIcon className="h-3.5 w-3.5" /> Browse Drive
            </button>
          )}
          <button className="btn-ghost" onClick={() => setAdding((a) => !a)}>
            <Plus className="h-3.5 w-3.5" /> Add Link
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploads.length > 0}>
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          {removable && projectId && (
            <Menu
              align="right"
              trigger={() => (
                <button className="btn-ghost p-1.5">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              )}
            >
              {(close) => (
                <MenuItem
                  danger
                  onClick={() => {
                    close();
                    if (!confirm(`Remove the "${section.title}" section and everything linked in it?`)) return;
                    start(async () => {
                      await removeSection(projectId, section.key);
                      router.push(`/projects/${projectId}`);
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove section
                </MenuItem>
              )}
            </Menu>
          )}
        </div>
      </div>

      {adding && (
        <form onSubmit={submitLink} className="mb-2 flex flex-wrap gap-2 rounded-lg border border-line bg-card p-2">
          <input
            className="input min-w-[220px] flex-[2]"
            placeholder="Paste a Google Drive / Dropbox / Frame.io link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <input className="input min-w-[140px] flex-1" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn-primary" disabled={pending}>
            Add
          </button>
        </form>
      )}

      {uploads.map((u) => (
        <div key={u.name} className="mb-1.5 rounded-lg border border-line bg-card px-3 py-2">
          <div className="flex justify-between text-xs">
            <span className="truncate">{u.name}</span>
            <span className="text-muted">{u.pct}%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded bg-line">
            <div className="h-full bg-accent transition-all" style={{ width: `${u.pct}%` }} />
          </div>
        </div>
      ))}

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {links.length === 0 && !adding && uploads.length === 0 ? (
        <div
          className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-line px-6 py-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
        >
          <div>
            <div className="text-[13px] font-medium text-zinc-200">Add {section.title} files</div>
            <div className="mt-1 max-w-md text-[13px] text-muted">
              Drag files here or click Upload to put them straight into the hub — or link a Google Drive / Dropbox folder.
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button className="btn-primary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Upload files
            </button>
            <button className="btn" onClick={() => (driveEnabled ? browseDrive() : setAdding(true))}>
              <Link2 className="h-3.5 w-3.5" /> Add Link
            </button>
          </div>
        </div>
      ) : (
        <ul
          className="space-y-1.5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
        >
          {links.map((l) => (
            <LinkRow key={l.id} link={l} onDelete={() => start(() => deleteLink(l.id))} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LinkRow({ link: l, onDelete }: { link: LinkItem; onDelete: () => void }) {
  const [preview, setPreview] = useState(false);
  const drive = parseDrive(l.url);
  const isVideo = l.kind === "UPLOAD" && /\.(mp4|mov|m4v|webm)$/i.test(l.label);
  const isImage = l.kind === "UPLOAD" && /\.(png|jpe?g|gif|webp)$/i.test(l.label);
  const canPreview = !!drive || isVideo || isImage;
  const embed = drive
    ? drive.kind === "DRIVE_FOLDER"
      ? `https://drive.google.com/embeddedfolderview?id=${drive.id}#grid`
      : `https://drive.google.com/file/d/${drive.id}/preview`
    : null;

  return (
    <li className="rounded-lg border border-line bg-card">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <KindIcon kind={l.kind} />
        <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] text-zinc-100 hover:underline">
          {l.kind === "DRIVE_FOLDER" && <Folder className="mr-1.5 inline h-3.5 w-3.5 text-muted" />}
          {l.label}
        </a>
        {l.size ? <span className="text-[11px] text-muted">{fmtSize(l.size)}</span> : null}
        <span className="hidden items-center gap-1 text-[11px] text-muted sm:inline-flex">
          <Calendar className="h-3 w-3" /> {format(new Date(l.createdAt), "d MMM")}
        </span>
        <Avatar name={l.addedBy.name} color={l.addedBy.color} size={18} className="ring-0" />
        {canPreview && (
          <button className="btn-ghost p-1" title={preview ? "Hide preview" : "Preview"} onClick={() => setPreview((p) => !p)}>
            {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <Menu
          align="right"
          width={170}
          trigger={() => (
            <button className="btn-ghost p-1">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem onClick={() => (window.open(l.url, "_blank"), close())}>
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </MenuItem>
              <MenuItem onClick={() => (navigator.clipboard.writeText(l.url), close())}>
                <Copy className="h-3.5 w-3.5" /> Copy link
              </MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  close();
                  if (confirm(`Remove "${l.label}"?${l.kind === "UPLOAD" ? " The uploaded file will be deleted." : ""}`)) onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
      {preview && (
        <div className="border-t border-line p-2">
          {embed && <iframe src={embed} className="h-[360px] w-full rounded bg-white" allow="autoplay" />}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          {isVideo && <video src={l.url} controls className="max-h-[420px] w-full rounded bg-black" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {isImage && <img src={l.url} alt={l.label} className="max-h-[420px] rounded" />}
          {drive && <p className="mt-1 text-[11px] text-muted">Preview only works if the Drive item is shared with your Google account.</p>}
        </div>
      )}
    </li>
  );
}
