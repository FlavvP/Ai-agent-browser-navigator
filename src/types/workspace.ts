export type WorkspaceStatus = "MOCK" | "STARTING" | "RUNNING" | "STOPPED" | "FAILED";

export type WorkspaceSessionView = {
  id: string;
  conversationId: string;
  userId: string;
  workspaceProfileId: string | null;
  status: WorkspaceStatus;
  provider: string;
  externalId: string | null;
  containerName: string | null;
  streamUrl: string | null;
  metadataJson: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  lastSeenAt: string | null;
  lastVisibleAt: string | null;
  lastActivityAt: string | null;
  shutdownReason: string | null;
  createdAt: string;
  updatedAt: string;
};
