"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Archive, ArchiveRestore, Building2, Camera, Check, Copy, LayoutTemplate, Trash2, UserPlus } from "lucide-react";
import type { BoardMeta } from "@/lib/queries";
import {
  archiveProjects,
  deleteProjects,
  duplicateProject,
  saveProjectAsTemplate,
  setMembers,
  updateProject,
} from "@/lib/actions";
import { PRIORITIES, ROLE_LABEL, type PriorityT } from "@/lib/utils";
import { Avatar, AvatarStack, EvergreenLabel, Menu, MenuItem, PriorityLabel, StageDot } from "../ui";

export function ProjectHeader({
  project: p,
  meta,
  canManage,
}: {
  project: {
    id: string;
    title: string;
    description: string;
    priority: PriorityT;
    clientId: string | null;
    shootDate: string | null;
    archived: boolean;
    templateName: string | null;
    memberIds: string[];
  };
  meta: BoardMeta;
  canManage: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [title, setTitle] = useState(p.title);
  const [desc, setDesc] = useState(p.description);
  const [members, setLocalMembers] = useState(p.memberIds);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setTitle(p.title), [p.title]);
  useEffect(() => setLocalMembers(p.memberIds), [p.memberIds]);
  useEffect(() => {
    const el = descRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [desc]);

  const client = meta.clients.find((c) => c.id === p.clientId);
  const memberUsers = meta.users.filter((u) => members.includes(u.id));

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== p.title && start(() => updateProject(p.id, { title }))}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full bg-transparent font-heading text-[28px] font-medium tracking-tight text-zinc-50 outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Menu
          trigger={() => (
            <button className="chip hover:bg-hover">
              {client ? <EvergreenLabel name={client.name} color={client.color} /> : (
                <>
                  <Building2 className="h-3.5 w-3.5 text-muted" /> Client
                </>
              )}
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem onClick={() => (close(), start(() => updateProject(p.id, { clientId: null })))}>No client</MenuItem>
              {meta.clients.map((c) => (
                <MenuItem key={c.id} active={c.id === p.clientId} onClick={() => (close(), start(() => updateProject(p.id, { clientId: c.id })))}>
                  <StageDot color={c.color} /> {c.name}
                </MenuItem>
              ))}
              {meta.clients.length === 0 && <div className="px-2 py-1.5 text-xs text-muted">Add clients from the Clients page</div>}
            </>
          )}
        </Menu>

        <Menu width={170} trigger={() => <button className="chip hover:bg-hover"><PriorityLabel priority={p.priority} /></button>}>
          {(close) =>
            PRIORITIES.map((pr) => (
              <MenuItem key={pr} active={pr === p.priority} onClick={() => (close(), start(() => updateProject(p.id, { priority: pr })))}>
                <PriorityLabel priority={pr} />
              </MenuItem>
            ))
          }
        </Menu>

        <label className="chip relative cursor-pointer hover:bg-hover" title="Shoot date">
          <Camera className="h-3.5 w-3.5 text-muted" />
          {p.shootDate ? `Shot ${format(new Date(p.shootDate), "d MMM")}` : "Shoot date"}
          <input
            type="date"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={p.shootDate ? p.shootDate.slice(0, 10) : ""}
            onChange={(e) => start(() => updateProject(p.id, { shootDate: e.target.value || null }))}
          />
        </label>

        {p.templateName && (
          <span className="chip text-muted">
            <LayoutTemplate className="h-3.5 w-3.5" /> {p.templateName}
          </span>
        )}

        <Menu
          width={250}
          trigger={() => (
            <button className="chip hover:bg-hover" title="Tagged people get notified about everything on this project">
              {memberUsers.length ? <AvatarStack users={memberUsers} size={18} max={5} /> : <UserPlus className="h-3.5 w-3.5" />}
              <span className="text-muted">{memberUsers.length ? "Tagged" : "Tag people"}</span>
            </button>
          )}
        >
          {() => (
            <>
              <div className="px-2 py-1.5 text-[11px] text-muted">Tagged people are notified of every change</div>
              {meta.users.map((u) => {
                const on = members.includes(u.id);
                return (
                  <MenuItem
                    key={u.id}
                    onClick={() => {
                      const next = on ? members.filter((m) => m !== u.id) : [...members, u.id];
                      setLocalMembers(next);
                      start(() => setMembers(p.id, next));
                    }}
                  >
                    <Avatar name={u.name} color={u.color} size={18} className="ring-0" />
                    <span className="flex-1">
                      {u.name}
                      <span className="ml-1 text-[11px] text-muted">{ROLE_LABEL[u.role]}</span>
                    </span>
                    {on && <Check className="h-3.5 w-3.5 text-accent" />}
                  </MenuItem>
                );
              })}
            </>
          )}
        </Menu>
      </div>

      <textarea
        ref={descRef}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => desc !== p.description && start(() => updateProject(p.id, { description: desc }))}
        placeholder="Add project description..."
        rows={3}
        className="mt-4 w-full resize-none bg-transparent text-[13px] leading-relaxed text-zinc-300 outline-none placeholder:text-zinc-500"
      />

      <div className="mt-3 flex flex-wrap items-center gap-1 border-b border-line pb-3">
        {canManage && (
          <button
            className="btn-ghost"
            onClick={() => {
              if (!confirm(`Permanently delete "${p.title}" and its uploaded videos?`)) return;
              start(async () => {
                await deleteProjects([p.id]);
                router.push("/projects");
              });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
        <button className="btn-ghost" onClick={() => start(() => archiveProjects([p.id], !p.archived))}>
          {p.archived ? (
            <>
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore
            </>
          ) : (
            <>
              <Archive className="h-3.5 w-3.5" /> Archive
            </>
          )}
        </button>
        <button
          className="btn-ghost"
          onClick={() =>
            start(async () => {
              const id = await duplicateProject(p.id);
              router.push(`/projects/${id}`);
            })
          }
        >
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        {canManage && (
          <button
            className="btn-ghost"
            onClick={() => {
              const name = prompt("Template name", p.templateName ? `${p.templateName} (custom)` : "New template");
              if (!name) return;
              start(async () => {
                const id = await saveProjectAsTemplate(p.id, name);
                router.push(`/templates/${id}`);
              });
            }}
          >
            <LayoutTemplate className="h-3.5 w-3.5" /> Save as Template
          </button>
        )}
      </div>
    </div>
  );
}
