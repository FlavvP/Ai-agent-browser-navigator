import { getLogConfig } from "@/lib/logging/log-config";

const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwordHash",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "OPENAI_API_KEY",
  "SERPER_API_KEY",
  "AUTH_SECRET",
];

function shouldRedactKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive.toLowerCase()));
}

function truncateString(value: string) {
  const max = getLogConfig().maxInlineChars;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...[truncated ${value.length - max} chars]`;
}

export function redactForLogs(value: unknown): unknown {
  if (!getLogConfig().redactSecrets) return value;

  if (typeof value === "string") return truncateString(value);
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map((item) => redactForLogs(item));

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = shouldRedactKey(key) ? "[REDACTED]" : redactForLogs(item);
  }
  return result;
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}
