"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow, format, isBefore, startOfDay } from "date-fns";
import {
  Plus,
  Search,
  MoreHorizontal,
  Calendar,
  AlertTriangle,
  CheckSquare,
  Square,
  Archive,
  ArrowDownWideNarrow,
  Copy,
  Trash2,
  MessageSquare,
  Film,
  X,
  Building2,
} from "lucide-react";
import type { BoardMeta, BoardProject } from "@/lib/queries";
import { archiveProjects, deleteProjects, duplicateProject, moveProject, updateProject } from "@/lib/actions";
import { cn, PRIORITIES, PRIORITY_RANK, type PriorityT } from "@/lib/utils";
import { AvatarStack, EvergreenLabel, Menu, MenuItem, PriorityLabel, PRIORITY_STYLE, StageDot, StagePill } from "./ui";
import { NewProjectModal } from "./NewProjectModal";

type SortMode = "priority" | "due" | "manual" | "newest";
const SORT_LABEL: Record<SortMode, string> = {
  priority: "Priority",
  due: "Due date",
  newest: "Newest",
  manual: "Manual",
};

export function Board({ projects, meta, me }: { projects: BoardProject[]; meta: BoardMeta; me: { id: string; role: string } }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [local, setLocal] = useState(projects);
  useEffect(() => setLocal(projects), [projects]);

  const [scope, setScope] = useState<"all" | "mine">("all");
  const [clientId, setClientId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("priority");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newIn, setNewIn] = useState<string | null>(null);

  // remember view preferences per browser
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("board-prefs") || "{}");
      if (s.sort) setSort(s.sort);
      if (s.scope) setScope(s.scope);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("board-prefs", JSON.stringify({ sort, scope }));
    } catch {}
  }, [sort, scope]);

  const byId = useMemo(() => new Map(local.map((p) => [p.id, p])), [local]);

  const derived = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = local.filter(
      (p) =>
        (scope === "all" || p.members.some((m) => m.id === me.id)) &&
        (!clientId || p.client?.id === clientId) &&
        (!q || p.title.toLowerCase().includes(q) || p.client?.name.toLowerCase().includes(q)),
    );
    const cmp = (a: BoardProject, b: BoardProject) => {
      if (sort === "priority") return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.position - b.position;
      if (sort === "due") {
        const ad = a.dueDate ? Date.parse(a.dueDate) : Infinity;
        const bd = b.dueDate ? Date.parse(b.dueDate) : Infinity;
        return ad - bd || a.position - b.position;
      }
      if (sort === "newest") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return a.position - b.position;
    };
    const cols: Record<string, string[]> = Object.fromEntries(meta.stages.map((s) => [s.id, []]));
    for (const p of [...visible].sort(cmp)) (cols[p.stageId] ??= []).push(p.id);
    return cols;
  }, [local, scope, clientId, query, sort, me.id, meta.stages]);

  const [dragCols, setDragCols] = useState<Record<string, string[]> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const cols = dragCols ?? derived;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const findCol = (id: string, c = cols) => (id in c ? id : Object.keys(c).find((k) => c[k].includes(id)));

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setDragCols(derived);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !dragCols) return;
    const from = findCol(String(active.id), dragCols);
    const to = findCol(String(over.id), dragCols);
    if (!from || !to || from === to) return;
    setDragCols((c) => {
      if (!c) return c;
      const fromItems = c[from].filter((id) => id !== active.id);
      const toItems = [...c[to]];
      const idx = over.id in c ? toItems.length : Math.max(0, toItems.indexOf(String(over.id)));
      toItems.splice(idx, 0, String(active.id));
      return { ...c, [from]: fromItems, [to]: toItems };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    setActiveId(null);
    if (!over || !dragCols) {
      setDragCols(null);
      return;
    }
    let c = dragCols;
    const col = findCol(id, c)!;
    const overCol = findCol(String(over.id), c);
    if (overCol === col && !(over.id in c)) {
      const oldI = c[col].indexOf(id);
      const newI = c[col].indexOf(String(over.id));
      if (oldI !== newI) c = { ...c, [col]: arrayMove(c[col], oldI, newI) };
    }
    const list = c[col];
    const i = list.indexOf(id);
    const beforeId = list[i - 1] ?? null;
    const afterId = list[i + 1] ?? null;
    const project = byId.get(id)!;
    const unchanged = project.stageId === col && derived[col]?.indexOf(id) === i;
    setDragCols(null);
    if (unchanged) return;
    const bp = beforeId ? byId.get(beforeId)!.position : null;
    const ap = afterId ? byId.get(afterId)!.position : null;
    const position = bp != null && ap != null ? (bp + ap) / 2 : bp != null ? bp + 1000 : ap != null ? ap - 1000 : 0;
    setLocal((ps) => ps.map((p) => (p.id === id ? { ...p, stageId: col, position } : p)));
    startTransition(() => moveProject(id, col, beforeId, afterId));
  };

  const setPriority = (id: string, priority: PriorityT) => {
    setLocal((ps) => ps.map((p) => (p.id === id ? { ...p, priority } : p)));
    startTransition(() => updateProject(id, { priority }));
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const bulkArchive = (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`Archive ${ids.length} project${ids.length > 1 ? "s" : ""}? You can restore them from the Archived board.`)) return;
    setLocal((ps) => ps.filter((p) => !ids.includes(p.id)));
    setSelected(new Set());
    startTransition(() => archiveProjects(ids));
  };

  const bulkPriority = (priority: PriorityT) => {
    const ids = [...selected];
    setLocal((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, priority } : p)));
    startTransition(async () => {
      for (const id of ids) await updateProject(id, { priority });
    });
  };

  const bulkMove = (stageId: string) => {
    const ids = [...selected];
    setLocal((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, stageId } : p)));
    startTransition(async () => {
      for (const id of ids) await moveProject(id, stageId, null, null);
    });
  };

  const active = activeId ? byId.get(activeId) : null;
  const manager = me.role === "ADMIN" || me.role === "ACCOUNT_MANAGER";
  const total = Object.values(cols).reduce((n, c) => n + c.length, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <h1 className="page-title">Projects</h1>
        <button className="btn-primary" onClick={() => setNewIn(meta.stages[0]?.id ?? null)}>
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <div className="flex items-center gap-0.5">
          {(["all", "mine"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn("rounded-md px-2.5 py-1 text-xs", scope === s ? "bg-hover text-zinc-100" : "text-muted hover:text-zinc-200")}
            >
              {s === "all" ? "All" : "My projects"}
            </button>
          ))}
        </div>
        <Menu
          width={220}
          trigger={() => (
            <button className="btn-ghost">
              <Building2 className="h-3.5 w-3.5" />
              {clientId ? meta.clients.find((c) => c.id === clientId)?.name : "All clients"}
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem active={!clientId} onClick={() => (setClientId(null), close())}>
                All clients
              </MenuItem>
              {meta.clients.map((c) => (
                <MenuItem key={c.id} active={clientId === c.id} onClick={() => (setClientId(c.id), close())}>
                  <StageDot color={c.color} /> {c.name}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
        <div className="ml-auto flex items-center gap-1.5">
          <Menu
            align="right"
            width={170}
            trigger={() => (
              <button className="btn-ghost" title="Sort">
                <ArrowDownWideNarrow className="h-3.5 w-3.5" /> {SORT_LABEL[sort]}
              </button>
            )}
          >
            {(close) =>
              (Object.keys(SORT_LABEL) as SortMode[]).map((s) => (
                <MenuItem key={s} active={sort === s} onClick={() => (setSort(s), close())}>
                  Sort by {SORT_LABEL[s].toLowerCase()}
                </MenuItem>
              ))
            }
          </Menu>
          <button
            className={cn("btn-ghost", selecting && "bg-hover text-zinc-100")}
            onClick={() => {
              setSelecting((s) => !s);
              setSelected(new Set());
            }}
          >
            <CheckSquare className="h-3.5 w-3.5" /> Select
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="input w-40 py-1 pl-7 text-xs md:w-56"
            />
          </div>
        </div>
      </div>

      {selecting && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2 text-xs">
          <span className="font-medium">{selected.size} selected</span>
          <button className="btn-ghost" onClick={() => setSelected(new Set(Object.values(cols).flat()))}>
            Select all ({total})
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Menu trigger={() => <button className="btn" disabled={!selected.size}>Set priority</button>} width={160}>
              {(close) =>
                PRIORITIES.map((p) => (
                  <MenuItem key={p} onClick={() => (bulkPriority(p), close())}>
                    <PriorityLabel priority={p} />
                  </MenuItem>
                ))
              }
            </Menu>
            <Menu trigger={() => <button className="btn" disabled={!selected.size}>Move to</button>} width={200}>
              {(close) =>
                meta.stages.map((s) => (
                  <MenuItem key={s.id} onClick={() => (bulkMove(s.id), close())}>
                    <StageDot color={s.color} /> {s.name}
                  </MenuItem>
                ))
              }
            </Menu>
            <button className="btn" disabled={!selected.size} onClick={() => bulkArchive([...selected])}>
              <Archive className="h-3.5 w-3.5" /> Archive selected
            </button>
            {manager && (
              <button
                className="btn text-red-400"
                disabled={!selected.size}
                onClick={() => {
                  if (!confirm(`Permanently delete ${selected.size} project(s) and their uploaded videos? This cannot be undone.`)) return;
                  const ids = [...selected];
                  setLocal((ps) => ps.filter((p) => !ids.includes(p.id)));
                  setSelected(new Set());
                  startTransition(() => deleteProjects(ids));
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
            <button className="btn-ghost" onClick={() => (setSelecting(false), setSelected(new Set()))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => (setDragCols(null), setActiveId(null))}
      >
        <div className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto px-4 pb-4">
          {meta.stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              ids={cols[stage.id] ?? []}
              byId={byId}
              selecting={selecting}
              selected={selected}
              onToggle={toggleSelect}
              onNew={() => setNewIn(stage.id)}
              onSelectColumn={(ids) => setSelected((s) => new Set([...s, ...ids]))}
              onArchiveColumn={(ids) => bulkArchive(ids)}
              sortable={!selecting}
              renderCard={(p) => (
                <Card
                  project={p}
                  stages={meta.stages}
                  selecting={selecting}
                  selected={selected.has(p.id)}
                  onToggle={() => toggleSelect(p.id)}
                  onOpen={() => router.push(`/projects/${p.id}`)}
                  onPriority={(pr) => setPriority(p.id, pr)}
                  onMove={(stageId) => {
                    setLocal((ps) => ps.map((x) => (x.id === p.id ? { ...x, stageId } : x)));
                    startTransition(() => moveProject(p.id, stageId, null, null));
                  }}
                  onArchive={() => {
                    setLocal((ps) => ps.filter((x) => x.id !== p.id));
                    startTransition(() => archiveProjects([p.id]));
                  }}
                  onDuplicate={() => startTransition(() => duplicateProject(p.id).then(() => router.refresh()))}
                  onDelete={
                    manager
                      ? () => {
                          if (!confirm(`Permanently delete "${p.title}" and its uploaded videos?`)) return;
                          setLocal((ps) => ps.filter((x) => x.id !== p.id));
                          startTransition(() => deleteProjects([p.id]));
                        }
                      : undefined
                  }
                />
              )}
            />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className="w-[264px] rotate-2 rounded-2xl bg-solid shadow-2xl">
              <CardBody project={active} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <NewProjectModal open={!!newIn} defaultStageId={newIn ?? ""} meta={meta} me={me.id} onClose={() => setNewIn(null)} />
    </div>
  );
}

function Column({
  stage,
  ids,
  byId,
  renderCard,
  onNew,
  selecting,
  selected,
  onSelectColumn,
  onArchiveColumn,
  sortable,
}: {
  stage: BoardMeta["stages"][number];
  ids: string[];
  byId: Map<string, BoardProject>;
  renderCard: (p: BoardProject) => React.ReactNode;
  onNew: () => void;
  selecting: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectColumn: (ids: string[]) => void;
  onArchiveColumn: (ids: string[]) => void;
  sortable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section className="flex w-[280px] shrink-0 flex-col">
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex items-center gap-2">
          {selecting && (
            <button
              onClick={() => onSelectColumn(ids)}
              title="Select whole column"
              className="text-muted hover:text-zinc-200"
            >
              {ids.length && ids.every((id) => selected.has(id)) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            </button>
          )}
          <StagePill name={stage.name} color={stage.color} />
          <span className="text-xs text-muted">{ids.length}</span>
        </div>
        <div className="flex items-center">
          <Menu
            align="right"
            width={210}
            trigger={() => (
              <button className="btn-ghost p-1">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            )}
          >
            {(close) => (
              <MenuItem onClick={() => (onArchiveColumn(ids), close())}>
                <Archive className="h-3.5 w-3.5" /> Archive all in column ({ids.length})
              </MenuItem>
            )}
          </Menu>
          <button className="btn-ghost px-1.5" onClick={onNew}>
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-line/60 bg-panel p-2",
          isOver && "border-line bg-panel",
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={!sortable}>
          {ids.map((id) => {
            const p = byId.get(id);
            return p ? <SortableItem key={id} id={id}>{renderCard(p)}</SortableItem> : null;
          })}
        </SortableContext>
        {ids.length === 0 && <div className="py-6 text-center text-xs text-zinc-600">Drop projects here</div>}
      </div>
    </section>
  );
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function dueInfo(dueDate: string | null) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const overdue = isBefore(d, startOfDay(new Date()));
  return { label: format(d, "do MMM"), overdue };
}

function CardBody({ project: p }: { project: BoardProject }) {
  const due = dueInfo(p.dueDate);
  return (
    <div
      className={cn(
        "group lux-card p-2.5 text-left hover:-translate-y-0.5",
        p.priority === "URGENT" && "border-l-2 border-l-red-500",
      )}
    >
      {p.thumb && (
        <div className="relative mb-2 aspect-[16/10] overflow-hidden rounded-md bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumb} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumb} alt="" className="relative mx-auto h-full object-contain" />
        </div>
      )}
      <div className="pr-6 text-[12.5px] font-medium leading-snug text-zinc-100 line-clamp-2">{p.title}</div>
      <div className="mt-0.5 text-[11px] text-muted">Added {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {p.client ? <EvergreenLabel name={p.client.name} color={p.client.color} /> : <span className="text-xs text-zinc-600">No client</span>}
        <PriorityLabel priority={p.priority} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        {due ? (
          <span className={cn("inline-flex items-center gap-1.5 text-xs", due.overdue ? "text-red-400" : "text-zinc-300")}>
            {due.overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5 text-muted" />}
            {due.label}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <Calendar className="h-3.5 w-3.5" /> Not Scheduled
          </span>
        )}
        <span className="flex items-center gap-2">
          {p.videos > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted" title="Edited videos">
              <Film className="h-3 w-3" />
              {p.videos}
            </span>
          )}
          {p.openComments > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-400" title="Open review notes">
              <MessageSquare className="h-3 w-3" />
              {p.openComments}
            </span>
          )}
          <AvatarStack users={p.members} size={18} max={3} />
        </span>
      </div>
    </div>
  );
}

function Card({
  project: p,
  stages,
  selecting,
  selected,
  onToggle,
  onOpen,
  onPriority,
  onMove,
  onArchive,
  onDuplicate,
  onDelete,
}: {
  project: BoardProject;
  stages: BoardMeta["stages"];
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onPriority: (p: PriorityT) => void;
  onMove: (stageId: string) => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn("relative cursor-pointer", selected && "rounded-lg ring-2 ring-accent")}
      onClick={() => (selecting ? onToggle() : onOpen())}
    >
      <CardBody project={p} />
      <div className="absolute right-1.5 top-1.5">
        {selecting ? (
          <span className="flex h-6 w-6 items-center justify-center rounded bg-card/80">
            {selected ? <CheckSquare className="h-4 w-4 text-accent" /> : <Square className="h-4 w-4 text-muted" />}
          </span>
        ) : (
          <Menu
            align="right"
            width={200}
            trigger={() => (
              <button className="rounded bg-card/80 p-1 text-muted opacity-70 hover:text-zinc-100 group-hover:opacity-100">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2 pb-1 pt-1.5 text-[11px] text-muted">Priority</div>
                <div className="grid grid-cols-1">
                  {PRIORITIES.map((pr) => (
                    <MenuItem key={pr} active={p.priority === pr} onClick={() => (onPriority(pr), close())}>
                      {PRIORITY_STYLE[pr].icon} {pr === "NONE" ? "No priority" : pr[0] + pr.slice(1).toLowerCase()}
                    </MenuItem>
                  ))}
                </div>
                <div className="my-1 border-t border-line" />
                <div className="px-2 pb-1 pt-1 text-[11px] text-muted">Move to</div>
                {stages
                  .filter((s) => s.id !== p.stageId)
                  .map((s) => (
                    <MenuItem key={s.id} onClick={() => (onMove(s.id), close())}>
                      <StageDot color={s.color} /> {s.name}
                    </MenuItem>
                  ))}
                <div className="my-1 border-t border-line" />
                <MenuItem onClick={() => (onDuplicate(), close())}>
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </MenuItem>
                <MenuItem onClick={() => (onArchive(), close())}>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </MenuItem>
                {onDelete && (
                  <MenuItem danger onClick={() => (onDelete(), close())}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        )}
      </div>
    </div>
  );
}
