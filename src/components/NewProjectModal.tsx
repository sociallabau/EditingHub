"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LayoutTemplate } from "lucide-react";
import type { BoardMeta } from "@/lib/queries";
import { createProject } from "@/lib/actions";
import { cn, PRIORITIES, type PriorityT, ROLE_LABEL } from "@/lib/utils";
import { Avatar, Modal, PriorityLabel } from "./ui";

export function NewProjectModal({
  open,
  onClose,
  meta,
  defaultStageId,
  me,
}: {
  open: boolean;
  onClose: () => void;
  meta: BoardMeta;
  defaultStageId: string;
  me: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [templateId, setTemplateId] = useState<string | null>(meta.templates[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [stageId, setStageId] = useState(defaultStageId);
  const [priority, setPriority] = useState<PriorityT>("NONE");
  const [dueDate, setDueDate] = useState("");
  const [shootDate, setShootDate] = useState("");
  const [members, setMembers] = useState<string[]>([me]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStageId(defaultStageId);
      setTitle("");
      setError("");
      setMembers([me]);
    }
  }, [open, defaultStageId, me]);

  useEffect(() => {
    const t = meta.templates.find((t) => t.id === templateId);
    if (t) setPriority(t.defaultPriority);
  }, [templateId, meta.templates]);

  const client = meta.clients.find((c) => c.id === clientId);
  const template = meta.templates.find((t) => t.id === templateId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Give the video a title");
    start(async () => {
      try {
        const id = await createProject({
          title: client && !title.startsWith("[") ? `[${client.name.toUpperCase()}] ${title.trim()}` : title,
          templateId,
          clientId: clientId || null,
          stageId,
          priority,
          dueDate: dueDate || null,
          shootDate: shootDate || null,
          memberIds: members,
        });
        onClose();
        router.push(`/projects/${id}`);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="New project" width={680}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label flex items-center gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" /> Template
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {meta.templates.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "relative rounded-lg border p-2.5 text-left transition-colors",
                  templateId === t.id ? "border-accent bg-accent/10" : "border-line bg-card hover:border-zinc-600",
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] text-muted">{t.description || "—"}</div>
                {templateId === t.id && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-accent" />}
              </button>
            ))}
          </div>
          {template && (
            <p className="mt-2 text-[11px] text-muted">
              Creates footage sections: {template.sections.map((s) => s.title).join(" · ")}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Video title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rarestate - Giveaway" autoFocus />
            {client && !title.startsWith("[") && title && (
              <p className="mt-1 text-[11px] text-muted">
                Saved as “[{client.name.toUpperCase()}] {title}”
              </p>
            )}
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">No client</option>
              {meta.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Column</label>
            <select className="input" value={stageId} onChange={(e) => setStageId(e.target.value)}>
              {meta.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Shoot date</label>
            <input type="date" className="input" value={shootDate} onChange={(e) => setShootDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Due date</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Priority</label>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriority(p)}
                className={cn("chip", priority === p && "border-zinc-400 bg-hover")}
              >
                <PriorityLabel priority={p} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Tag people (they get notified about everything on this project)</label>
          <div className="flex flex-wrap gap-1.5">
            {meta.users.map((u) => {
              const on = members.includes(u.id);
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setMembers((m) => (on ? m.filter((x) => x !== u.id) : [...m, u.id]))}
                  className={cn("chip", on ? "border-zinc-400 bg-hover text-zinc-100" : "text-zinc-400")}
                  title={ROLE_LABEL[u.role]}
                >
                  <Avatar name={u.name} color={u.color} size={16} className="ring-0" />
                  {u.name}
                  {on && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
