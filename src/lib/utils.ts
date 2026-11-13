import { clsx, type ClassValue } from "clsx";
export const cn = (...c: ClassValue[]) => clsx(c);

export const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const;
export type PriorityT = (typeof PRIORITIES)[number];
export const PRIORITY_RANK: Record<PriorityT, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
export const PRIORITY_LABEL: Record<PriorityT, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  NONE: "Priority",
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  ACCOUNT_MANAGER: "Account Manager",
  EDITOR: "Editor",
  VIDEOGRAPHER: "Videographer",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function fmtSize(bytes?: number | null) {
  if (!bytes) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export type Section = { key: string; title: string; hint?: string };
export type TemplatePage = { title: string; content: string };

/** Pull a Drive file/folder id out of any Google Drive URL. */
export function parseDrive(url: string): { id: string; kind: "DRIVE_FOLDER" | "DRIVE_FILE" } | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)google\.com$/.test(u.hostname)) return null;
    const folder = u.pathname.match(/\/folders\/([\w-]+)/);
    if (folder) return { id: folder[1], kind: "DRIVE_FOLDER" };
    const file = u.pathname.match(/\/(?:file\/d|document\/d|spreadsheets\/d|presentation\/d)\/([\w-]+)/);
    if (file) return { id: file[1], kind: "DRIVE_FILE" };
    const id = u.searchParams.get("id");
    if (id) return { id, kind: "DRIVE_FILE" };
  } catch {}
  return null;
}

export function slugKey(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "section"
  ) + "-" + Math.random().toString(36).slice(2, 6);
}
