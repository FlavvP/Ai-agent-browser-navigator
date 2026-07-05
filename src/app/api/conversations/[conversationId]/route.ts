import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteConversation, getConversation, renameConversation } from "@/lib/db/conversations";
import { serializeConversation } from "@/lib/db/serialize-conversation";
import { isDebugSnapshotConversationTitle } from "@/lib/debug/workspace-snapshot-debug";
import { stopWorkspaceBrowser } from "@/lib/workspace/workspace-service";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await context.params;
  const conversation = await getConversation(conversationId, session.user.id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  if (isDebugSnapshotConversationTitle(conversation.title)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json(serializeConversation(conversation));
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await context.params;
  const conversation = await getConversation(conversationId, session.user.id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  if (isDebugSnapshotConversationTitle(conversation.title)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (title.length > 120) return NextResponse.json({ error: "Title is too long" }, { status: 400 });

  await renameConversation(conversationId, session.user.id, title);
  const updated = await getConversation(conversationId, session.user.id);
  return NextResponse.json(serializeConversation(updated));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await context.params;
  const conversation = await getConversation(conversationId, session.user.id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  if (isDebugSnapshotConversationTitle(conversation.title)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  try {
    await stopWorkspaceBrowser(conversationId, session.user.id, "conversation_deleted");
  } catch {
    // Deletion should still remove the DB conversation; orphaned containers are handled by status/janitor paths.
  }
  await deleteConversation(conversationId, session.user.id);
  return NextResponse.json({ ok: true });
}
