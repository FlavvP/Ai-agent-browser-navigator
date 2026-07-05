export type LogCategory =
  | "agent"
  | "openai"
  | "tools"
  | "workspace"
  | "automation"
  | "browser"
  | "snapshots"
  | "rawSnapshots"
  | "compactSnapshots";

export type LogLevel = "debug" | "info" | "warn" | "error";

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "all"]);

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return TRUE_VALUES.has(value.toLowerCase());
}

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getLogConfig() {
  const enabled = envFlag("LOG_ENABLED", false);
  const all = envFlag("LOG_ALL", false);

  return {
    enabled,
    dir: process.env.LOG_DIR || "./logs",
    level: (process.env.LOG_LEVEL || "info") as LogLevel,
    pretty: envFlag("LOG_PRETTY", true),
    redactSecrets: envFlag("LOG_REDACT_SECRETS", true),
    maxInlineChars: envNumber("LOG_MAX_INLINE_CHARS", 20_000),
    categories: {
      agent: all || envFlag("LOG_AGENT", true),
      openai: all || envFlag("LOG_OPENAI", false),
      tools: all || envFlag("LOG_TOOLS", true),
      workspace: all || envFlag("LOG_WORKSPACE", true),
      automation: all || envFlag("LOG_AUTOMATION", true),
      browser: all || envFlag("LOG_BROWSER", true),
      snapshots: all || envFlag("LOG_SNAPSHOTS", true),
      rawSnapshots: all || envFlag("LOG_RAW_SNAPSHOTS", false),
      compactSnapshots: all || envFlag("LOG_COMPACT_SNAPSHOTS", true),
    } satisfies Record<LogCategory, boolean>,
  };
}

export function isLogCategoryEnabled(category: LogCategory) {
  const config = getLogConfig();
  return config.enabled && config.categories[category];
}
