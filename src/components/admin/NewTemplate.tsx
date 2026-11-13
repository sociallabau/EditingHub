"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTemplate } from "@/lib/actions";

export function NewTemplate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => router.push(`/templates/${await createTemplate(name)}`));
      }}
    >
      <input className="input max-w-xs" placeholder="Template name, e.g. Market Update" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn-primary" disabled={pending}>
        <Plus className="h-3.5 w-3.5" /> New template
      </button>
    </form>
  );
}
