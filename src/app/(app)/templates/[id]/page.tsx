import { notFound } from "next/navigation";
import { requireUser, canManage } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Section, TemplatePage } from "@/lib/utils";
import { TemplateEditor } from "@/components/admin/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await db.template.findUnique({ where: { id } });
  if (!t) notFound();
  return (
    <TemplateEditor
      canEdit={canManage(user.role)}
      template={{
        id: t.id,
        name: t.name,
        description: t.description,
        color: t.color,
        defaultPriority: t.defaultPriority,
        sections: t.sections as Section[],
        pages: t.pages as TemplatePage[],
      }}
    />
  );
}
