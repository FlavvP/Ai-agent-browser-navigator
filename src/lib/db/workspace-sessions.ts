import { prisma } from "@/lib/db/prisma";

const ACTIVE_STATUSES = ["MOCK", "STARTING", "RUNNING", "FAILED"];

function safeDockerName(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80);
}

export async function getOrCreateWorkspaceProfile(userId: string, provider = "docker-selkies") {
  return prisma.workspaceProfile.upsert({
    where: { userId },
    update: { provider },
    create: {
      userId,
      provider,
      volumeName: `workspace-profile-${safeDockerName(userId)}`,
    },
  });
}

export async function getOrCreateWorkspaceConversationProfile(conversationId: string, userId: string, provider = "docker-selkies") {
  return prisma.workspaceConversationProfile.upsert({
    where: { conversationId },
    update: { provider },
    create: {
      conversationId,
      userId,
      provider,
      volumeName: `workspace-conversation-${safeDockerName(conversationId)}`,
    },
  });
}

export async function createWorkspaceSession(input: {
  conversationId: string;
  userId: string;
  workspaceProfileId?: string;
  conversationProfileId?: string;
  provider: string;
}) {
  return prisma.workspaceSession.create({
    data: {
      conversationId: input.conversationId,
      userId: input.userId,
      workspaceProfileId: input.workspaceProfileId,
      conversationProfileId: input.conversationProfileId,
      provider: input.provider,
      status: "STARTING",
      lastSeenAt: new Date(),
      lastVisibleAt: new Date(),
      lastActivityAt: new Date(),
    },
  });
}

export async function getActiveWorkspaceSession(conversationId: string, userId: string) {
  return prisma.workspaceSession.findFirst({
    where: { conversationId, userId, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
}

export async function markWorkspaceRunning(
  id: string,
  data: {
    externalId: string;
    containerName: string;
    streamUrl: string;
    metadataJson?: string;
  },
) {
  return prisma.workspaceSession.update({
    where: { id },
    data: {
      status: "RUNNING",
      externalId: data.externalId,
      containerName: data.containerName,
      streamUrl: data.streamUrl,
      metadataJson: data.metadataJson,
      startedAt: new Date(),
      stoppedAt: null,
      lastSeenAt: new Date(),
      lastVisibleAt: new Date(),
      lastActivityAt: new Date(),
      shutdownReason: null,
    },
  });
}

export async function markWorkspaceContainerStarting(
  id: string,
  data: {
    externalId: string;
    containerName: string;
    streamUrl: string;
    metadataJson?: string;
  },
) {
  return prisma.workspaceSession.update({
    where: { id },
    data: {
      externalId: data.externalId,
      containerName: data.containerName,
      streamUrl: data.streamUrl,
      metadataJson: data.metadataJson,
      lastSeenAt: new Date(),
      lastActivityAt: new Date(),
    },
  });
}

export async function markWorkspaceFailed(id: string, error: unknown) {
  return prisma.workspaceSession.update({
    where: { id },
    data: {
      status: "FAILED",
      metadataJson: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      stoppedAt: new Date(),
      lastSeenAt: new Date(),
      shutdownReason: "start_failed",
    },
  });
}

export async function markWorkspaceStopped(id: string, shutdownReason = "explicit") {
  return prisma.workspaceSession.update({
    where: { id },
    data: {
      status: "STOPPED",
      stoppedAt: new Date(),
      lastSeenAt: new Date(),
      shutdownReason,
    },
  });
}

export async function markWorkspaceSeen(id: string) {
  return prisma.workspaceSession.update({
    where: { id },
    data: { lastSeenAt: new Date(), lastVisibleAt: new Date() },
  });
}

export async function markWorkspaceActivity(conversationId: string, userId: string) {
  const session = await getActiveWorkspaceSession(conversationId, userId);
  if (!session) return null;
  return prisma.workspaceSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date(), lastActivityAt: new Date() },
  });
}

export async function markWorkspaceConversationProfileSeeded(id: string) {
  return prisma.workspaceConversationProfile.update({
    where: { id },
    data: { seededFromUserAt: new Date() },
  });
}

export async function listIdleWorkspaceSessions(cutoff: Date) {
  return prisma.workspaceSession.findMany({
    where: {
      status: { in: ["STARTING", "RUNNING"] },
      OR: [{ lastVisibleAt: null }, { lastVisibleAt: { lt: cutoff } }],
      AND: [{ OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: cutoff } }] }],
    },
    orderBy: { updatedAt: "asc" },
  });
}
