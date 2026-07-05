import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConversation } from "@/lib/db/conversations";
import { serializeConversation } from "@/lib/db/serialize-conversation";
import { stopWorkspaceMode } from "@/lib/workspace/workspace-service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (!conversationId) return NextResponse.json({ error: "conversationId is required" }, { status: 400 });

  const existing = await getConversation(conversationId, session.user.id);
  if (!existing) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  await stopWorkspaceMode(conversationId, session.user.id);
  const conversation = await getConversation(conversationId, session.user.id);

  return NextResponse.json({
    conversation: serializeConversation(conversation),
  });
}
