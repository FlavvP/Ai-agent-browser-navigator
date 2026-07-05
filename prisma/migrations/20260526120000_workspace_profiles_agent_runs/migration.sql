CREATE TABLE "WorkspaceConversationProfile" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'docker-selkies',
    "volumeName" TEXT NOT NULL,
    "seededFromUserAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceConversationProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userMessageId" TEXT,
    "assistantMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "partialContent" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkspaceSession" ADD COLUMN "conversationProfileId" TEXT;
ALTER TABLE "WorkspaceSession" ADD COLUMN "lastVisibleAt" TIMESTAMP(3);
ALTER TABLE "WorkspaceSession" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
ALTER TABLE "WorkspaceSession" ADD COLUMN "shutdownReason" TEXT;

CREATE UNIQUE INDEX "WorkspaceConversationProfile_conversationId_key" ON "WorkspaceConversationProfile"("conversationId");
CREATE UNIQUE INDEX "WorkspaceConversationProfile_volumeName_key" ON "WorkspaceConversationProfile"("volumeName");
CREATE INDEX "WorkspaceConversationProfile_userId_idx" ON "WorkspaceConversationProfile"("userId");
CREATE INDEX "WorkspaceSession_conversationProfileId_idx" ON "WorkspaceSession"("conversationProfileId");
CREATE INDEX "AgentRun_conversationId_status_idx" ON "AgentRun"("conversationId", "status");
CREATE INDEX "AgentRun_userId_status_idx" ON "AgentRun"("userId", "status");
CREATE INDEX "AgentRun_userMessageId_idx" ON "AgentRun"("userMessageId");

ALTER TABLE "WorkspaceConversationProfile"
ADD CONSTRAINT "WorkspaceConversationProfile_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceConversationProfile"
ADD CONSTRAINT "WorkspaceConversationProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceSession"
ADD CONSTRAINT "WorkspaceSession_conversationProfileId_fkey"
FOREIGN KEY ("conversationProfileId") REFERENCES "WorkspaceConversationProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentRun"
ADD CONSTRAINT "AgentRun_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentRun"
ADD CONSTRAINT "AgentRun_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentRun"
ADD CONSTRAINT "AgentRun_userMessageId_fkey"
FOREIGN KEY ("userMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentRun"
ADD CONSTRAINT "AgentRun_assistantMessageId_fkey"
FOREIGN KEY ("assistantMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
