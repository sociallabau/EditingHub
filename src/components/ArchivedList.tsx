"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArchiveRestore, Search, Trash2, CheckSquare, Square } from "lucide-react";
import type { BoardProject } from "@/lib/queries";
import { archiveProjects, deleteProjects } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { AvatarStack, PriorityLabel, StagePill } from "./ui";

export function ArchivedList({
  projects,
  stages,
  canDelete,
}: {
  projects: BoardProject[];
  stages: { id: string; name: string; color: string }[];
  canDelete: boolean;
}) {
  const [, start] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return projects.filter((p) => !hidden.has(p.id) && (!q || p.title.toLowerCase().includes(q) || p.client?.name.toLowerCase().includes(q)));
  }, [projects, query, hidden]);

  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const run = (ids: string[], fn: () => Promise<void>) => {
    setHidden((h) => new Set([...h, ...ids]));
    setSelected(new Set());
    start(fn);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <h1 className="page-title">Archived projects</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search archive..." className="input w-56 py-1 pl-7 text-xs" />
        </div>
      </header>
      <div className="flex items-center gap-2 px-4 py-2 text-xs">
        <span className="text-muted">{rows.length} projects</span>
        {selected.size > 0 && (
          <>
            <span className="ml-3 font-medium">{selected.size} selected</span>
            <button className="btn" onClick={() => run([...selected], () => archiveProjects([...selected], false))}>
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore to board
            </button>
            {canDelete && (
              <button
                className="btn text-red-400"
                onClick={() =>
                  confirm(`Permanently delete ${selected.size} project(s) and their uploaded files? This cannot be undone.`) &&
                  run([...selected], () => deleteProjects([...selected]))
                }
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete forever
              </button>
            )}
          </>
        )}
      </div>
      <div className="flex-1 overflow-auto px-4 pb-6">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead className="sticky top-0 bg-solid text-[11px] uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="w-8 py-2">
                <button onClick={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}>
                  {all ? <CheckSquare className="h-4 w-4 text-accent" /> : <Square className="h-4 w-4" />}
                </button>
              </th>
              <th className="py-2 font-medium">Project</th>
              <th className="py-2 font-medium">Client</th>
              <th className="py-2 font-medium">Column</th>
              <th className="py-2 font-medium">Priority</th>
              <th className="py-2 font-medium">Archived</th>
              <th className="py-2 font-medium">People</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const s = stageById.get(p.stageId);
              return (
                <tr key={p.id} className={cn("border-b border-line hover:bg-panel", selected.has(p.id) && "bg-panel")}>
                  <td className="py-2">
                    <button onClick={() => toggle(p.id)}>
                      {selected.has(p.id) ? <CheckSquare className="h-4 w-4 text-accent" /> : <Square className="h-4 w-4 text-muted" />}
                    </button>
                  </td>
                  <td className="max-w-[340px] truncate py-2 pr-3">
                    <Link href={`/projects/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="py-2 text-zinc-300">{p.client?.name ?? "—"}</td>
                  <td className="py-2">{s && <StagePill name={s.name} color={s.color} />}</td>
                  <td className="py-2">
                    <PriorityLabel priority={p.priority} />
                  </td>
                  <td className="py-2 text-muted">{p.archivedAt ? format(new Date(p.archivedAt), "d MMM yyyy") : "—"}</td>
                  <td className="py-2">
                    <AvatarStack users={p.members} size={18} />
                  </td>
                  <td className="py-2 text-right">
                    <button className="btn-ghost" onClick={() => run([p.id], () => archiveProjects([p.id], false))}>
                      <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-xs text-muted">Nothing archived yet. Archive finished projects from the board.</p>}
      </div>
    </div>
  );
}
