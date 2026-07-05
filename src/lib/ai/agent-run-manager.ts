import type { ToolEvent } from "@prisma/client";
import { runAssistantReplyStream } from "@/lib/ai/chat-runner";
import {
  appendAgentRunDelta,
  createAgentRun,
  getAgentRun,
  markAgentRunCancelled,
  markAgentRunCancelling,
  markAgentRunCompleted,
  markAgentRunFailed,
} from "@/lib/db/agent-runs";
import { getConversation, touchConversation } from "@/lib/db/conversations";
import { addMessage, listMessages } from "@/lib/db/messages";
import { serializeConversation } from "@/lib/db/serialize-conversation";
import { logAgentEvent, logError } from "@/lib/logging/logger";

type AgentRunEvent =
  | { type: "tool"; event: ToolEvent }
  | { type: "delta"; delta: string }
  | { type: "done"; conversation: ReturnType<typeof serializeConversation> }
  | { type: "error"; message: string };

type Subscriber = (event: AgentRunEvent) => void | Promise<void>;

const subscribers = new Map<string, Set<Subscriber>>();
const controllers = new Map<string, AbortController>();

export async function createAndStartAgentRun(input: {
  conversationId: string;
  userId: string;
  userMessageId: string;
  mode: "CLASSIC" | "WORKSPACE";
}) {
  const run = await createAgentRun(input);
  void executeAgentRun({ ...input, runId: run.id });
  return run;
}

export function subscribeAgentRun(runId: string, subscriber: Subscriber) {
  const set = subscribers.get(runId) ?? new Set<Subscriber>();
  set.add(subscriber);
  subscribers.set(runId, set);
  return () => {
    set.delete(subscriber);
    if (set.size === 0) subscribers.delete(runId);
  };
}

export async function cancelAgentRun(runId: string, userId: string) {
  await markAgentRunCancelling(runId, userId);
  controllers.get(runId)?.abort(new DOMException("Generation stopped by user.", "AbortError"));
}

async function executeAgentRun(input: {
  runId: string;
  conversationId: string;
  userId: string;
  userMessageId: string;
  mode: "CLASSIC" | "WORKSPACE";
}) {
  const controller = new AbortController();
  controllers.set(input.runId, controller);

  try {
    const messages = await listMessages(input.conversationId);
    const assistantContent = await runAssistantReplyStream({
      messages,
      mode: input.mode,
      conversationId: input.conversationId,
      userId: input.userId,
      userMessageId: input.userMessageId,
      abortSignal: controller.signal,
      async onTextDelta(delta) {
        await appendAgentRunDelta(input.runId, delta);
        await publish(input.runId, { type: "delta", delta });
      },
      async onToolEvent(event) {
        await publish(input.runId, { type: "tool", event });
      },
    });

    const currentRun = await getAgentRun(input.runId, input.userId);
    if (currentRun?.status === "CANCELLING" || controller.signal.aborted) {
      await completeCancelledRun(input.runId, input.userId);
      return;
    }

    const assistantMessage = await addMessage(input.conversationId, "ASSISTANT", assistantContent);
    await markAgentRunCompleted(input.runId, assistantMessage.id);
    await touchConversation(input.conversationId, input.userId);
    await logAgentEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      event: "assistant_message_saved",
      data: { runId: input.runId, contentLength: assistantContent.length },
    });
    const conversation = serializeConversation(await getConversation(input.conversationId, input.userId));
    if (!conversation) throw new Error("Conversation not found after agent run completion.");
    await publish(input.runId, { type: "done", conversation });
  } catch (error) {
    if (controller.signal.aborted) {
      await completeCancelledRun(input.runId, input.userId);
      return;
    }

    await markAgentRunFailed(input.runId, error);
    await logError({
      userId: input.userId,
      conversationId: input.conversationId,
      category: "agent",
      file: "agent.log",
      event: "assistant_run_failed",
      error,
      data: { runId: input.runId },
    });
    await publish(input.runId, {
      type: "error",
      message: "Erreur pendant la generation de la reponse. Reessayez dans un instant.",
    });
  } finally {
    controllers.delete(input.runId);
    subscribers.delete(input.runId);
  }
}

async function completeCancelledRun(runId: string, userId: string) {
  const run = await getAgentRun(runId, userId);
  if (!run) return;
  const content = run.partialContent
    ? `${run.partialContent}\n\nGeneration interrompue.`
    : "Generation interrompue.";
  const assistantMessage = await addMessage(run.conversationId, "ASSISTANT", content);
  await markAgentRunCancelled(runId, content, assistantMessage.id);
  await touchConversation(run.conversationId, userId);
  const conversation = serializeConversation(await getConversation(run.conversationId, userId));
  if (!conversation) return;
  await publish(runId, { type: "done", conversation });
}

async function publish(runId: string, event: AgentRunEvent) {
  const set = subscribers.get(runId);
  if (!set) return;
  await Promise.allSettled(Array.from(set).map((subscriber) => subscriber(event)));
}
