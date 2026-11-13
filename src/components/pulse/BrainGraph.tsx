import Link from "next/link";

type Node = { id: string; name: string; color: string; count: number };

/** Central "core" with glowing branches out to each board stage; branch weight follows the count. */
export function BrainGraph({ stages, total }: { stages: Node[]; total: number }) {
  const W = 900;
  const H = Math.max(300, stages.length * 58 + 30);
  const cx = 150;
  const cy = H / 2;
  const nx = 470;
  const gap = (H - 40) / Math.max(1, stages.length);
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="mt-2 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px]" role="img" aria-label="Projects per stage">
        <defs>
          <radialGradient id="core" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#f3e6cc" />
            <stop offset="45%" stopColor="#c9b28c" />
            <stop offset="100%" stopColor="#704e32" />
          </radialGradient>
          <radialGradient id="halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c9b28c" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#c9b28c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wire" x1="0" x2="1">
            <stop offset="0%" stopColor="#c9b28c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#c9b28c" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {stages.map((s, i) => {
          const y = 20 + gap * i + gap / 2;
          const d = `M ${cx + 46} ${cy} C ${cx + 190} ${cy}, ${nx - 170} ${y}, ${nx} ${y}`;
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke="url(#wire)" strokeWidth={s.count ? 1.5 + (s.count / max) * 4 : 1} strokeOpacity={s.count ? 1 : 0.35} strokeLinecap="round" />
              {s.count > 0 && (
                <circle r="3" fill="#f3e6cc">
                  <animateMotion dur={`${3.2 + i * 0.45}s`} repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}

        <circle cx={cx} cy={cy} r="120" fill="url(#halo)">
          <animate attributeName="r" values="105;125;105" dur="4.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r="74" fill="none" stroke="#c9b28c" strokeOpacity="0.18" strokeDasharray="3 7">
          <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="40s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r="58" fill="none" stroke="#c9b28c" strokeOpacity="0.3" />
        <circle cx={cx} cy={cy} r="46" fill="url(#core)" />
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="30" fontWeight="600" fill="#1c1310">{total}</text>
        <text x={cx} y={cy + 19} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#1c1310" opacity="0.7" letterSpacing="1">LIVE</text>

        {stages.map((s, i) => {
          const y = 20 + gap * i + gap / 2;
          return (
            <Link key={s.id} href="/projects">
              <g className="cursor-pointer">
                <title>{`${s.name}: ${s.count} project${s.count === 1 ? "" : "s"}`}</title>
                <rect x={nx} y={y - 21} width="270" height="42" rx="13" fill="var(--eh-glass-2)" stroke="var(--color-border)" />
                <rect x={nx + 12} y={y - 9} width="4" height="18" rx="2" fill={s.color} />
                <text x={nx + 28} y={y + 6} fontSize="19" fontWeight="600" fill="var(--color-text-primary)">{s.count}</text>
                <text x={nx + 62} y={y + 4.5} fontSize="12.5" fill="var(--color-text-secondary)">{s.name}</text>
                <rect x={nx + 290} y={y - 3} width={130} height="6" rx="3" fill="var(--color-track)" opacity="0.5" />
                {s.count > 0 && <rect x={nx + 290} y={y - 3} width={Math.max(6, (s.count / max) * 130)} height="6" rx="3" fill="var(--color-accent)" />}
              </g>
            </Link>
          );
        })}
      </svg>
    </div>
  );
}
