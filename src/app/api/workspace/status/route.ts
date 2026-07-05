import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConversation } from "@/lib/db/conversations";
import { serializeConversation } from "@/lib/db/serialize-conversation";
import { getWorkspaceStatus } from "@/lib/workspace/workspace-service";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId") ?? "";
  if (!conversationId) return NextResponse.json({ error: "conversationId is required" }, { status: 400 });

  const existing = await getConversation(conversationId, session.user.id);
  if (!existing) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  await getWorkspaceStatus(conversationId, session.user.id);
  const conversation = await getConversation(conversationId, session.user.id);

  return NextResponse.json({
    conversation: serializeConversation(conversation),
  });
}
