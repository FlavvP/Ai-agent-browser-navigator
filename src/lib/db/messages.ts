import { prisma } from "@/lib/db/prisma";

export async function addMessage(conversationId: string, role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL", content: string) {
  return prisma.message.create({ data: { conversationId, role, content } });
}

export async function listMessages(conversationId: string) {
  return prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
}
