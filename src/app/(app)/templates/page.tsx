import Link from "next/link";
import { requireUser, canManage } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Section, TemplatePage } from "@/lib/utils";
import { NewTemplate } from "@/components/admin/NewTemplate";
import { PriorityLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireUser();
  const templates = await db.template.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { projects: true } } } });
  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h1 className="text-sm font-semibold">Project templates</h1>
      </header>
      <div className="mx-auto max-w-4xl p-6">
        <p className="mb-4 text-xs text-muted">
          Templates decide which footage sections (Drive links / uploads) and pages (brief, shot list…) every new project starts with — so shooters
          just fill in the blanks instead of typing everything out.
        </p>
        {canManage(user.role) && <NewTemplate />}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const sections = t.sections as Section[];
            const pages = t.pages as TemplatePage[];
            return (
              <Link key={t.id} href={`/templates/${t.id}`} className="panel block p-4 hover:bg-card">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                  <span className="text-[13px] font-semibold">{t.name}</span>
                  <span className="ml-auto">
                    <PriorityLabel priority={t.defaultPriority} />
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{t.description || "—"}</p>
                <div className="mt-3 text-[11px] text-zinc-400">
                  <div>
                    <span className="text-muted">Footage:</span> {sections.map((s) => s.title).join(" · ") || "—"}
                  </div>
                  <div>
                    <span className="text-muted">Pages:</span> {pages.map((p) => p.title).join(" · ") || "—"}
                  </div>
                  <div className="mt-1 text-muted">Used by {t._count.projects} projects</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
