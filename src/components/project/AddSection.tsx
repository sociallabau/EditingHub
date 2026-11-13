"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addSection } from "@/lib/actions";

export function AddSection({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button className="btn-ghost" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add footage section
      </button>
    );
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        start(async () => {
          await addSection(projectId, title);
          setTitle("");
          setOpen(false);
        });
      }}
    >
      <input className="input max-w-xs" placeholder="e.g. Drone, Music, Logos" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <button className="btn-primary" disabled={pending}>Add</button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}
