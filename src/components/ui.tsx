"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronsUp, Equal, ChevronDown, ArrowUpDown, X, Leaf } from "lucide-react";
import { cn, initials, PRIORITY_LABEL, type PriorityT } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = 20,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-bg", className)}
      style={{ width: size, height: size, background: color ?? "#52525b", fontSize: Math.max(9, size * 0.42) }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ users, max = 4, size = 20 }: { users: { id: string; name: string; color: string }[]; max?: number; size?: number }) {
  const shown = users.slice(0, max);
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((u) => (
        <Avatar key={u.id} name={u.name} color={u.color} size={size} />
      ))}
      {users.length > max && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-zinc-700 text-[9px] font-semibold ring-2 ring-bg"
          style={{ width: size, height: size }}
        >
          +{users.length - max}
        </span>
      )}
    </span>
  );
}

export const PRIORITY_STYLE: Record<PriorityT, { icon: ReactNode; text: string }> = {
  URGENT: {
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" fill="#ef4444" />
        <path d="M12 9v4M12 17h.01" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
    text: "text-zinc-200",
  },
  HIGH: { icon: <ChevronsUp className="h-3.5 w-3.5 text-red-400" />, text: "text-zinc-200" },
  MEDIUM: { icon: <Equal className="h-3.5 w-3.5 text-amber-400" />, text: "text-zinc-200" },
  LOW: { icon: <ChevronDown className="h-3.5 w-3.5 text-sky-400" />, text: "text-zinc-200" },
  NONE: { icon: <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />, text: "text-zinc-500" },
};

export function PriorityLabel({ priority }: { priority: PriorityT }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", s.text)}>
      {s.icon}
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function EvergreenLabel({ name = "Evergreen", color }: { name?: string; color?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-zinc-200">
      <Leaf className="h-3.5 w-3.5 shrink-0" style={{ color: color ?? "#22c55e" }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Dropdown menu anchored to its trigger, rendered in a portal so it isn't clipped by board columns. */
export function Menu({
  trigger,
  children,
  align = "left",
  width = 220,
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = btn.current!.getBoundingClientRect();
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = r.bottom + 4 + 320 > window.innerHeight ? Math.max(8, r.top - 4 - 320) : r.bottom + 4;
    setPos({ top, left });
    setOpen((o) => !o);
  };

  return (
    <>
      <span ref={btn} onClick={toggle} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="inline-flex">
        {trigger(open)}
      </span>
      {open &&
        createPortal(
          <div
            ref={panel}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 max-h-[320px] overflow-auto rounded-lg border border-line bg-card p-1 shadow-2xl"
            style={{ top: pos.top, left: pos.left, width }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  children,
  onClick,
  danger,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-hover",
        danger ? "text-red-400" : "text-zinc-200",
        active && "bg-hover",
      )}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[10vh]" onMouseDown={onClose} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel w-full shadow-2xl" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function StageDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

export function StagePill({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold text-black" style={{ background: color }}>
      {name}
    </span>
  );
}
