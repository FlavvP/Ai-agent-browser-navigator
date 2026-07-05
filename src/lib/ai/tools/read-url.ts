import * as cheerio from "cheerio";

type ReadUrlInput = {
  url: string;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_CHARS = 20_000;
const MAX_HTML_BYTES = 2_000_000;

export async function readUrlTool(input: ReadUrlInput) {
  const validation = validatePublicHttpUrl(input.url);
  if (!validation.ok) return { ok: false, message: validation.message };

  const timeoutMs = readNumberEnv("WEB_FETCH_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const maxChars = readNumberEnv("WEB_FETCH_MAX_CHARS", DEFAULT_MAX_CHARS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(validation.url, {
      headers: {
        "User-Agent": "AgentBrowserNavigator/0.1 (+https://localhost)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, url: validation.url, message: `La page a retourne une erreur ${response.status}.` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { ok: false, url: validation.url, message: `Type de contenu non supporte: ${contentType}.` };
    }

    const html = await readBodyWithLimit(response, MAX_HTML_BYTES);
    const extracted = extractReadableText(html);
    const text = compactWhitespace(extracted.text);
    const truncated = text.length > maxChars;

    return {
      ok: true,
      url: validation.url,
      title: extracted.title,
      text: truncated ? text.slice(0, maxChars) : text,
      truncated,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Delai de lecture depasse." : "Lecture impossible.";
    return { ok: false, url: validation.url, message };
  } finally {
    clearTimeout(timeout);
  }
}

function validatePublicHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false as const, message: "URL obligatoire." };
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return { ok: false as const, message: "URL invalide." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false as const, message: "Seules les URLs http et https sont autorisees." };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    return { ok: false as const, message: "Les URLs locales ou privees sont refusees." };
  }

  return { ok: true as const, url: parsed.toString() };
}

function isBlockedHostname(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname === "::1" || hostname === "[::1]") return true;

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

async function readBodyWithLimit(response: Response, maxBytes: number) {
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.slice(0, Math.max(0, value.byteLength - (total - maxBytes))));
      break;
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

function extractReadableText(html: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, nav, footer, header").remove();

  const title = compactWhitespace($("title").first().text() || $("h1").first().text() || "");
  const mainText = $("main").text() || $("article").text() || $("body").text();

  return { title, text: mainText };
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
