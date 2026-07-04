import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { generateConciergeReply } from "@/lib/ai-concierge";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string; session_id?: string };
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ detail: "Message is required" }, { status: 400 });
    }

    const content = await generateConciergeReply(message);
    const sessionId = body.session_id || randomUUID();

    return NextResponse.json({
      role: "assistant",
      content,
      session_id: sessionId,
    });
  } catch (error) {
    console.error("AI concierge error:", error);
    return NextResponse.json({ detail: "Failed to generate AI response" }, { status: 500 });
  }
}
