"use client";

import { useState } from "react";

export function ActivitySpark({ days }: { days: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 120;
  const max = Math.max(1, ...days.map((d) => d.value));
  const step = W / days.length;
  const bw = Math.min(22, step - 8);
  const total = days.reduce((n, d) => n + d.value, 0);
  const shown = hover != null ? days[hover] : null;
  return (
    <div className="mt-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[26px] font-semibold leading-none tracking-tight">{shown ? shown.value : total}</span>
        <span className="text-[11px] text-muted">{shown ? `updates · ${shown.label}` : "updates in total"}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Updates per day" onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--color-border)" />
        {days.map((d, i) => {
          const h = d.value ? Math.max(4, (d.value / max) * (H - 14)) : 2;
          const x = i * step + (step - bw) / 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={i * step} y="0" width={step} height={H} fill="transparent" />
              <rect
                x={x} y={H - h} width={bw} height={h} rx="4"
                fill="var(--color-accent)"
                opacity={hover == null || hover === i ? (d.value ? 1 : 0.3) : 0.35}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10.5px] text-muted">
        <span>{days[0]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  );
}
