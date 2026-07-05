import { getOpenAIClient } from "@/lib/ai/openai-client";

const DEFAULT_TITLE_MODEL = "gpt-4.1-nano";
const MAX_TITLE_WORDS = 5;

export async function generateConversationTitle(firstUserMessage: string) {
  const fallback = fallbackConversationTitle(firstUserMessage);
  const client = getOpenAIClient();
  if (!client) return fallback;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_TITLE_MODEL || DEFAULT_TITLE_MODEL,
      instructions: [
        "Tu generes des titres courts de conversations.",
        "Reponds uniquement avec un titre.",
        `Maximum ${MAX_TITLE_WORDS} mots.`,
        "Pas de guillemets, pas de ponctuation finale.",
        "N'abrege aucun mot.",
        "Ne fais aucune faute d'orthographe.",
        "Conserve les noms propres exactement si tu les utilises.",
        "Utilise la meme langue que le message si possible.",
      ].join("\n"),
      input: firstUserMessage,
    });

    return sanitizeTitle(response.output_text || fallback) || fallback;
  } catch {
    return fallback;
  }
}

export function fallbackConversationTitle(message: string) {
  return sanitizeTitle(message) || "Nouveau chat";
}

function sanitizeTitle(value: string) {
  const compact = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/^["'`“”‘’«»\s]+|["'`“”‘’«»\s]+$/g, "")
    .replace(/[.!?;:,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return compact.split(" ").filter(Boolean).slice(0, MAX_TITLE_WORDS).join(" ");
}
