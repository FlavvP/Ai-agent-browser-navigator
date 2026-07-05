import type { WorkspaceSession } from "@prisma/client";

export type WorkspaceProviderStartInput = {
  userId: string;
  conversationId: string;
  url?: string | null;
};

export type WorkspaceProviderStopInput = WorkspaceProviderStartInput & {
  shutdownReason?: string;
};
export type WorkspaceProviderStatusInput = WorkspaceProviderStartInput;

export type StartWorkspaceResult = {
  status: string;
  streamUrl: string | null;
  note: string;
  session?: WorkspaceSession | null;
};

export type WorkspaceProvider = {
  start(input: WorkspaceProviderStartInput): Promise<StartWorkspaceResult>;
  stop(input: WorkspaceProviderStopInput): Promise<void>;
  status(input: WorkspaceProviderStatusInput): Promise<WorkspaceSession | null>;
};
