import { mkdir, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LogCategory, LogLevel } from "@/lib/logging/log-config";
import { getLogConfig, isLogCategoryEnabled } from "@/lib/logging/log-config";
import { logArtifactPath, logFilePath, timestampForFile } from "@/lib/logging/log-paths";
import { redactForLogs, serializeError } from "@/lib/logging/redaction";

type LogContext = {
  userId: string;
  conversationId: string;
};

type LogEventInput = LogContext & {
  category: LogCategory;
  file: string;
  level?: LogLevel;
  event: string;
  data?: unknown;
};

async function ensureDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

function formatJson(value: unknown) {
  return JSON.stringify(redactForLogs(value), null, getLogConfig().pretty ? 2 : 0);
}

export async function logEvent(input: LogEventInput) {
  if (!isLogCategoryEnabled(input.category)) return;

  const filePath = logFilePath({ userId: input.userId, conversationId: input.conversationId, file: input.file });
  const payload = {
    timestamp: new Date().toISOString(),
    level: input.level ?? "info",
    category: input.category,
    event: input.event,
    data: input.data ?? null,
  };

  await ensureDir(filePath);
  await appendFile(filePath, `${JSON.stringify(redactForLogs(payload))}\n`, "utf8");
}

export async function logArtifact(input: LogContext & { category: LogCategory; folder: string; name: string; data: unknown }) {
  if (!isLogCategoryEnabled(input.category)) return;

  const file = `${timestampForFile()}_${input.name}.json`;
  const filePath = logArtifactPath({
    userId: input.userId,
    conversationId: input.conversationId,
    folder: input.folder,
    file,
  });

  await ensureDir(filePath);
  await writeFile(filePath, formatJson(input.data), "utf8");
}

export async function logError(
  input: LogContext & { category: LogCategory; file: string; event: string; error: unknown; data?: unknown },
) {
  await logEvent({
    ...input,
    level: "error",
    data: {
      ...(typeof input.data === "object" && input.data !== null ? input.data : { data: input.data ?? null }),
      error: serializeError(input.error),
    },
  });
}

export async function logAgentEvent(input: LogContext & { event: string; data?: unknown; level?: LogLevel }) {
  await logEvent({ ...input, category: "agent", file: "agent.log" });
}

export async function logToolEvent(input: LogContext & { event: string; data?: unknown; level?: LogLevel }) {
  await logEvent({ ...input, category: "tools", file: "tools.log" });
}

export async function logWorkspaceEvent(input: LogContext & { event: string; data?: unknown; level?: LogLevel }) {
  await logEvent({ ...input, category: "workspace", file: "workspace.log" });
}

export async function logAutomationEvent(input: LogContext & { event: string; data?: unknown; level?: LogLevel }) {
  await logEvent({ ...input, category: "automation", file: "automation.log" });
}

export async function logOpenAIArtifact(input: LogContext & { name: string; data: unknown }) {
  await logArtifact({ ...input, category: "openai", folder: "openai", data: input.data });
}

export async function logSnapshotArtifact(input: LogContext & { name: string; data: unknown; raw?: boolean }) {
  await logArtifact({
    ...input,
    category: input.raw ? "rawSnapshots" : "compactSnapshots",
    folder: "snapshots",
    data: input.data,
  });
}
