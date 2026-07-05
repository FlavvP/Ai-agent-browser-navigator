import type { Message } from "@prisma/client";
import type { ToolEvent } from "@prisma/client";
import type { Responses } from "openai/resources/responses/responses";
import { getOpenAIClient } from "@/lib/ai/openai-client";
import { CLASSIC_SYSTEM_PROMPT, WORKSPACE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { OPENAI_CLASSIC_TOOLS, OPENAI_WORKSPACE_TOOLS } from "@/lib/ai/tools";
import { runClassicTool } from "@/lib/ai/tools/tool-runner";
import { runWorkspaceTool } from "@/lib/ai/tools/workspace-tool-runner";
import { logAgentEvent, logOpenAIArtifact } from "@/lib/logging/logger";
import { workspaceSnapshot } from "@/lib/workspace/automation-client";

type RunChatInput = {
  messages: Message[];
  mode: "CLASSIC" | "WORKSPACE";
  conversationId: string;
  userId: string;
  userMessageId?: string | null;
  abortSignal?: AbortSignal;
};

const MAX_TOOL_RUN_MS = 180_000;

type RunChatStreamInput = RunChatInput & {
  onTextDelta: (delta: string) => void | Promise<void>;
  onToolEvent?: (event: ToolEvent) => void | Promise<void>;
};

export async function runAssistantReply({ messages, mode, conversationId, userId, userMessageId, abortSignal }: RunChatInput) {
  return runAssistantReplyInternal({ messages, mode, conversationId, userId, userMessageId, abortSignal });
}

export async function runAssistantReplyStream(input: RunChatStreamInput) {
  return runAssistantReplyInternal(input);
}

async function runAssistantReplyInternal({
  messages,
  mode,
  conversationId,
  userId,
  userMessageId,
  abortSignal,
  onTextDelta,
  onToolEvent,
}: RunChatInput & {
  onTextDelta?: (delta: string) => void | Promise<void>;
  onToolEvent?: (event: ToolEvent) => void | Promise<void>;
}) {
  const client = getOpenAIClient();
  if (!client) {
    const fallback = fallbackReply(mode);
    await onTextDelta?.(fallback);
    return fallback;
  }
  let currentMode = mode;

  let input: Responses.ResponseInputItem[] = messages.map((message) => ({
    role: mapRole(message.role),
    content: message.content,
  }));
  if (mode === "WORKSPACE") {
    const workspaceContext = await buildInitialWorkspaceContext({ conversationId, userId });
    if (workspaceContext) {
      input.push({
        role: "system",
        content: workspaceContext,
      });
    }
  }

  await logAgentEvent({
    userId,
    conversationId,
    event: "assistant_run_start",
    data: {
      mode,
      messages: messages.length,
      availableTools: currentMode === "CLASSIC" ? toolNames(OPENAI_CLASSIC_TOOLS) : toolNames(OPENAI_WORKSPACE_TOOLS),
    },
  });

  const deadline = Date.now() + Number(process.env.OPENAI_TOOL_RUN_TIMEOUT_MS || MAX_TOOL_RUN_MS);
  const repeatedToolCalls = new Map<string, number>();

  for (let iteration = 0; ; iteration += 1) {
    if (abortSignal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (Date.now() > deadline) {
      await logAgentEvent({
        userId,
        conversationId,
        level: "warn",
        event: "tool_run_timeout_reached",
        data: { iteration, mode: currentMode },
      });
      return "La tache prend trop de temps et a ete interrompue pour eviter une boucle infinie. Reformulez ou precisez la prochaine action.";
    }

    const request = {
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: currentMode === "WORKSPACE" ? WORKSPACE_SYSTEM_PROMPT : CLASSIC_SYSTEM_PROMPT,
      input,
      tools: currentMode === "CLASSIC" ? OPENAI_CLASSIC_TOOLS : OPENAI_WORKSPACE_TOOLS,
      parallel_tool_calls: false,
    };

    await logAgentEvent({
      userId,
      conversationId,
      event: "openai_request",
      data: {
        iteration,
        mode: currentMode,
        model: request.model,
        inputItems: input.length,
        tools: toolNames(request.tools),
      },
    });
    await logOpenAIArtifact({ userId, conversationId, name: `iteration_${iteration}_request`, data: request });

    const response = onTextDelta
      ? await createStreamingResponse({
          request,
          abortSignal,
          onTextDelta,
        })
      : await client.responses.create(request, { signal: abortSignal });
    await logOpenAIArtifact({ userId, conversationId, name: `iteration_${iteration}_response`, data: response });

    const functionCalls = response.output.filter((item) => item.type === "function_call");
    if (functionCalls.length === 0) {
      await logAgentEvent({
        userId,
        conversationId,
        event: "assistant_final_response",
        data: { iteration, mode: currentMode, outputTextLength: getResponseOutputText(response).length },
      });
      return getResponseOutputText(response) || fallbackReply(mode);
    }

    input = [...input, ...(response.output as Responses.ResponseInputItem[])];

    for (const functionCall of functionCalls) {
      await logAgentEvent({
        userId,
        conversationId,
        event: "tool_call_selected",
        data: {
          iteration,
          mode: currentMode,
          toolName: functionCall.name,
          arguments: functionCall.arguments,
        },
      });

      const repeatedKey = getRepeatedToolCallKey(functionCall.name, functionCall.arguments);
      const repeatedCount = repeatedKey ? repeatedToolCalls.get(repeatedKey) ?? 0 : 0;
      if (repeatedKey) repeatedToolCalls.set(repeatedKey, repeatedCount + 1);

      if (repeatedKey && repeatedCount >= 2) {
        const output = {
          agent_instruction:
            "Tu viens de repeter plusieurs fois la meme action sans progres observable. Ne clique plus sur cette meme ref. Appelle workspace_snapshot en mode expanded, cherche une autre ref pertinente, gere une modale/cookie si presente, ou explique le blocage a l'utilisateur.",
          tool_result: {
            ok: false,
            code: "repeated_action_blocked",
            message: "Action repetitive bloquee par le backend pour eviter une boucle.",
          },
        };
        await logAgentEvent({
          userId,
          conversationId,
          level: "warn",
          event: "repeated_tool_call_blocked",
          data: { iteration, mode: currentMode, toolName: functionCall.name, arguments: functionCall.arguments },
        });
        input.push({
          type: "function_call_output",
          call_id: functionCall.call_id,
          output: JSON.stringify(output),
        });
        continue;
      }

      const output =
        currentMode === "CLASSIC"
          ? await runClassicTool({
              conversationId,
              userId,
              messageId: userMessageId ?? null,
              toolName: functionCall.name,
              rawArguments: functionCall.arguments,
              onToolEvent,
            })
          : await runWorkspaceTool({
              conversationId,
              userId,
              messageId: userMessageId ?? null,
              toolName: functionCall.name,
              rawArguments: functionCall.arguments,
              onToolEvent,
            });

      const toolResult = typeof output.tool_result === "object" && output.tool_result !== null ? output.tool_result : {};
      if (
        currentMode === "CLASSIC" &&
        functionCall.name === "enter_workspace_mode" &&
        "ok" in toolResult &&
        toolResult.ok === true
      ) {
        currentMode = "WORKSPACE";
        await logAgentEvent({
          userId,
          conversationId,
          event: "mode_changed_during_tool_loop",
          data: { newMode: currentMode, availableTools: toolNames(OPENAI_WORKSPACE_TOOLS) },
        });
      }

      input.push({
        type: "function_call_output",
        call_id: functionCall.call_id,
        output: JSON.stringify(output),
      });
    }
  }

  return fallbackReply(mode);
}

function getResponseOutputText(response: Responses.Response) {
  if (response.output_text) return response.output_text;

  return response.output
    .flatMap((item) => {
      if (item.type !== "message") return [];
      return item.content.flatMap((content) => {
        if (content.type !== "output_text") return [];
        return content.text;
      });
    })
    .join("");
}

async function createStreamingResponse({
  request,
  abortSignal,
  onTextDelta,
}: {
  request: {
    model: string;
    instructions: string;
    input: Responses.ResponseInputItem[];
    tools: Responses.Tool[];
    parallel_tool_calls: boolean;
  };
  abortSignal?: AbortSignal;
  onTextDelta: (delta: string) => void | Promise<void>;
}) {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI client is not configured");

  const stream = await client.responses.create({ ...request, stream: true }, { signal: abortSignal });
  let response: Responses.Response | null = null;

  for await (const event of stream) {
    if (abortSignal?.aborted) throw new DOMException("Aborted", "AbortError");

    if (event.type === "response.output_text.delta") {
      await onTextDelta(event.delta);
      continue;
    }

    if (event.type === "response.completed") {
      response = event.response;
      continue;
    }

    if (event.type === "response.failed") {
      throw new Error(event.response.error?.message || "OpenAI response failed");
    }

    if (event.type === "error") {
      throw new Error(event.message || "OpenAI stream failed");
    }
  }

  return response ?? {
    output: [],
    output_text: "",
  } as unknown as Responses.Response;
}

function toolNames(tools: Responses.Tool[]) {
  return tools.map((tool) => ("name" in tool ? tool.name : tool.type));
}

function mapRole(role: Message["role"]) {
  if (role === "ASSISTANT") return "assistant" as const;
  if (role === "SYSTEM") return "system" as const;
  return "user" as const;
}

function fallbackReply(mode: "CLASSIC" | "WORKSPACE") {
  if (mode === "WORKSPACE") {
    return "Mode workspace actif. Ajoute OPENAI_API_KEY dans `.env` pour obtenir une vraie reponse OpenAI.";
  }
  return "Je suis pret. Ajoute OPENAI_API_KEY dans `.env` pour brancher les reponses OpenAI reelles.";
}

function getRepeatedToolCallKey(toolName: string, rawArguments: string) {
  try {
    const args = JSON.parse(rawArguments || "{}") as Record<string, unknown>;
    if (toolName === "workspace_click") return `${toolName}:${String(args.ref ?? "")}`;
    if (toolName === "workspace_fill") return `${toolName}:${String(args.ref ?? "")}:${String(args.text ?? "")}`;
    if (toolName === "workspace_press") return `${toolName}:${String(args.keys ?? "")}`;
  } catch {
    return `${toolName}:${rawArguments}`;
  }
  return null;
}

async function buildInitialWorkspaceContext(input: { conversationId: string; userId: string }) {
  try {
    const snapshot = await workspaceSnapshot({ ...input, mode: "expanded" });
    if (!snapshot.ok) {
      return [
        "Contexte workspace actuel:",
        "L'utilisateur a deja active le mode workspace, mais le snapshot automatique a echoue.",
        `Erreur: ${snapshot.warning || snapshot.message || "snapshot indisponible"}`,
        "Si la tache necessite une navigation visuelle, commence par start_workspace_browser ou rappelle workspace_snapshot.",
      ].join("\n");
    }

    return [
      "Contexte workspace actuel:",
      "L'utilisateur a deja active le workspace via l'interface. Le navigateur workspace visible a gauche est deja disponible.",
      "Voici le snapshot courant du workspace au debut de cette requete. Utilise-le pour raisonner avant d'appeler un tool.",
      "Si tu dois naviguer vers une URL precise, appelle start_workspace_browser avec cette URL: le tool naviguera dans le workspace deja actif.",
      "Si tu dois agir sur la page actuelle, lis le champ refs et utilise uniquement ses refs avec le snapshot_id ci-dessous. Ne calcule jamais de coordonnees.",
      JSON.stringify(snapshot),
    ].join("\n");
  } catch (error) {
    await logAgentEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      level: "warn",
      event: "initial_workspace_snapshot_failed",
      data: { message: error instanceof Error ? error.message : String(error) },
    });
    return [
      "Contexte workspace actuel:",
      "L'utilisateur a deja active le mode workspace, mais le snapshot automatique initial n'est pas disponible.",
      "Commence par workspace_snapshot pour lire l'ecran si la tache depend de l'etat visuel actuel.",
    ].join("\n");
  }
}
