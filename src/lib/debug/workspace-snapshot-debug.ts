import { prisma } from "@/lib/db/prisma";

export const DEBUG_WORKSPACE_CONVERSATION_TITLE = "Debug snapshot workspace";

export function isDebugSnapshotConversationTitle(title: string) {
  return title === DEBUG_WORKSPACE_CONVERSATION_TITLE;
}

export async function getOrCreateDebugSnapshotConversation(userId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { userId, title: DEBUG_WORKSPACE_CONVERSATION_TITLE },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      userId,
      title: DEBUG_WORKSPACE_CONVERSATION_TITLE,
      mode: "WORKSPACE",
    },
  });
}
