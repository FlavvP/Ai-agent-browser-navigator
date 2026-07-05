import { setConversationMode } from "@/lib/db/conversations";
import {
  createWorkspaceSession,
  getActiveWorkspaceSession,
  getOrCreateWorkspaceConversationProfile,
  getOrCreateWorkspaceProfile,
  listIdleWorkspaceSessions,
  markWorkspaceActivity,
  markWorkspaceContainerStarting,
  markWorkspaceFailed,
  markWorkspaceRunning,
  markWorkspaceSeen,
  markWorkspaceStopped,
} from "@/lib/db/workspace-sessions";
import { inspectContainerRunning, readContainerFile, removeContainer, runDocker } from "@/lib/workspace/docker-cli";
import { findFreePort } from "@/lib/workspace/port-utils";
import { getWorkspaceConfig } from "@/lib/workspace/workspace-config";
import { logArtifact, logError, logWorkspaceEvent } from "@/lib/logging/logger";
import type {
  StartWorkspaceResult,
  WorkspaceProvider,
  WorkspaceProviderStartInput,
  WorkspaceProviderStatusInput,
  WorkspaceProviderStopInput,
} from "@/lib/workspace/workspace-types";

const APP_LABEL = "agent-browser-navigator";

function metadataJson(data: Record<string, unknown>) {
  return JSON.stringify(data);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseMetadata(metadata: string | null | undefined) {
  try {
    const parsed = JSON.parse(metadata || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

let janitorStarted = false;

function ensureWorkspaceJanitorStarted() {
  if (janitorStarted || typeof setInterval === "undefined") return;
  janitorStarted = true;
  const intervalMs = Math.max(5_000, getWorkspaceConfig().idleSweepIntervalMs);
  const timer = setInterval(() => {
    void sweepIdleWorkspaces();
  }, intervalMs);
  if (typeof timer === "object" && "unref" in timer && typeof timer.unref === "function") timer.unref();
}

async function waitForStreamReady(streamUrl: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "Stream not ready";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(streamUrl, { cache: "no-store" });
      if (response.ok) return;
      lastError = `Stream returned HTTP ${response.status}`;
    } catch (error) {
      lastError = getErrorMessage(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(`Workspace stream did not become ready at ${streamUrl}: ${lastError}`);
}

async function waitForJsonHealth(url: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "Automation not ready";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`, { cache: "no-store" });
      if (response.ok) return;
      lastError = `Automation returned HTTP ${response.status}`;
    } catch (error) {
      lastError = getErrorMessage(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(`Workspace automation did not become ready at ${url}: ${lastError}`);
}

function normalizeWorkspaceUrl(url: string | null | undefined, fallback: string) {
  const candidate = (url || fallback).trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

async function openBrowser(automationUrl: string, url?: string | null) {
  const startedAt = Date.now();
  const response = await fetch(`${automationUrl}/open_browser`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url ?? null }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Browser did not open: automation returned HTTP ${response.status}`);
  }
  return Date.now() - startedAt;
}

async function shutdownBrowser(automationUrl: string) {
  try {
    await fetch(`${automationUrl}/shutdown_browser`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
  } catch {
    // Shutdown remains best-effort; the container removal below is the final cleanup.
  }
}

async function delay(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const mockProvider: WorkspaceProvider = {
  async start(input) {
    const session = await createWorkspaceSession({
      conversationId: input.conversationId,
      userId: input.userId,
      provider: "mock",
    });
    const running = await markWorkspaceRunning(session.id, {
      externalId: session.id,
      containerName: `mock-${session.id}`,
      streamUrl: "",
      metadataJson: metadataJson({ mode: "mock" }),
    });
    return {
      status: "MOCK",
      streamUrl: null,
      note: "Workspace mock active.",
      session: running,
    };
  },
  async stop(input) {
    const session = await getActiveWorkspaceSession(input.conversationId, input.userId);
    if (session) await markWorkspaceStopped(session.id);
  },
  async status(input) {
    const session = await getActiveWorkspaceSession(input.conversationId, input.userId);
    if (!session) return null;
    return markWorkspaceSeen(session.id);
  },
};

const dockerSelkiesProvider: WorkspaceProvider = {
  async start(input: WorkspaceProviderStartInput): Promise<StartWorkspaceResult> {
    ensureWorkspaceJanitorStarted();
    await logWorkspaceEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      event: "workspace_start_requested",
      data: { provider: getWorkspaceConfig().provider, url: input.url ?? null },
    });
    const existing = await syncWorkspaceStatus(input);
    if (existing?.status === "RUNNING" || existing?.status === "STARTING") {
      const config = getWorkspaceConfig();
      const requestedUrl = input.url ? normalizeWorkspaceUrl(input.url, config.defaultUrl) : null;

      if (existing.status === "RUNNING" && requestedUrl) {
        const metadata = parseMetadata(existing.metadataJson);
        const automationUrl = typeof metadata.automationUrl === "string" ? metadata.automationUrl : null;
        if (!automationUrl) throw new Error("Workspace automation URL is missing.");

        const browserOpenDurationMs = await openBrowser(automationUrl, requestedUrl);
        await markWorkspaceActivity(input.conversationId, input.userId);
        await logWorkspaceEvent({
          userId: input.userId,
          conversationId: input.conversationId,
          event: "workspace_existing_browser_opened",
          data: { sessionId: existing.id, url: requestedUrl, durationMs: browserOpenDurationMs },
        });

        return {
          status: existing.status,
          streamUrl: existing.streamUrl,
          note: `Workspace deja actif. Navigateur ouvert sur ${requestedUrl}.`,
          session: existing,
        };
      }

      return {
        status: existing.status,
        streamUrl: existing.streamUrl,
        note: "Workspace deja actif.",
        session: existing,
      };
    }

    const config = getWorkspaceConfig();
    const requestedUrl = input.url ? normalizeWorkspaceUrl(input.url, config.defaultUrl) : null;
    const initialUrl = requestedUrl ?? config.defaultUrl;
    const profile = await getOrCreateWorkspaceProfile(input.userId, config.provider);
    const conversationProfile = await getOrCreateWorkspaceConversationProfile(
      input.conversationId,
      input.userId,
      config.provider,
    );
    const session = await createWorkspaceSession({
      conversationId: input.conversationId,
      userId: input.userId,
      workspaceProfileId: profile.id,
      conversationProfileId: conversationProfile.id,
      provider: config.provider,
    });

    let containerName = "";

    try {
      const port = await findFreePort(config.portStart, config.portEnd);
      const automationPort = await findFreePort(config.automationPortStart, config.automationPortStart + 99);
      containerName = `workspace-${session.id}`;
      const streamUrl = `http://${config.publicHost}:${port}`;
      const automationUrl = `http://${config.publicHost}:${automationPort}`;
      const labels = [
        "--label",
        `app=${APP_LABEL}`,
        "--label",
        `userId=${input.userId}`,
        "--label",
        `conversationId=${input.conversationId}`,
        "--label",
        `workspaceSessionId=${session.id}`,
      ];

      const result = await runDocker([
        "run",
        "-d",
        "--name",
        containerName,
        ...labels,
        "-p",
        `${port}:${config.containerPort}`,
        "-p",
        `${automationPort}:${config.automationContainerPort}`,
        "-v",
        `${conversationProfile.volumeName}:${config.profileMountPath}`,
        "-v",
        `${profile.volumeName}:${config.userProfileMountPath}`,
        "-e",
        "TZ=UTC",
        "-e",
        "TITLE=Agent Workspace",
        "-e",
        `WORKSPACE_BROWSER_MODE=${config.browserMode}`,
        "-e",
        `WORKSPACE_BROWSER_WATCHDOG_ENABLED=${config.browserWatchdogEnabled ? "true" : "false"}`,
        "-e",
        `WORKSPACE_BROWSER_WATCHDOG_INTERVAL_MS=${config.browserWatchdogIntervalMs}`,
        "-e",
        `WORKSPACE_DEFAULT_URL=${initialUrl}`,
        "-e",
        `WORKSPACE_USER_PROFILE_PATH=${config.userProfileMountPath}`,
        "-e",
        `WORKSPACE_CONVERSATION_PROFILE_PATH=${config.profileMountPath}`,
        "-e",
        `WORKSPACE_CHROMIUM_USER_DATA_DIR=${config.profileMountPath}/chromium`,
        "-e",
        "SELKIES_IS_MANUAL_RESOLUTION_MODE=true",
        "-e",
        `SELKIES_MANUAL_WIDTH=${config.screenWidth}`,
        "-e",
        `SELKIES_MANUAL_HEIGHT=${config.screenHeight}`,
        "-e",
        `SELKIES_SCALING_DPI=${config.screenDpi}`,
        config.image,
      ]);
      await logWorkspaceEvent({
        userId: input.userId,
        conversationId: input.conversationId,
        event: "workspace_container_started",
        data: {
          sessionId: session.id,
          containerName,
          image: config.image,
          streamUrl,
          automationUrl,
          profileVolume: profile.volumeName,
          conversationProfileVolume: conversationProfile.volumeName,
          dockerId: result.stdout,
        },
      });

      const startMetadata = metadataJson({
        image: config.image,
        hostPort: port,
        automationPort,
        automationContainerPort: config.automationContainerPort,
        automationUrl,
        initialUrl,
        containerPort: config.containerPort,
        profileVolume: profile.volumeName,
        conversationProfileVolume: conversationProfile.volumeName,
        profileMountPath: config.profileMountPath,
        userProfileMountPath: config.userProfileMountPath,
        readyDelayMs: config.readyDelayMs,
        browserMode: config.browserMode,
        browserWatchdogEnabled: config.browserWatchdogEnabled,
        browserWatchdogIntervalMs: config.browserWatchdogIntervalMs,
        screenWidth: config.screenWidth,
        screenHeight: config.screenHeight,
        screenDpi: config.screenDpi,
      });

      await markWorkspaceContainerStarting(session.id, {
        externalId: result.stdout,
        containerName,
        streamUrl,
        metadataJson: startMetadata,
      });

      await waitForStreamReady(streamUrl);
      await logWorkspaceEvent({
        userId: input.userId,
        conversationId: input.conversationId,
        event: "workspace_stream_ready",
        data: { sessionId: session.id, streamUrl },
      });
      await waitForJsonHealth(automationUrl);
      await logWorkspaceEvent({
        userId: input.userId,
        conversationId: input.conversationId,
        event: "workspace_automation_ready",
        data: { sessionId: session.id, automationUrl },
      });
      const browserOpenDurationMs = await openBrowser(automationUrl, requestedUrl);
      await markWorkspaceActivity(input.conversationId, input.userId);
      await logWorkspaceEvent({
        userId: input.userId,
        conversationId: input.conversationId,
        event: "workspace_browser_opened",
        data: { sessionId: session.id, initialUrl, requestedUrl, durationMs: browserOpenDurationMs },
      });
      const [browserLog, automationLog] = await Promise.all([
        readContainerFile(containerName, "/config/log/chromium.log"),
        readContainerFile(containerName, "/config/log/agent-automation.log"),
      ]);
      if (browserLog) {
        await logArtifact({
          userId: input.userId,
          conversationId: input.conversationId,
          category: "browser",
          folder: "container-logs",
          name: "chromium",
          data: { containerName, log: browserLog },
        });
      }
      if (automationLog) {
        await logArtifact({
          userId: input.userId,
          conversationId: input.conversationId,
          category: "automation",
          folder: "container-logs",
          name: "agent-automation",
          data: { containerName, log: automationLog },
        });
      }
      await delay(config.readyDelayMs);

      const running = await markWorkspaceRunning(session.id, {
        externalId: result.stdout,
        containerName,
        streamUrl,
        metadataJson: startMetadata,
      });

      return {
        status: running.status,
        streamUrl: running.streamUrl,
        note: "Workspace Docker/Selkies actif.",
        session: running,
      };
    } catch (error) {
      if (containerName) await removeContainer(containerName);
      const failed = await markWorkspaceFailed(session.id, error);
      await logError({
        userId: input.userId,
        conversationId: input.conversationId,
        category: "workspace",
        file: "workspace.log",
        event: "workspace_start_failed",
        error,
        data: { sessionId: session.id },
      });
      return {
        status: failed.status,
        streamUrl: null,
        note: getErrorMessage(error),
        session: failed,
      };
    }
  },

  async stop(input: WorkspaceProviderStopInput) {
    const session = await getActiveWorkspaceSession(input.conversationId, input.userId);
    if (!session) return;

    await logWorkspaceEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      event: "workspace_stop_requested",
      data: { sessionId: session.id, containerName: session.containerName, status: session.status },
    });
    await stopWorkspaceSessionContainer(session, input.shutdownReason ?? "explicit");
    await logWorkspaceEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      event: "workspace_stopped",
      data: { sessionId: session.id, containerName: session.containerName },
    });
  },

  async status(input: WorkspaceProviderStatusInput) {
    ensureWorkspaceJanitorStarted();
    return syncWorkspaceStatus(input);
  },
};

async function stopWorkspaceSessionContainer(session: { id: string; containerName: string | null; metadataJson: string | null }, shutdownReason: string) {
  const metadata = parseMetadata(session.metadataJson);
  const automationUrl = typeof metadata.automationUrl === "string" ? metadata.automationUrl : null;
  if (automationUrl) await shutdownBrowser(automationUrl);
  if (session.containerName) await removeContainer(session.containerName);
  await markWorkspaceStopped(session.id, shutdownReason);
}

export async function sweepIdleWorkspaces() {
  const config = getWorkspaceConfig();
  if (config.idleTimeoutMinutes <= 0) return;
  const cutoff = new Date(Date.now() - config.idleTimeoutMinutes * 60_000);
  const sessions = await listIdleWorkspaceSessions(cutoff);
  for (const session of sessions) {
    await logWorkspaceEvent({
      userId: session.userId,
      conversationId: session.conversationId,
      event: "workspace_idle_timeout",
      data: { sessionId: session.id, containerName: session.containerName },
    });
    await stopWorkspaceSessionContainer(session, "idle_timeout");
  }
}

async function syncWorkspaceStatus(input: WorkspaceProviderStatusInput) {
  const session = await getActiveWorkspaceSession(input.conversationId, input.userId);
  if (!session) return null;

  if (session.provider === "mock") return markWorkspaceSeen(session.id);
  if (!session.containerName) {
    if (session.status === "STARTING") return markWorkspaceSeen(session.id);
    return session.status === "FAILED" ? session : markWorkspaceFailed(session.id, "Container name missing");
  }

  const running = await inspectContainerRunning(session.containerName);
  if (running) return markWorkspaceSeen(session.id);
  if (session.status === "RUNNING" || session.status === "STARTING") return markWorkspaceStopped(session.id, "container_not_running");
  return session;
}

function getProvider(): WorkspaceProvider {
  return getWorkspaceConfig().provider === "mock" ? mockProvider : dockerSelkiesProvider;
}

export async function enterWorkspaceMode(conversationId: string, userId: string): Promise<StartWorkspaceResult> {
  await setConversationMode(conversationId, userId, "WORKSPACE");
  await logWorkspaceEvent({
    userId,
    conversationId,
    event: "workspace_mode_entered",
    data: { browserStarted: false },
  });
  return {
    status: "WORKSPACE_MODE",
    streamUrl: null,
    note: "Mode workspace active. Demarre le navigateur avec start_workspace_browser si une navigation visuelle est necessaire.",
    session: await getActiveWorkspaceSession(conversationId, userId),
  };
}

export async function startWorkspaceBrowser(
  conversationId: string,
  userId: string,
  url?: string | null,
): Promise<StartWorkspaceResult> {
  await setConversationMode(conversationId, userId, "WORKSPACE");
  return getProvider().start({ conversationId, userId, url });
}

export async function stopWorkspaceBrowser(conversationId: string, userId: string, shutdownReason = "tool_stop") {
  await getProvider().stop({ conversationId, userId, shutdownReason });
}

export async function stopWorkspaceMode(conversationId: string, userId: string) {
  await stopWorkspaceBrowser(conversationId, userId, "explicit_ui_stop");
  await setConversationMode(conversationId, userId, "CLASSIC");
}

export async function getWorkspaceStatus(conversationId: string, userId: string) {
  return getProvider().status({ conversationId, userId });
}

export async function recordWorkspaceActivity(conversationId: string, userId: string) {
  return markWorkspaceActivity(conversationId, userId);
}
