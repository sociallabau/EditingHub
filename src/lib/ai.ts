import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

const GATEWAY = "https://ai-gateway.vercel.sh";

/**
 * Claude access. Uses ANTHROPIC_API_KEY when set; otherwise Vercel AI Gateway
 * (AI_GATEWAY_API_KEY, or the project's own OIDC token when running on Vercel).
 */
async function getAi(): Promise<{ client: Anthropic; model: string; gateway: boolean } | null> {
  if (process.env.ANTHROPIC_API_KEY) return { client: new Anthropic(), model: "claude-opus-5-5", gateway: false };
  let token = process.env.AI_GATEWAY_API_KEY;
  if (!token && process.env.VERCEL) {
    try {
      const { getVercelOidcToken } = await import("@vercel/oidc");
      token = await getVercelOidcToken();
    } catch {}
  }
  if (!token) return null;
  return { client: new Anthropic({ apiKey: token, baseURL: GATEWAY }), model: "anthropic/claude-opus-5-5", gateway: true };
}

export async function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL);
}

export class AiError extends Error {}

function explain(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AiError("The AI key was rejected — check ANTHROPIC_API_KEY in Vercel.");
  if (e instanceof Anthropic.RateLimitError) return new AiError("AI is rate limited right now — try again in a minute.");
  if (e instanceof Anthropic.APIError) {
    if (/credit card/i.test(e.message))
      return new AiError("AI isn't switched on yet: add a card to Vercel AI Gateway (free monthly credits) or set ANTHROPIC_API_KEY.");
    return new AiError(`AI request failed (${e.status ?? "network"}): ${e.message.slice(0, 200)}`);
  }
  return new AiError((e as Error)?.message || "AI request failed");
}

type Content = Anthropic.MessageParam["content"];

export async function askText(system: string, content: Content, effort: "low" | "medium" | "high" = "medium") {
  const ai = await getAi();
  if (!ai) throw new AiError("AI isn't configured — set ANTHROPIC_API_KEY.");
  try {
    const res = await ai.client.messages.create({
      model: ai.model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort },
    });
    if (res.stop_reason === "refusal") throw new AiError("The AI declined this request.");
    return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (e) {
    throw explain(e);
  }
}

export async function askJson<S extends z.ZodType>(
  schema: S,
  system: string,
  content: Content,
  effort: "low" | "medium" | "high" = "low",
): Promise<z.infer<S>> {
  const ai = await getAi();
  if (!ai) throw new AiError("AI isn't configured — set ANTHROPIC_API_KEY.");
  try {
    const res = await ai.client.messages.parse({
      model: ai.model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: zodOutputFormat(schema) },
    });
    if (res.stop_reason === "refusal") throw new AiError("The AI declined this request.");
    if (res.parsed_output == null) throw new AiError("The AI returned an unreadable answer — try again.");
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    // Some gateways don't pass structured-output config through: fall back to prompted JSON.
    if (ai.gateway && e instanceof Anthropic.BadRequestError) {
      const text = await askText(`${system}\n\nReply with a single JSON object only — no prose, no code fences.`, content, effort);
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const parsed = schema.safeParse(JSON.parse(text.slice(start, end + 1)));
      if (!parsed.success) throw new AiError("The AI returned an unreadable answer — try again.");
      return parsed.data;
    }
    throw explain(e);
  }
}
