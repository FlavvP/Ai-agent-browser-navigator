CREATE TABLE "WorkspaceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'docker-selkies',
    "volumeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceProfile_userId_key" ON "WorkspaceProfile"("userId");
CREATE UNIQUE INDEX "WorkspaceProfile_volumeName_key" ON "WorkspaceProfile"("volumeName");
CREATE INDEX "WorkspaceProfile_userId_idx" ON "WorkspaceProfile"("userId");

ALTER TABLE "WorkspaceProfile"
ADD CONSTRAINT "WorkspaceProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceSession" ADD COLUMN "userId" TEXT;
ALTER TABLE "WorkspaceSession" ADD COLUMN "workspaceProfileId" TEXT;
ALTER TABLE "WorkspaceSession" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'docker-selkies';
ALTER TABLE "WorkspaceSession" ADD COLUMN "externalId" TEXT;
ALTER TABLE "WorkspaceSession" ADD COLUMN "containerName" TEXT;
ALTER TABLE "WorkspaceSession" ADD COLUMN "metadataJson" TEXT;
ALTER TABLE "WorkspaceSession" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "WorkspaceSession" ADD COLUMN "stoppedAt" TIMESTAMP(3);
ALTER TABLE "WorkspaceSession" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

UPDATE "WorkspaceSession" AS ws
SET "userId" = c."userId"
FROM "Conversation" AS c
WHERE ws."conversationId" = c."id";

ALTER TABLE "WorkspaceSession" ALTER COLUMN "userId" SET NOT NULL;

CREATE INDEX "WorkspaceSession_userId_idx" ON "WorkspaceSession"("userId");
CREATE INDEX "WorkspaceSession_workspaceProfileId_idx" ON "WorkspaceSession"("workspaceProfileId");
CREATE INDEX "WorkspaceSession_status_idx" ON "WorkspaceSession"("status");

ALTER TABLE "WorkspaceSession"
ADD CONSTRAINT "WorkspaceSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceSession"
ADD CONSTRAINT "WorkspaceSession_workspaceProfileId_fkey"
FOREIGN KEY ("workspaceProfileId") REFERENCES "WorkspaceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
