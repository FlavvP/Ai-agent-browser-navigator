export type ToolEventView = {
  id: string;
  conversationId: string;
  messageId: string | null;
  toolName: string;
  status: "PENDING" | "SUCCESS" | "ERROR";
  inputJson: string;
  outputJson: string | null;
  createdAt: string;
};
