export type WorkspaceProviderName = "mock" | "docker-selkies";

export type WorkspaceConfig = {
  provider: WorkspaceProviderName;
  image: string;
  publicHost: string;
  portStart: number;
  portEnd: number;
  containerPort: number;
  profileMountPath: string;
  userProfileMountPath: string;
  idleTimeoutMinutes: number;
  idleSweepIntervalMs: number;
  readyDelayMs: number;
  automationPortStart: number;
  automationContainerPort: number;
  defaultUrl: string;
  browserMode: "maximized" | "app" | "normal";
  browserWatchdogEnabled: boolean;
  browserWatchdogIntervalMs: number;
  screenWidth: number;
  screenHeight: number;
  screenDpi: number;
};

function intFromEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function boolFromEnv(name: string, fallback: boolean) {
  const value = (process.env[name] ?? "").toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function browserModeFromEnv(): "maximized" | "app" | "normal" {
  const value = process.env.WORKSPACE_BROWSER_MODE;
  if (value === "app" || value === "normal") return value;
  return "maximized";
}

export function getWorkspaceConfig(): WorkspaceConfig {
  const provider = process.env.WORKSPACE_PROVIDER === "mock" ? "mock" : "docker-selkies";
  const portStart = intFromEnv("WORKSPACE_PORT_START", 6100);
  const portEnd = intFromEnv("WORKSPACE_PORT_END", 6199);

  return {
    provider,
    image: process.env.WORKSPACE_IMAGE || "ghcr.io/linuxserver/baseimage-selkies:debiantrixie",
    publicHost: process.env.WORKSPACE_PUBLIC_HOST || "localhost",
    portStart,
    portEnd: portEnd >= portStart ? portEnd : portStart,
    containerPort: intFromEnv("WORKSPACE_CONTAINER_PORT", 3000),
    profileMountPath: process.env.WORKSPACE_PROFILE_MOUNT || "/config",
    userProfileMountPath: process.env.WORKSPACE_USER_PROFILE_MOUNT || "/profiles/user",
    idleTimeoutMinutes: intFromEnv("WORKSPACE_IDLE_TIMEOUT_MINUTES", 30),
    idleSweepIntervalMs: intFromEnv("WORKSPACE_IDLE_SWEEP_INTERVAL_MS", 60_000),
    readyDelayMs: intFromEnv("WORKSPACE_READY_DELAY_MS", 3000),
    automationPortStart: intFromEnv("WORKSPACE_AUTOMATION_PORT", 6200),
    automationContainerPort: intFromEnv("WORKSPACE_AUTOMATION_CONTAINER_PORT", 8765),
    defaultUrl: process.env.WORKSPACE_DEFAULT_URL || "https://www.google.com",
    browserMode: browserModeFromEnv(),
    browserWatchdogEnabled: boolFromEnv("WORKSPACE_BROWSER_WATCHDOG_ENABLED", true),
    browserWatchdogIntervalMs: intFromEnv("WORKSPACE_BROWSER_WATCHDOG_INTERVAL_MS", 2000),
    screenWidth: intFromEnv("WORKSPACE_SCREEN_WIDTH", 1366),
    screenHeight: intFromEnv("WORKSPACE_SCREEN_HEIGHT", 768),
    screenDpi: intFromEnv("WORKSPACE_SCREEN_DPI", 96),
  };
}
