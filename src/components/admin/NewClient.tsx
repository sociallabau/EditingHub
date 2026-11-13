"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/actions";

export function NewClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f2542d");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        start(async () => {
          try {
            const id = await createClient(name, color);
            router.push(`/clients/${id}`);
          } catch {
            setError("A client with that name already exists");
          }
        });
      }}
    >
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-line bg-transparent" />
      <input className="input max-w-xs" placeholder="Client name, e.g. Kaizal" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn-primary" disabled={pending}>
        <Plus className="h-3.5 w-3.5" /> Add client
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </form>
  );
}
