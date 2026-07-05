import { prisma } from "@/lib/db/prisma";
import { DEBUG_WORKSPACE_CONVERSATION_TITLE } from "@/lib/debug/workspace-snapshot-debug";

export async function listConversations(userId: string) {
  return prisma.conversation.findMany({
    where: { userId, title: { not: DEBUG_WORKSPACE_CONVERSATION_TITLE } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, mode: true, createdAt: true, updatedAt: true },
  });
}

export async function createConversation(userId: string, title = "Nouveau chat") {
  return prisma.conversation.create({ data: { userId, title } });
}

export async function getConversation(id: string, userId: string) {
  return prisma.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      toolEvents: { orderBy: { createdAt: "asc" } },
      workspaceSessions: { orderBy: { createdAt: "desc" }, take: 1 },
      agentRuns: {
        where: { status: { in: ["RUNNING", "CANCELLING"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function touchConversation(id: string, userId: string, title?: string) {
  return prisma.conversation.updateMany({ where: { id, userId }, data: title ? { title } : {} });
}

export async function renameConversation(id: string, userId: string, title: string) {
  return prisma.conversation.updateMany({ where: { id, userId }, data: { title } });
}

export async function deleteConversation(id: string, userId: string) {
  return prisma.conversation.deleteMany({ where: { id, userId } });
}

export async function setConversationMode(id: string, userId: string, mode: "CLASSIC" | "WORKSPACE") {
  return prisma.conversation.updateMany({ where: { id, userId }, data: { mode } });
}
