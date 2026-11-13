import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AiError, askJson } from "@/lib/ai";

export const maxDuration = 300;

const Body = z.object({
  videoId: z.string(),
  frames: z.array(z.object({ time: z.number(), data: z.string() })).min(1).max(16),
});

const Issues = z.object({
  issues: z.array(
    z.object({
      time: z.number().describe("timestamp in seconds of the frame where the problem is visible"),
      seen: z.string().describe("the on-screen text exactly as it appears"),
      issue: z.string().describe("what is wrong, in a few words"),
      suggestion: z.string().describe("the corrected text"),
    }),
  ),
});

const SYSTEM = `You proofread short-form social videos for a real-estate content agency before they go to an account manager.
You are given still frames from an edited video (each labelled with its timestamp) and the transcript of what is said.
Report problems with ON-SCREEN TEXT only: burned-in captions, titles, lower thirds, labels.
Flag: spelling mistakes, a caption word that does not match what was actually said (e.g. caption "soot field" when the speaker says "suit filled"), missing plurals or dropped words, wrong names or suburbs, obvious grammar errors, and text that is cut off by the frame edge.
Do not flag: stylistic choices (all caps, no punctuation, one word at a time), Australian spelling, slang the speaker really used, or anything you cannot read clearly.
Only report an issue when you are confident. The same mistake visible in several frames is one issue — use the earliest timestamp. If everything is fine, return an empty list.`;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const video = await db.video.findUnique({ where: { id: body.data.videoId }, include: { transcript: true } });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  const segs = (video.transcript?.segments as { start: number; end: number; text: string }[] | undefined) ?? [];
  const t0 = body.data.frames[0].time - 4;
  const t1 = body.data.frames[body.data.frames.length - 1].time + 4;
  const spoken = segs
    .filter((s) => s.end >= t0 && s.start <= t1)
    .map((s) => `[${s.start.toFixed(1)}s] ${s.text.trim()}`)
    .join("\n");

  const content = [
    {
      type: "text" as const,
      text: spoken
        ? `Transcript of what is said in this part of the video:\n${spoken}`
        : "No transcript is available for this video — judge the on-screen text on its own.",
    },
    ...body.data.frames.flatMap((f) => [
      { type: "text" as const, text: `Frame at ${f.time.toFixed(1)}s:` },
      { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.data } },
    ]),
  ];

  try {
    const out = await askJson(Issues, SYSTEM, content, "low");
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof AiError ? e.message : "AI check failed" }, { status: 502 });
  }
}
