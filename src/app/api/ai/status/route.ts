import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";

export async function GET() {
  return NextResponse.json({ enabled: await aiConfigured() });
}
