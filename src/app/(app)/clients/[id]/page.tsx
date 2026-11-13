import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canManage } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientEditor } from "@/components/admin/ClientEditor";
import { FootageSection } from "@/components/project/FootageSection";
import { PriorityLabel, StagePill } from "@/components/ui";

export const dynamic = "force-dynamic";

const CLIENT_SECTIONS = [
  { key: "style", title: "Style Guide", hint: "Brand/style guide docs, fonts, colours, caption style" },
  { key: "brand", title: "Brand Assets", hint: "Logos, end cards, lower thirds, music" },
  { key: "reference", title: "Reference Edits", hint: "Edits the client loves — 'edit like this'" },
  { key: "broll", title: "B-roll Library", hint: "Reusable footage for this client (office, team, suburbs)" },
];

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const client = await db.client.findUnique({
    where: { id },
    include: {
      links: { orderBy: { createdAt: "asc" }, include: { addedBy: { select: { name: true, color: true } } } },
      projects: { where: { archived: false }, orderBy: { updatedAt: "desc" }, include: { stage: true } },
    },
  });
  if (!client) notFound();
  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm">
        <Link href="/clients" className="text-muted hover:text-zinc-100">
          Clients
        </Link>
        <span className="text-muted">/</span>
        <span className="font-semibold">{client.name}</span>
      </header>
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        <ClientEditor client={{ id: client.id, name: client.name, color: client.color, notes: client.notes }} canManage={canManage(user.role)} />
        {CLIENT_SECTIONS.map((s) => (
          <FootageSection
            key={s.key}
            clientId={client.id}
            section={s}
            compact
            links={client.links
              .filter((l) => l.section === s.key)
              .map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
          />
        ))}
        <div>
          <h3 className="mb-2 text-[15px] font-semibold">Active projects</h3>
          <div className="divide-y divide-line rounded-lg border border-line">
            {client.projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 px-3 py-2 text-[13px] hover:bg-panel">
                <span className="flex-1 truncate">{p.title}</span>
                <PriorityLabel priority={p.priority} />
                <StagePill name={p.stage.name} color={p.stage.color} />
              </Link>
            ))}
            {client.projects.length === 0 && <p className="p-3 text-xs text-muted">No active projects.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
