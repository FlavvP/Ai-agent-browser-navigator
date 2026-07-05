type WebSearchInput = {
  query: string;
  num?: number;
};

type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
};

export async function webSearchTool(input: WebSearchInput) {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return { ok: false, message: "La requete de recherche est obligatoire." };

  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      message: "SERPER_API_KEY est absente. Configurez la cle Serper.dev dans `.env` pour utiliser web_search.",
    };
  }

  const num = clampResultCount(input.num);
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num, hl: "fr", gl: "fr" }),
  });

  if (!response.ok) {
    return {
      ok: false,
      message: `Serper.dev a retourne une erreur ${response.status}.`,
    };
  }

  const data = (await response.json()) as SerperResponse;
  const results = (data.organic ?? [])
    .filter((item) => item.title && item.link)
    .slice(0, num)
    .map((item, index) => ({
      title: item.title ?? "",
      url: item.link ?? "",
      snippet: item.snippet ?? "",
      position: item.position ?? index + 1,
    }));

  return { ok: true, results };
}

function clampResultCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(10, Math.floor(value)));
}
