import type { getConversation } from "@/lib/db/conversations";

type ConversationWithRelations = NonNullable<Awaited<ReturnType<typeof getConversation>>>;

export function serializeConversation(conversation: ConversationWithRelations | null) {
  if (!conversation) return null;
  const [workspaceSession] = conversation.workspaceSessions;
  const [activeAgentRun] = conversation.agentRuns;
  return {
    ...conversation,
    workspaceSession: workspaceSession ?? null,
    activeAgentRun: activeAgentRun ?? null,
    workspaceSessions: undefined,
    agentRuns: undefined,
  };
}
