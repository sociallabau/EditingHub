"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

export type MentionUser = { id: string; name: string; color: string };
export type MentionInputHandle = { focus: () => void };

/** Textarea with @mention suggestions. Enter sends, Shift+Enter for a new line. */
export const MentionInput = forwardRef<
  MentionInputHandle,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    users: MentionUser[];
    placeholder?: string;
    onFocus?: () => void;
    rows?: number;
    className?: string;
  }
>(function MentionInput({ value, onChange, onSubmit, users, placeholder, onFocus, rows = 3, className }, ref) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const pendingCaret = useRef<number | null>(null);
  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }));
  useLayoutEffect(() => {
    if (pendingCaret.current != null && area.current) {
      area.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  const matches = query === null ? [] : users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  const detect = (v: string, caret: number) => {
    const m = v.slice(0, caret).match(/(?:^|\s)@([\w ]{0,20})$/);
    setQuery(m && !m[1].includes("  ") ? m[1] : null);
    setIndex(0);
  };

  const pick = (u: MentionUser) => {
    const el = area.current!;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([\w ]{0,20})$/, `@${u.name.split(" ")[0]} `);
    const next = before + value.slice(caret);
    pendingCaret.current = before.length;
    onChange(next);
    setQuery(null);
    el.focus();
  };

  return (
    <div className="relative">
      {matches.length > 0 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-lg border border-line bg-card p-1 shadow-xl">
          {matches.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => (e.preventDefault(), pick(u))}
              className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs", i === index && "bg-hover")}
            >
              <Avatar name={u.name} color={u.color} size={18} className="ring-0" /> {u.name}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={area}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onFocus={onFocus}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (matches.length) {
            if (e.key === "ArrowDown") return e.preventDefault(), setIndex((i) => (i + 1) % matches.length);
            if (e.key === "ArrowUp") return e.preventDefault(), setIndex((i) => (i - 1 + matches.length) % matches.length);
            if (e.key === "Enter" || e.key === "Tab") return e.preventDefault(), pick(matches[index]);
            if (e.key === "Escape") return setQuery(null);
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={cn("w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-zinc-500", className)}
      />
    </div>
  );
});

/** Highlight @mentions in rendered comment text. */
export function CommentText({ text }: { text: string }) {
  const parts = text.split(/(@[A-Za-z][\w]*)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.startsWith("@") ? (
          <span key={i} className="rounded bg-accent/15 px-0.5 text-orange-300">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </span>
  );
}
