import Link from "next/link";
import { formatDistanceToNow, startOfDay, subDays, addDays, format } from "date-fns";
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Eye, Repeat2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BrainGraph } from "@/components/pulse/BrainGraph";
import { ActivitySpark } from "@/components/pulse/ActivitySpark";
import { Avatar, PriorityLabel, StagePill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const user = await requireUser();
  const today = startOfDay(new Date());
  const since = subDays(today, 13);
  const [stages, projects, activity, videos30, recent, users] = await Promise.all([
    db.stage.findMany({ orderBy: { order: "asc" } }),
    db.project.findMany({
      where: { archived: false },
      select: {
        id: true, title: true, stageId: true, dueDate: true, priority: true, updatedAt: true,
        members: { select: { userId: true } },
      },
    }),
    db.activity.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.video.findMany({ where: { createdAt: { gte: subDays(today, 30) } }, select: { status: true } }),
    db.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 7,
      include: { actor: { select: { name: true, color: true } }, project: { select: { id: true } } },
    }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true, color: true } }),
  ]);

  const approvedStage = stages.find((s) => s.kind === "APPROVED");
  const reviewStage = stages.find((s) => s.kind === "REVIEW");
  const revisionStage = stages.find((s) => s.kind === "REVISIONS");
  const inFlight = projects.filter((p) => p.stageId !== approvedStage?.id);
  const count = (id?: string) => projects.filter((p) => p.stageId === id).length;
  const overdue = inFlight.filter((p) => p.dueDate && p.dueDate < today);
  const dueWeek = inFlight.filter((p) => p.dueDate && p.dueDate >= today && p.dueDate < addDays(today, 7));
  const approvedWeek = projects.filter((p) => p.stageId === approvedStage?.id && p.updatedAt >= subDays(today, 7)).length;
  const reviewed = videos30.filter((v) => v.status !== "PENDING");
  const revisionRate = reviewed.length ? Math.round((reviewed.filter((v) => v.status === "CHANGES_REQUESTED").length / reviewed.length) * 100) : null;
  const completion = projects.length ? Math.round((count(approvedStage?.id) / projects.length) * 100) : 0;

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(since, i);
    const n = activity.filter((a) => startOfDay(a.createdAt).getTime() === d.getTime()).length;
    return { label: format(d, "EEE d MMM"), value: n };
  });

  const load = users
    .map((u) => ({ ...u, n: inFlight.filter((p) => p.members.some((m) => m.userId === u.id)).length }))
    .filter((u) => u.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
  const maxLoad = Math.max(1, ...load.map((l) => l.n));

  const mine = inFlight
    .filter((p) => p.members.some((m) => m.userId === user.id))
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
    .slice(0, 5);
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const tile = "lux-card p-4";
  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <h1 className="page-title">Pulse</h1>
        </div>
        <Link href="/projects" className="btn">
          Open board <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-3 p-5 lg:grid-cols-4">
        {/* the "brain": pipeline graph */}
        <section className={`${tile} col-span-2 row-span-2 lg:col-span-3`}>
          <div className="flex items-baseline justify-between">
            <div className="text-[13px] font-semibold">Pipeline</div>
            <div className="text-[11px] text-muted">{projects.length} live projects · click a stage to open the board</div>
          </div>
          <BrainGraph total={projects.length} stages={stages.map((s) => ({ id: s.id, name: s.name, color: s.color, count: count(s.id) }))} />
        </section>

        {/* hero number on the accent tile */}
        <section className="rounded-2xl p-4 text-[#1c1310] shadow-[0_10px_40px_-12px_var(--eh-glow)]" style={{ background: "linear-gradient(140deg,#e0cba6,#b8996c)" }}>
          <div className="text-[13px] font-semibold">Approved</div>
          <div className="mt-2 flex items-center gap-4">
            <Ring pct={completion} />
            <div>
              <div className="text-[34px] font-semibold leading-none tracking-tight">{completion}%</div>
              <div className="mt-1 text-[11px] opacity-75">of live projects are through</div>
            </div>
          </div>
          <div className="mt-3 text-xs font-medium">{approvedWeek} approved in the last 7 days</div>
        </section>

        <section className={tile}>
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Eye className="h-4 w-4 text-muted" /> Waiting on review
          </div>
          <div className="mt-2 text-[34px] font-semibold leading-none tracking-tight">{count(reviewStage?.id)}</div>
          <div className="mt-1 text-[11px] text-muted">edits in {reviewStage?.name ?? "review"}</div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-300">
            <Repeat2 className="h-3.5 w-3.5 text-muted" /> {count(revisionStage?.id)} back with editors for changes
          </div>
        </section>

        <section className={tile}>
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <CalendarClock className="h-4 w-4 text-muted" /> Due this week
          </div>
          <div className="mt-2 text-[34px] font-semibold leading-none tracking-tight">{dueWeek.length}</div>
          <div className={`mt-3 flex items-center gap-1.5 text-xs ${overdue.length ? "text-red-400" : "text-green-500"}`}>
            {overdue.length ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {overdue.length ? `${overdue.length} overdue` : "Nothing overdue"}
          </div>
        </section>

        <section className={tile}>
          <div className="text-[13px] font-semibold">Revision rate</div>
          <div className="mt-2 text-[34px] font-semibold leading-none tracking-tight">{revisionRate == null ? "—" : `${revisionRate}%`}</div>
          <div className="mt-1 text-[11px] text-muted">
            {revisionRate == null ? "no edits reviewed in the last 30 days" : `of ${reviewed.length} reviewed edits needed changes (30 days)`}
          </div>
        </section>

        <section className={`${tile} col-span-2`}>
          <div className="flex items-baseline justify-between">
            <div className="text-[13px] font-semibold">Team activity</div>
            <div className="text-[11px] text-muted">updates per day · last 14 days</div>
          </div>
          <ActivitySpark days={days} />
        </section>

        <section className={`${tile} col-span-2`}>
          <div className="flex items-baseline justify-between">
            <div className="text-[13px] font-semibold">Workload</div>
            <div className="text-[11px] text-muted">projects in progress per person</div>
          </div>
          <div className="mt-3 space-y-2">
            {load.length === 0 && <p className="text-xs text-muted">Nobody is tagged on a live project yet.</p>}
            {load.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5" title={`${u.name}: ${u.n} projects in progress`}>
                <Avatar name={u.name} color={u.color} size={20} className="ring-0" />
                <span className="w-28 truncate text-xs">{u.name}</span>
                <div className="h-2 flex-1 rounded-full bg-hover">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(u.n / maxLoad) * 100}%` }} />
                </div>
                <span className="w-5 text-right text-xs tabular-nums text-zinc-300">{u.n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`${tile} col-span-2`}>
          <div className="text-[13px] font-semibold">Your queue</div>
          <div className="mt-2 divide-y divide-line">
            {mine.length === 0 && <p className="py-2 text-xs text-muted">You&apos;re not tagged on anything in progress.</p>}
            {mine.map((p) => {
              const s = stageById.get(p.stageId);
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 py-2 text-[13px] hover:text-accent">
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <PriorityLabel priority={p.priority} />
                  {s && <StagePill name={s.name} color={s.color} />}
                  <span className={`w-14 text-right text-[11px] ${p.dueDate && p.dueDate < today ? "text-red-400" : "text-muted"}`}>
                    {p.dueDate ? format(p.dueDate, "d MMM") : "—"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={`${tile} col-span-2`}>
          <div className="text-[13px] font-semibold">Latest</div>
          <div className="mt-2 space-y-2.5">
            {recent.length === 0 && <p className="text-xs text-muted">No activity yet.</p>}
            {recent.map((a) => (
              <Link key={a.id} href={`/projects/${a.project.id}`} className="flex gap-2.5 hover:opacity-80">
                <Avatar name={a.actor.name} color={a.actor.color} size={20} className="ring-0" />
                <div className="min-w-0">
                  <div className="truncate text-xs text-zinc-200">{a.message}</div>
                  <div className="text-[11px] text-muted">{formatDistanceToNow(a.createdAt, { addSuffix: true })}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" role="img" aria-label={`${pct}% approved`}>
      <circle cx="30" cy="30" r={r} fill="none" stroke="#1c131033" strokeWidth="7" />
      <circle
        cx="30" cy="30" r={r} fill="none" stroke="#1c1310" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 30 30)"
      />
    </svg>
  );
}
