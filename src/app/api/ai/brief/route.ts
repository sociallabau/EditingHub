import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AiError, askText } from "@/lib/ai";
import { logAndNotify } from "@/lib/notify";
import type { Section } from "@/lib/utils";

export const maxDuration = 300;

const Body = z.object({ projectId: z.string(), notes: z.string().max(4000).default("") });

const SYSTEM = `You are the senior editor at a social-media content agency that makes short-form video (Reels/TikTok/Shorts) for real-estate agents and agencies.
A videographer has just shot footage. From the raw clip transcripts and project details, write the editing brief the editor will work from.

Write in Markdown using exactly these sections:
## The idea — two sentences: what this video is and who it is for.
## Hook options — three opening lines, each quoting or closely adapting something actually said, with the clip name and timestamp.
## Best soundbites — a bullet list of the strongest lines to keep: "quote" — clip name @ mm:ss. Up to 10, best first.
## Suggested cut — a numbered sequence from hook to call-to-action, each step naming the clip and timestamp range to use and what b-roll or supporting asset to lay over it.
## On-screen text — captions, titles or stat callouts worth adding. Spell names and suburbs exactly as given in the project details.
## Leave out — tangents, stumbles or repeated takes to cut, with timestamps.
## Questions for the shooter — only if something essential is missing or unclear.

Rules: quote the speaker's real words; never invent quotes, numbers or facts. Timestamps come from the transcripts and are mm:ss within that clip. Follow the client's editing notes where they apply. Keep it tight — an editor should be able to read it in two minutes. Use "-" bullets and "1." numbering only; no tables.`;

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const p = await db.project.findUnique({
    where: { id: body.data.projectId },
    include: {
      client: true,
      template: true,
      pages: { orderBy: { order: "asc" } },
      links: true,
      transcripts: { where: { kind: "RAW" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!p.transcripts.length && !body.data.notes.trim())
    return NextResponse.json({ error: "Add at least one raw clip (or some notes) first." }, { status: 400 });

  const sections = p.sections as Section[];
  const assets = sections
    .map((s) => {
      const names = p.links.filter((l) => l.section === s.key).map((l) => l.label);
      return `- ${s.title}: ${names.length ? names.join(", ") : "nothing linked yet"}`;
    })
    .join("\n");
  const pages = p.pages
    .filter((pg) => pg.title !== "AI Brief" && pg.content.trim())
    .map((pg) => `### ${pg.title}\n${pg.content}`)
    .join("\n\n");
  const clips = p.transcripts
    .map((t) => {
      const segs = t.segments as { start: number; text: string }[];
      const lines = segs.length ? segs.map((s) => `[${mmss(s.start)}] ${s.text.trim()}`).join("\n") : t.text;
      return `<clip name="${t.sourceName}" duration="${t.duration ? mmss(t.duration) : "unknown"}">\n${lines}\n</clip>`;
    })
    .join("\n\n");

  const prompt = `<project>
Title: ${p.title}
Client: ${p.client?.name ?? "none"}
Video type: ${p.template?.name ?? "general"}${p.template?.description ? ` — ${p.template.description}` : ""}
Description: ${p.description || "none"}
</project>

<client_editing_notes>
${p.client?.notes || "none"}
</client_editing_notes>

<footage_and_assets_available>
${assets}
</footage_and_assets_available>

<notes_already_on_the_project>
${pages || "none"}
</notes_already_on_the_project>

<videographer_notes>
${body.data.notes || "none"}
</videographer_notes>

<raw_clip_transcripts>
${clips || "No clips were transcribed — work from the notes above and say what footage you would need."}
</raw_clip_transcripts>

Write the editing brief.`;

  try {
    const md = await askText(SYSTEM, prompt, "medium");
    const existing = p.pages.find((pg) => pg.title === "AI Brief");
    const page = existing
      ? await db.page.update({ where: { id: existing.id }, data: { content: md } })
      : await db.page.create({ data: { projectId: p.id, title: "AI Brief", content: md, order: -1 } });
    await logAndNotify({ projectId: p.id, actorId: user.id, message: `${user.name} generated an AI brief for "${p.title}"` });
    revalidatePath("/", "layout");
    return NextResponse.json({ pageId: page.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof AiError ? e.message : "Couldn't generate the brief" }, { status: 502 });
  }
}
