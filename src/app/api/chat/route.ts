import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAndStartAgentRun, subscribeAgentRun } from "@/lib/ai/agent-run-manager";
import { generateConversationTitle } from "@/lib/ai/conversation-title";
import { createConversation, getConversation, touchConversation } from "@/lib/db/conversations";
import { addMessage } from "@/lib/db/messages";
import { isNonEmptyString } from "@/lib/utils/ids";
import { logAgentEvent } from "@/lib/logging/logger";
import { isDebugSnapshotConversationTitle } from "@/lib/debug/workspace-snapshot-debug";
import type { ToolEvent } from "@prisma/client";

const DEFAULT_CONVERSATION_TITLES = new Set(["Nouveau chat", "Nouvelle conversation"]);
const encoder = new TextEncoder();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Message content is required" }, { status: 400 });

  let conversationId = isNonEmptyString(body.conversationId) ? body.conversationId : null;
  let conversation = conversationId ? await getConversation(conversationId, session.user.id) : null;

  if (!conversation) {
    const created = await createConversation(session.user.id);
    conversationId = created.id;
    conversation = await getConversation(created.id, session.user.id);
  }

  if (!conversation || !conversationId) {
    return NextResponse.json({ error: "Unable to create conversation" }, { status: 500 });
  }
  if (isDebugSnapshotConversationTitle(conversation.title)) {
    return NextResponse.json({ error: "Debug workspace conversations cannot receive chat messages" }, { status: 403 });
  }

  const shouldGenerateTitle =
    DEFAULT_CONVERSATION_TITLES.has(conversation.title) &&
    !conversation.messages.some((message) => message.role === "USER");
  let conversationTitle = conversation.title;

  const userMessage = await addMessage(conversationId, "USER", content);
  await logAgentEvent({
    userId: session.user.id,
    conversationId,
    event: "user_message_received",
    data: { messageId: userMessage.id, contentLength: content.length, mode: conversation.mode },
  });

  if (shouldGenerateTitle) {
    const generatedTitle = await generateConversationTitle(content);
    conversationTitle = generatedTitle;
    await touchConversation(conversationId, session.user.id, generatedTitle);
    await logAgentEvent({
      userId: session.user.id,
      conversationId,
      event: "conversation_title_generated",
      data: { title: generatedTitle },
    });
  }

  const agentRun = await createAndStartAgentRun({
    conversationId,
    userId: session.user.id,
    userMessageId: userMessage.id,
    mode: conversation.mode === "WORKSPACE" ? "WORKSPACE" : "CLASSIC",
  });

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(event: Record<string, unknown>) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      }

      function close() {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Stream already closed by the client.
        }
      }

      send({ type: "start", conversationId, conversationTitle, userMessage, agentRun });

      const unsubscribe = subscribeAgentRun(agentRun.id, (event) => {
        if (event.type === "tool") send({ type: "tool", event: serializeToolEvent(event.event) });
        if (event.type === "delta") send({ type: "delta", delta: event.delta });
        if (event.type === "done") {
          send({ type: "done", conversation: event.conversation });
          unsubscribe();
          close();
        }
        if (event.type === "error") {
          send({ type: "error", message: event.message });
          unsubscribe();
          close();
        }
      });

      request.signal.addEventListener(
        "abort",
        () => {
          unsubscribe();
          close();
        },
        { once: true },
      );
    },
    cancel() {
      // Client disconnects do not cancel the detached server-side AgentRun.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function serializeToolEvent(event: ToolEvent) {
  return {
    id: event.id,
    conversationId: event.conversationId,
    messageId: event.messageId,
    toolName: event.toolName,
    status: event.status,
    inputJson: event.inputJson,
    outputJson: event.outputJson,
    createdAt: event.createdAt.toISOString(),
  };
}
