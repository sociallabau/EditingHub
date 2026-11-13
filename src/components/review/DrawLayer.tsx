"use client";

import { useEffect, useRef, useState } from "react";

export type Stroke = { color: string; points: [number, number][] };
export const PEN_COLORS = ["#ff4d3d", "#ffd23f", "#ffffff"];

/**
 * SVG overlay pinned exactly over the displayed video frame. Strokes are stored in 0–1
 * coordinates so they line up at any player size.
 */
export function DrawLayer({
  videoRef,
  strokes,
  drawing,
  color,
  onChange,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  strokes: Stroke[];
  drawing: boolean;
  color: string;
  onChange?: (s: Stroke[]) => void;
}) {
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const live = useRef<Stroke | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const measure = () => setBox({ left: v.offsetLeft, top: v.offsetTop, width: v.clientWidth, height: v.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    if (v.parentElement) ro.observe(v.parentElement);
    v.addEventListener("loadedmetadata", measure);
    return () => {
      ro.disconnect();
      v.removeEventListener("loadedmetadata", measure);
    };
  }, [videoRef]);

  const point = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  };

  if (!box.width || (!drawing && strokes.length === 0)) return null;
  const all = live.current ? [...strokes, live.current] : strokes;

  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className="absolute"
      style={{ ...box, cursor: drawing ? "crosshair" : "default", pointerEvents: drawing ? "auto" : "none", touchAction: "none" }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        if (!drawing) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        live.current = { color, points: [point(e)] };
        force((n) => n + 1);
      }}
      onPointerMove={(e) => {
        if (!live.current) return;
        live.current.points.push(point(e));
        force((n) => n + 1);
      }}
      onPointerUp={() => {
        if (!live.current) return;
        const done = live.current;
        live.current = null;
        if (done.points.length === 1) done.points.push([done.points[0][0] + 0.001, done.points[0][1] + 0.001]);
        onChange?.([...strokes, done]);
      }}
    >
      {all.map((s, i) => (
        <polyline
          key={i}
          points={s.points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(" ")}
          fill="none"
          stroke={s.color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}
        />
      ))}
    </svg>
  );
}
