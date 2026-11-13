import type { ReactNode } from "react";

// Minimal, safe markdown renderer for briefs/pages: headings, bullets, numbered lists,
// checkboxes, **bold**, *italic*, [links](url) and bare URLs. No raw HTML.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k} className="font-semibold text-zinc-50">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("*")) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else if (t.startsWith("[")) {
      const [, label, href] = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      out.push(<a key={k} href={href} target="_blank" rel="noreferrer" className="text-sky-400 underline">{label}</a>);
    } else out.push(<a key={k} href={t} target="_blank" rel="noreferrer" className="break-all text-sky-400 underline">{t}</a>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onToggleCheck }: { text: string; onToggleCheck?: (lineIndex: number) => void }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-[13.5px] leading-relaxed text-zinc-300">
      {lines.map((line, i) => {
        const k = String(i);
        let m: RegExpMatchArray | null;
        if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
          const level = m[1].length;
          const cls = level === 1 ? "text-xl mt-5" : level === 2 ? "text-[15px] mt-5 uppercase tracking-wide" : "text-sm mt-3";
          return <div key={k} className={`font-semibold text-zinc-50 ${cls}`}>{inline(m[2], k)}</div>;
        }
        if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s?(.*)/))) {
          const done = m[1].toLowerCase() === "x";
          return (
            <label key={k} className="flex cursor-pointer items-start gap-2" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={done} onChange={() => onToggleCheck?.(i)} className="mt-1 accent-[#f2542d]" />
              <span className={done ? "text-zinc-500 line-through" : ""}>{inline(m[2], k)}</span>
            </label>
          );
        }
        if ((m = line.match(/^\s*[-*]\s+(.*)/)))
          return <div key={k} className="flex gap-2 pl-1"><span className="text-zinc-500">•</span><span>{inline(m[1], k)}</span></div>;
        if ((m = line.match(/^\s*(\d+)\.\s+(.*)/)))
          return <div key={k} className="flex gap-2 pl-1"><span className="text-zinc-500">{m[1]}.</span><span>{inline(m[2], k)}</span></div>;
        if (!line.trim()) return <div key={k} className="h-2" />;
        return <p key={k}>{inline(line, k)}</p>;
      })}
    </div>
  );
}

