import { getActiveWorkspaceSession } from "@/lib/db/workspace-sessions";
import { isLogCategoryEnabled } from "@/lib/logging/log-config";
import { logAutomationEvent, logSnapshotArtifact } from "@/lib/logging/logger";
import { recordWorkspaceActivity } from "@/lib/workspace/workspace-service";

type AutomationMetadata = {
  automationUrl?: string;
};

export type WorkspaceSnapshot = {
  ok: boolean;
  snapshot_id?: string;
  mode?: string;
  snapshot?: string;
  ref_count?: number;
  refs?: Array<Record<string, unknown>>;
  page?: { title?: string; focused?: string | null };
  summary?: string;
  regions?: Array<Record<string, unknown>>;
  visible_text?: Array<Record<string, unknown>>;
  elements?: Array<Record<string, unknown>>;
  warning?: string | null;
  message?: string;
};

type AutomationRequestContext = {
  userId: string;
  conversationId: string;
  path: string;
};

async function getAutomationUrl(conversationId: string, userId: string) {
  const session = await getActiveWorkspaceSession(conversationId, userId);
  if (!session || session.status !== "RUNNING") {
    throw new Error("Workspace is not running.");
  }

  const metadata = JSON.parse(session.metadataJson || "{}") as AutomationMetadata;
  if (!metadata.automationUrl) throw new Error("Workspace automation URL is missing.");
  return metadata.automationUrl;
}

async function requestAutomation<T>(url: string, context: AutomationRequestContext, init?: RequestInit): Promise<T> {
  const startedAt = Date.now();
  const response = await fetch(`${url}${context.path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await response.json()) as T;
  await logAutomationEvent({
    userId: context.userId,
    conversationId: context.conversationId,
    event: "automation_request",
    data: {
      path: context.path,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      outputSummary: summarizeAutomationOutput(data),
    },
  });
  if (!response.ok) throw new Error(`Automation request failed: ${response.status}`);
  return data;
}

function summarizeAutomationOutput(data: unknown) {
  if (!data || typeof data !== "object") return data;
  const value = data as WorkspaceSnapshot;
  return {
    ok: value.ok,
    snapshot_id: value.snapshot_id,
    mode: value.mode,
    ref_count: value.ref_count,
    refs: value.refs?.length ?? undefined,
    summary: value.summary,
    warning: value.warning,
    elements: value.elements?.length ?? undefined,
    stats: "stats" in value ? (value as Record<string, unknown>).stats : undefined,
  };
}

async function logSnapshotsIfEnabled(input: { conversationId: string; userId: string; automationUrl: string; name: string; compact: unknown }) {
  if (isLogCategoryEnabled("compactSnapshots")) {
    await logSnapshotArtifact({
      userId: input.userId,
      conversationId: input.conversationId,
      name: `${input.name}_compact`,
      data: input.compact,
    });
  }

  if (!isLogCategoryEnabled("rawSnapshots")) return;

  try {
    const raw = await requestAutomation<unknown>(
      input.automationUrl,
      { userId: input.userId, conversationId: input.conversationId, path: "/raw_snapshot" },
      undefined,
    );
    await logSnapshotArtifact({
      userId: input.userId,
      conversationId: input.conversationId,
      name: `${input.name}_raw`,
      data: raw,
      raw: true,
    });
  } catch (error) {
    await logAutomationEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      level: "error",
      event: "raw_snapshot_log_failed",
      data: { message: error instanceof Error ? error.message : String(error) },
    });
  }
}

export async function workspaceSnapshot(input: { conversationId: string; userId: string; mode?: "compact" | "expanded" }) {
  const url = await getAutomationUrl(input.conversationId, input.userId);
  const mode = input.mode === "compact" ? "compact" : "expanded";
  const snapshot = await requestAutomation<WorkspaceSnapshot>(url, { ...input, path: `/snapshot?mode=${mode}` });
  await recordWorkspaceActivity(input.conversationId, input.userId);
  await logSnapshotsIfEnabled({ ...input, automationUrl: url, name: "workspace_snapshot", compact: snapshot });
  return snapshot;
}

export async function workspaceRawSnapshot(input: { conversationId: string; userId: string }) {
  const url = await getAutomationUrl(input.conversationId, input.userId);
  const raw = await requestAutomation<unknown>(url, { ...input, path: "/raw_snapshot" });
  await recordWorkspaceActivity(input.conversationId, input.userId);
  return raw;
}

export async function workspaceAccerciserSnapshot(input: { conversationId: string; userId: string }) {
  const url = await getAutomationUrl(input.conversationId, input.userId);
  const snapshot = await requestAutomation<unknown>(url, { ...input, path: "/accerciser_snapshot" });
  await recordWorkspaceActivity(input.conversationId, input.userId);
  return snapshot;
}

export async function workspaceDebugSnapshot(input: { conversationId: string; userId: string; mode?: "compact" | "expanded" }) {
  const url = await getAutomationUrl(input.conversationId, input.userId);
  const mode = input.mode === "compact" ? "compact" : "expanded";
  const snapshot = await requestAutomation<{
    ok: boolean;
    raw_snapshot?: unknown;
    accerciser_snapshot?: unknown;
    cleaned_snapshot?: WorkspaceSnapshot;
    warning?: string | null;
  }>(url, { ...input, path: `/debug_snapshot?mode=${mode}` });
  await recordWorkspaceActivity(input.conversationId, input.userId);
  return snapshot;
}

export async function workspaceClick(input: { conversationId: string; userId: string; ref: string; snapshotId: string }) {
  const url = await getAutomationUrl(input.conversationId, input.userId);
  const snapshot = await requestAutomation<WorkspaceSnapshot>(url, { ...input, path: "/click" }, {
    method: "POST",
    body: JSON.stringify({ ref: input.ref, snapshot_id: input.snapshotId }),
  });
  await recordWorkspaceActivity(input.conversationId, input.userId);
  await logSnapshotsIfEnabled({ ...input, automationUrl: url, name: "workspace_click", compact: snapshot });
  return snapshot;
}

export async function workspaceFill(input: {
  conversationId: string;
  userId: string;
  ref: string;
  snapshotId: string;
  text: string;
  mode: "replace" | "append";
}) {
  const url = await getAutomationUrl(input.conversationId, input.userId);
  const snapshot = await requestAutomation<WorkspaceSnapshot>(url, { ...input, path: "/fill" }, {
    method: "POST",
    body: JSON.stringify({ ref: input.ref, snapshot_id: input.snapshotId, text: input.text, mode: input.mode }),
  });
  await recordWorkspaceActivity(input.conversationId, input.userId);
  await logSnapshotsIfEnabled({ ...input, automationUrl: url, name: "workspace_fill", compact: snapshot });
  return snapshot;
}

export async function workspacePress(input: { conversationId: string; userId: string; keys: string }) {
  const url = await getAutomationUrl(input.conversationId, input.userId);
  const snapshot = await requestAutomation<WorkspaceSnapshot>(url, { ...input, path: "/press" }, {
    method: "POST",
    body: JSON.stringify({ keys: input.keys }),
  });
  await recordWorkspaceActivity(input.conversationId, input.userId);
  await logSnapshotsIfEnabled({ ...input, automationUrl: url, name: "workspace_press", compact: snapshot });
  return snapshot;
}

export async function workspaceScroll(input: { conversationId: string; userId: string; direction: string; amount: string }) {
  const url = await getAutomationUrl(input.conversationId, input.userId);
  const snapshot = await requestAutomation<WorkspaceSnapshot>(url, { ...input, path: "/scroll" }, {
    method: "POST",
    body: JSON.stringify({ direction: input.direction, amount: input.amount }),
  });
  await recordWorkspaceActivity(input.conversationId, input.userId);
  await logSnapshotsIfEnabled({ ...input, automationUrl: url, name: "workspace_scroll", compact: snapshot });
  return snapshot;
}
