export type ConversationMode = "CLASSIC" | "WORKSPACE";
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type ChatToolEvent = {
  id: string;
  conversationId: string;
  messageId: string | null;
  toolName: string;
  status: "SUCCESS" | "ERROR";
  inputJson: string;
  outputJson: string | null;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  mode: ConversationMode;
  createdAt: string;
  updatedAt: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ChatMessage[];
  toolEvents: ChatToolEvent[];
  workspaceSession?: {
    id: string;
    status: string;
    provider: string;
    externalId: string | null;
    containerName: string | null;
    streamUrl: string | null;
    metadataJson: string | null;
    startedAt: string | null;
    stoppedAt: string | null;
    lastSeenAt: string | null;
    lastVisibleAt?: string | null;
    lastActivityAt?: string | null;
    shutdownReason?: string | null;
  } | null;
  activeAgentRun?: {
    id: string;
    status: string;
    partialContent: string;
    error: string | null;
    startedAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
  } | null;
};
