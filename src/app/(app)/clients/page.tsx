import Link from "next/link";
import { requireUser, canManage } from "@/lib/auth";
import { db } from "@/lib/db";
import { NewClient } from "@/components/admin/NewClient";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: { where: { archived: false } }, links: true } } },
  });
  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h1 className="text-sm font-semibold">Clients</h1>
      </header>
      <div className="mx-auto max-w-4xl p-6">
        <p className="mb-4 text-xs text-muted">
          Each client holds their style guide, brand assets and reference edits. They show up on every project for that client.
        </p>
        {canManage(user.role) && <NewClient />}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="panel flex items-center gap-3 p-3 hover:bg-card">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: c.color }}>
                {c.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <div className="text-[13px] font-medium">{c.name}</div>
                <div className="text-[11px] text-muted">
                  {c._count.projects} active projects · {c._count.links} assets
                </div>
              </div>
            </Link>
          ))}
        </div>
        {clients.length === 0 && <p className="mt-6 text-xs text-muted">No clients yet.</p>}
      </div>
    </div>
  );
}
