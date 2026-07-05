import { prisma } from "@/lib/db/prisma";

type AddToolEventInput = {
  conversationId: string;
  messageId?: string | null;
  toolName: string;
  status: "SUCCESS" | "ERROR";
  input: unknown;
  output?: unknown;
};

export async function addToolEvent(input: AddToolEventInput) {
  return prisma.toolEvent.create({
    data: {
      conversationId: input.conversationId,
      messageId: input.messageId ?? null,
      toolName: input.toolName,
      status: input.status,
      inputJson: JSON.stringify(input.input),
      outputJson: input.output === undefined ? null : JSON.stringify(input.output),
    },
  });
}
