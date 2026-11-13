"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FolderOpen, FileText, Plus, Trash2, X } from "lucide-react";
import { deleteTemplate, updateTemplate } from "@/lib/actions";
import { PRIORITIES, slugKey, type PriorityT, type Section, type TemplatePage } from "@/lib/utils";
import { PriorityLabel } from "../ui";

type T = {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultPriority: PriorityT;
  sections: Section[];
  pages: TemplatePage[];
};

function move<X>(arr: X[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

export function TemplateEditor({ template, canEdit }: { template: T; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [t, setT] = useState(template);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (patch: Partial<T>) => (setT((x) => ({ ...x, ...patch })), setDirty(true));

  const save = () =>
    start(async () => {
      await updateTemplate(t.id, {
        name: t.name,
        description: t.description,
        color: t.color,
        defaultPriority: t.defaultPriority,
        sections: t.sections.filter((s) => s.title.trim()),
        pages: t.pages.filter((p) => p.title.trim()),
      });
      setDirty(false);
      setMsg("Saved — new projects will use this.");
      setTimeout(() => setMsg(""), 2500);
    });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm">
        <Link href="/templates" className="text-muted hover:text-zinc-100">
          Templates
        </Link>
        <span className="text-muted">/</span>
        <span className="font-semibold">{t.name}</span>
        <div className="ml-auto flex items-center gap-2">
          {msg && <span className="text-xs text-green-500">{msg}</span>}
          {canEdit && (
            <>
              <button
                className="btn-ghost"
                onClick={() =>
                  confirm(`Delete the "${t.name}" template? Existing projects are not affected.`) &&
                  start(async () => {
                    await deleteTemplate(t.id);
                    router.push("/templates");
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button className="btn-primary" onClick={save} disabled={!dirty || pending}>
                {pending ? "Saving…" : "Save template"}
              </button>
            </>
          )}
        </div>
      </header>
      <fieldset disabled={!canEdit} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 p-6">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <input type="color" value={t.color} onChange={(e) => set({ color: e.target.value })} className="h-9 w-9 cursor-pointer rounded border border-line bg-transparent" />
            <input value={t.name} onChange={(e) => set({ name: e.target.value })} className="bg-transparent text-2xl font-semibold outline-none" />
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <input className="input" value={t.description} onChange={(e) => set({ description: e.target.value })} placeholder="When should people use this template?" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Default priority</label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map((p) => (
                  <button type="button" key={p} onClick={() => set({ defaultPriority: p })} className={`chip ${t.defaultPriority === p ? "border-zinc-400 bg-hover" : ""}`}>
                    <PriorityLabel priority={p} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section>
            <h3 className="text-[15px] font-semibold">Footage & asset sections</h3>
            <p className="mb-3 text-xs text-muted">Each becomes a tab on the project where people link Google Drive folders or upload files.</p>
            <div className="space-y-2">
              {t.sections.map((s, i) => (
                <div key={s.key} className="flex items-start gap-2 rounded-lg border border-line bg-card p-2">
                  <FolderOpen className="mt-2 h-4 w-4 shrink-0 text-muted" />
                  <div className="grid flex-1 gap-1.5 sm:grid-cols-[1fr_2fr]">
                    <input className="input" value={s.title} placeholder="Section name" onChange={(e) => set({ sections: t.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                    <input className="input" value={s.hint ?? ""} placeholder="Hint for the shooter (what goes here?)" onChange={(e) => set({ sections: t.sections.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)) })} />
                  </div>
                  <button type="button" className="btn-ghost p-1.5" onClick={() => set({ sections: move(t.sections, i, -1) })}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" className="btn-ghost p-1.5" onClick={() => set({ sections: move(t.sections, i, 1) })}><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" className="btn-ghost p-1.5" onClick={() => set({ sections: t.sections.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button type="button" className="btn-ghost" onClick={() => set({ sections: [...t.sections, { key: slugKey("section"), title: "", hint: "" }] })}>
                <Plus className="h-3.5 w-3.5" /> Add section
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-[15px] font-semibold">Pages</h3>
            <p className="mb-3 text-xs text-muted">
              Pre-filled pages (brief, shot list, details). Supports ## headings, - bullets, - [ ] checklists, **bold** and links.
            </p>
            <div className="space-y-3">
              {t.pages.map((p, i) => (
                <div key={i} className="rounded-lg border border-line bg-card p-2">
                  <div className="mb-1.5 flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted" />
                    <input className="input" value={p.title} placeholder="Page title" onChange={(e) => set({ pages: t.pages.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                    <button type="button" className="btn-ghost p-1.5" onClick={() => set({ pages: move(t.pages, i, -1) })}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className="btn-ghost p-1.5" onClick={() => set({ pages: move(t.pages, i, 1) })}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" className="btn-ghost p-1.5" onClick={() => set({ pages: t.pages.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <textarea
                    className="input min-h-[160px] font-mono text-[12.5px] leading-relaxed"
                    value={p.content}
                    onChange={(e) => set({ pages: t.pages.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)) })}
                  />
                </div>
              ))}
              <button type="button" className="btn-ghost" onClick={() => set({ pages: [...t.pages, { title: "", content: "" }] })}>
                <Plus className="h-3.5 w-3.5" /> Add page
              </button>
            </div>
          </section>
        </div>
      </fieldset>
    </div>
  );
}
