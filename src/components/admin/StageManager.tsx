"use client";

import { useState, useTransition } from "react";
import type { StageKind } from "@prisma/client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { createStage, deleteStage, reorderStages, updateStage } from "@/lib/actions";
import { StagePill } from "../ui";

type S = { id: string; name: string; color: string; kind: StageKind; count: number };
const KIND_LABEL: Record<StageKind, string> = {
  NORMAL: "Normal column",
  REVIEW: "Auto: new edit uploaded",
  REVISIONS: "Auto: changes requested",
  APPROVED: "Auto: edit approved",
};

export function StageManager({ stages }: { stages: S[] }) {
  const [, start] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#a855f7");
  const reorder = (i: number, d: number) => {
    const ids = stages.map((s) => s.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(() => reorderStages(ids));
  };
  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-line px-4 py-2.5">
        <h1 className="text-sm font-semibold">Board columns</h1>
      </header>
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <p className="text-xs text-muted">
          Rename, recolour and reorder the Kanban columns. Add per-editor columns like “Michal To Edit”. The “Auto” settings move projects
          automatically when an edit is uploaded, sent back for changes, or approved.
        </p>
        <div className="divide-y divide-line rounded-lg border border-line">
          {stages.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <input
                type="color"
                defaultValue={s.color}
                onBlur={(e) => e.target.value !== s.color && start(() => updateStage(s.id, { color: e.target.value }))}
                className="h-7 w-7 cursor-pointer rounded border border-line bg-transparent"
              />
              <input
                defaultValue={s.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && start(() => updateStage(s.id, { name: e.target.value }))}
                className="input w-48"
              />
              <StagePill name={s.name} color={s.color} />
              <span className="text-[11px] text-muted">{s.count} projects</span>
              <select
                className="input ml-auto w-52"
                value={s.kind}
                onChange={(e) => start(() => updateStage(s.id, { kind: e.target.value as StageKind }))}
              >
                {(Object.keys(KIND_LABEL) as StageKind[]).map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
              <button className="btn-ghost p-1.5" onClick={() => reorder(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button className="btn-ghost p-1.5" onClick={() => reorder(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
              <button
                className="btn-ghost p-1.5"
                onClick={() =>
                  confirm(`Delete column "${s.name}"?`) &&
                  start(async () => {
                    try {
                      await deleteStage(s.id);
                    } catch (e) {
                      alert((e as Error).message);
                    }
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            start(() => createStage(name, color));
            setName("");
          }}
        >
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-line bg-transparent" />
          <input className="input max-w-xs" placeholder="New column, e.g. Michal To Edit" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary"><Plus className="h-3.5 w-3.5" /> Add column</button>
        </form>
      </div>
    </div>
  );
}
