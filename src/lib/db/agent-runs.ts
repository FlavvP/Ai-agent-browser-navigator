import { prisma } from "@/lib/db/prisma";

export const ACTIVE_AGENT_RUN_STATUSES = ["RUNNING", "CANCELLING"];

export async function createAgentRun(input: { conversationId: string; userId: string; userMessageId: string }) {
  return prisma.agentRun.create({
    data: {
      conversationId: input.conversationId,
      userId: input.userId,
      userMessageId: input.userMessageId,
      status: "RUNNING",
    },
  });
}

export async function getAgentRun(id: string, userId: string) {
  return prisma.agentRun.findFirst({ where: { id, userId } });
}

export async function getActiveAgentRun(conversationId: string, userId: string) {
  return prisma.agentRun.findFirst({
    where: { conversationId, userId, status: { in: ACTIVE_AGENT_RUN_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
}

export async function appendAgentRunDelta(id: string, delta: string) {
  const run = await prisma.agentRun.findUnique({ where: { id }, select: { partialContent: true } });
  if (!run) return null;
  return prisma.agentRun.update({
    where: { id },
    data: { partialContent: `${run.partialContent}${delta}` },
  });
}

export async function markAgentRunCancelling(id: string, userId: string) {
  return prisma.agentRun.updateMany({
    where: { id, userId, status: "RUNNING" },
    data: { status: "CANCELLING", cancelledAt: new Date() },
  });
}

export async function markAgentRunCompleted(id: string, assistantMessageId: string) {
  return prisma.agentRun.update({
    where: { id },
    data: {
      status: "COMPLETED",
      assistantMessageId,
      completedAt: new Date(),
    },
  });
}

export async function markAgentRunCancelled(id: string, partialContent?: string, assistantMessageId?: string) {
  return prisma.agentRun.update({
    where: { id },
    data: {
      status: "CANCELLED",
      partialContent,
      assistantMessageId,
      cancelledAt: new Date(),
      completedAt: new Date(),
    },
  });
}

export async function markAgentRunFailed(id: string, error: unknown) {
  return prisma.agentRun.update({
    where: { id },
    data: {
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    },
  });
}

export async function listInterruptedAgentRuns() {
  return prisma.agentRun.findMany({ where: { status: { in: ACTIVE_AGENT_RUN_STATUSES } } });
}

export async function markAgentRunInterrupted(id: string) {
  return prisma.agentRun.update({
    where: { id },
    data: {
      status: "INTERRUPTED",
      error: "Server restarted while the run was active.",
      completedAt: new Date(),
    },
  });
}
