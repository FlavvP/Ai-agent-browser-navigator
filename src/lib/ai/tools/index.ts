export const AVAILABLE_CLASSIC_TOOLS = ["web_search", "read_url", "enter_workspace_mode"] as const;
export const AVAILABLE_WORKSPACE_TOOLS = [
  "start_workspace_browser",
  "stop_workspace_browser",
  "workspace_snapshot",
  "workspace_click",
  "workspace_fill",
  "workspace_press",
  "workspace_scroll",
] as const;

export type ClassicToolName = (typeof AVAILABLE_CLASSIC_TOOLS)[number];
export type WorkspaceToolName = (typeof AVAILABLE_WORKSPACE_TOOLS)[number];

export const OPENAI_CLASSIC_TOOLS = [
  {
    type: "function" as const,
    name: "web_search",
    description: "Recherche le web avec Serper.dev et retourne des resultats Google normalises.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "La requete de recherche web.",
        },
        num: {
          type: "number",
          description: "Nombre de resultats a retourner, entre 1 et 10. Defaut: 5.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "read_url",
    description: "Lit une page web publique en extrayant son titre et son texte principal.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL http ou https publique a consulter.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "enter_workspace_mode",
    description:
      "Passe la conversation en mode workspace agentique. Ne demarre pas le navigateur; une fois en mode workspace, utilise start_workspace_browser si une navigation visuelle est necessaire.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: false,
  },
];

export const OPENAI_WORKSPACE_TOOLS = [
  {
    type: "function" as const,
    name: "start_workspace_browser",
    description: "Demarre le navigateur Chromium visible dans le workspace, optionnellement sur une URL precise.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL http ou https optionnelle a ouvrir dans Chromium.",
        },
      },
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "stop_workspace_browser",
    description: "Arrete le container navigateur workspace, tout en gardant la conversation en mode workspace.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: false,
  },
  {
    type: "function" as const,
    name: "workspace_snapshot",
    description:
      "Lit l'etat courant du navigateur workspace et retourne une liste de refs symboliques issues de l'accessibilite Linux.",
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["compact", "expanded"],
          description:
            "Mode expanded par defaut: plus complet, recommande pour comprendre une page. Mode compact: plus court.",
        },
      },
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "workspace_click",
    description: "Clique un element du dernier snapshot workspace via sa ref symbolique.",
    parameters: {
      type: "object",
      properties: {
        snapshot_id: { type: "string" },
        ref: { type: "string" },
      },
      required: ["snapshot_id", "ref"],
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "workspace_fill",
    description: "Remplit un champ du workspace via sa ref symbolique et retourne un nouveau snapshot.",
    parameters: {
      type: "object",
      properties: {
        snapshot_id: { type: "string" },
        ref: { type: "string" },
        text: { type: "string" },
        mode: { type: "string", enum: ["replace", "append"] },
      },
      required: ["snapshot_id", "ref", "text"],
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "workspace_press",
    description: "Envoie une touche autorisee dans le workspace et retourne un nouveau snapshot.",
    parameters: {
      type: "object",
      properties: {
        keys: { type: "string", enum: ["Enter", "Tab", "Esc", "Backspace", "Ctrl+A", "Ctrl+L"] },
      },
      required: ["keys"],
      additionalProperties: false,
    },
    strict: false,
  },
  {
    type: "function" as const,
    name: "workspace_scroll",
    description: "Scroll la page workspace puis retourne un nouveau snapshot.",
    parameters: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
        amount: { type: "string", enum: ["small", "page"] },
      },
      required: ["direction"],
      additionalProperties: false,
    },
    strict: false,
  },
];
