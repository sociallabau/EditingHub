"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Check, Pencil, Trash2 } from "lucide-react";
import { deletePage, updatePage } from "@/lib/actions";
import { Markdown } from "../Markdown";

export function PageEditor({ page }: { page: { id: string; title: string; content: string; updatedAt: string } }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [editing, setEditing] = useState(!page.content.trim());
  const [status, setStatus] = useState<"saved" | "saving" | "dirty">("saved");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const area = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ title, content });
  latest.current = { title, content };

  const save = () => {
    clearTimeout(timer.current);
    setStatus("saving");
    start(async () => {
      await updatePage(page.id, latest.current);
      setStatus("saved");
    });
  };

  const queue = () => {
    setStatus("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 900);
  };

  // flush unsaved changes when leaving the page
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      updatePage(page.id, latest.current);
    }
  }, [page.id]);

  useEffect(() => {
    const el = area.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.max(320, el.scrollHeight) + "px";
    }
  }, [content, editing]);

  const toggleCheck = (line: number) => {
    const lines = content.split("\n");
    lines[line] = lines[line].replace(/\[( |x|X)\]/, (m) => (m === "[ ]" ? "[x]" : "[ ]"));
    setContent(lines.join("\n"));
    queue();
  };

  return (
    <div>
      <div className="flex items-start gap-2">
        <input
          value={title}
          onChange={(e) => (setTitle(e.target.value), queue())}
          className="min-w-0 flex-1 bg-transparent font-heading text-[28px] font-medium tracking-tight outline-none"
          placeholder="Untitled"
        />
        <button className="btn" onClick={() => (editing && status !== "saved" && save(), setEditing((e) => !e))}>
          {editing ? <><Check className="h-3.5 w-3.5" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
        </button>
        <button
          className="btn-ghost p-2"
          title="Delete page"
          onClick={() => {
            if (!confirm(`Delete page "${title}"?`)) return;
            clearTimeout(timer.current);
            timer.current = undefined;
            start(async () => {
              await deletePage(page.id);
              router.push(location.pathname);
            });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mb-4 mt-1 text-[11px] text-muted">
        {status === "saved" ? `Saved · edited ${formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}` : status === "saving" ? "Saving…" : "Unsaved changes"}
      </div>
      {editing ? (
        <>
          <textarea
            ref={area}
            value={content}
            onChange={(e) => (setContent(e.target.value), queue())}
            className="w-full resize-none rounded-lg border border-line bg-card p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-zinc-500"
            placeholder={"## Heading\n- bullet point\n- [ ] checklist item\n**bold**, links: https://…"}
            autoFocus
          />
          <p className="mt-1 text-[11px] text-muted">Formatting: ## heading · - bullet · - [ ] checklist · **bold** · paste links</p>
        </>
      ) : (
        <div className="min-h-[200px] cursor-text rounded-lg p-1" onDoubleClick={() => setEditing(true)}>
          {content.trim() ? <Markdown text={content} onToggleCheck={toggleCheck} /> : <p className="text-muted">Empty page — click Edit to write.</p>}
        </div>
      )}
    </div>
  );
}
