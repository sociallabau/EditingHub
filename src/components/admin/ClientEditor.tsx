"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteClient, updateClient } from "@/lib/actions";

export function ClientEditor({ client, canManage }: { client: { id: string; name: string; color: string; notes: string }; canManage: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [name, setName] = useState(client.name);
  const [notes, setNotes] = useState(client.notes);
  const [saved, setSaved] = useState(false);
  const save = (data: Parameters<typeof updateClient>[1]) =>
    start(async () => {
      await updateClient(client.id, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          defaultValue={client.color}
          disabled={!canManage}
          onChange={(e) => save({ color: e.target.value })}
          className="h-9 w-9 cursor-pointer rounded border border-line bg-transparent"
        />
        <input
          value={name}
          disabled={!canManage}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== client.name && save({ name })}
          className="flex-1 bg-transparent text-[26px] font-semibold tracking-tight outline-none"
        />
        {saved && <span className="text-xs text-green-500">Saved</span>}
        {canManage && (
          <button
            className="btn-ghost"
            onClick={() =>
              confirm(`Delete client "${client.name}"? Their projects stay but lose the client tag.`) &&
              start(async () => {
                await deleteClient(client.id);
                router.push("/clients");
              })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <label className="label mt-4">Editing notes / brand rules (shown on every project for this client)</label>
      <textarea
        value={notes}
        disabled={!canManage}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== client.notes && save({ notes })}
        rows={5}
        placeholder={"e.g. Captions: white Montserrat Bold, centred, all caps\nAlways end with logo end card\nNo swearing, no trending audio"}
        className="input leading-relaxed"
      />
    </div>
  );
}
