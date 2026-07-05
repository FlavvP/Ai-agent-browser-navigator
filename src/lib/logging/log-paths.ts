import path from "node:path";
import { getLogConfig } from "@/lib/logging/log-config";

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 160);
}

export function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function conversationLogDir(input: { userId: string; conversationId: string }) {
  const config = getLogConfig();
  return path.resolve(
    process.cwd(),
    config.dir,
    "users",
    `user_${safeSegment(input.userId)}`,
    "conversations",
    `conversation_${safeSegment(input.conversationId)}`,
  );
}

export function logFilePath(input: { userId: string; conversationId: string; file: string }) {
  return path.join(conversationLogDir(input), input.file);
}

export function logArtifactPath(input: {
  userId: string;
  conversationId: string;
  folder: string;
  file: string;
}) {
  return path.join(conversationLogDir(input), safeSegment(input.folder), safeSegment(input.file));
}
