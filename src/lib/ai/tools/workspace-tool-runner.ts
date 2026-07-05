import { addToolEvent } from "@/lib/db/tool-events";
import type { ToolEvent } from "@prisma/client";
import type { WorkspaceToolName } from "@/lib/ai/tools";
import { startWorkspaceBrowser, stopWorkspaceBrowser } from "@/lib/workspace/workspace-service";
import {
  workspaceClick,
  workspaceFill,
  workspacePress,
  workspaceScroll,
  workspaceSnapshot,
} from "@/lib/workspace/automation-client";
import { logError, logToolEvent } from "@/lib/logging/logger";

type RunWorkspaceToolInput = {
  conversationId: string;
  userId: string;
  messageId?: string | null;
  toolName: string;
  rawArguments: string;
  onToolEvent?: (event: ToolEvent) => void | Promise<void>;
};

export async function runWorkspaceTool(input: RunWorkspaceToolInput) {
  const startedAt = Date.now();
  const args = parseToolArguments(input.rawArguments);
  const toolName = input.toolName;

  if (!isWorkspaceToolName(toolName)) {
    const response = wrapWorkspaceToolResponse(toolName, { ok: false, message: `Tool workspace inconnu: ${toolName}.` });
    await persistToolEvent(input, args, "ERROR", response);
    await logToolEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      level: "error",
      event: "workspace_tool_unknown",
      data: { toolName, args, durationMs: Date.now() - startedAt, response },
    });
    return response;
  }

  try {
    await logToolEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      event: "workspace_tool_start",
      data: { toolName, args },
    });
    const output = await executeWorkspaceTool(toolName, input, args);
    const response = wrapWorkspaceToolResponse(toolName, output);
    await persistToolEvent(input, args, output.ok ? "SUCCESS" : "ERROR", response);
    await logToolEvent({
      userId: input.userId,
      conversationId: input.conversationId,
      level: output.ok ? "info" : "error",
      event: "workspace_tool_done",
      data: { toolName, args, durationMs: Date.now() - startedAt, output: summarizeWorkspaceOutput(output) },
    });
    return response;
  } catch (error) {
    const output = { ok: false, message: error instanceof Error ? error.message : "Erreur workspace inattendue." };
    const response = wrapWorkspaceToolResponse(toolName, output);
    await persistToolEvent(input, args, "ERROR", response);
    await logError({
      userId: input.userId,
      conversationId: input.conversationId,
      category: "tools",
      file: "tools.log",
      event: "workspace_tool_exception",
      error,
      data: { toolName, args, durationMs: Date.now() - startedAt },
    });
    return response;
  }
}

function parseToolArguments(rawArguments: string) {
  try {
    const parsed = JSON.parse(rawArguments || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isWorkspaceToolName(value: string): value is WorkspaceToolName {
  return (
    value === "start_workspace_browser" ||
    value === "stop_workspace_browser" ||
    value === "workspace_snapshot" ||
    value === "workspace_click" ||
    value === "workspace_fill" ||
    value === "workspace_press" ||
    value === "workspace_scroll"
  );
}

function executeWorkspaceTool(toolName: WorkspaceToolName, input: RunWorkspaceToolInput, args: Record<string, unknown>) {
  if (toolName === "start_workspace_browser") {
    return startWorkspaceBrowser(input.conversationId, input.userId, typeof args.url === "string" ? args.url : undefined).then(
      (result) => ({
        ok: result.status !== "FAILED",
        status: result.status,
        streamUrl: result.streamUrl,
        message: result.note,
      }),
    );
  }
  if (toolName === "stop_workspace_browser") {
    return stopWorkspaceBrowser(input.conversationId, input.userId).then(() => ({
      ok: true,
      status: "STOPPED",
      message: "Navigateur workspace arrete. Le mode workspace reste actif.",
    }));
  }
  if (toolName === "workspace_snapshot") {
    return workspaceSnapshot({
      conversationId: input.conversationId,
      userId: input.userId,
      mode: args.mode === "compact" ? "compact" : "expanded",
    });
  }
  if (toolName === "workspace_click") {
    return workspaceClick({
      conversationId: input.conversationId,
      userId: input.userId,
      snapshotId: String(args.snapshot_id ?? ""),
      ref: String(args.ref ?? ""),
    });
  }
  if (toolName === "workspace_fill") {
    return workspaceFill({
      conversationId: input.conversationId,
      userId: input.userId,
      snapshotId: String(args.snapshot_id ?? ""),
      ref: String(args.ref ?? ""),
      text: String(args.text ?? ""),
      mode: args.mode === "append" ? "append" : "replace",
    });
  }
  if (toolName === "workspace_press") {
    return workspacePress({ conversationId: input.conversationId, userId: input.userId, keys: String(args.keys ?? "") });
  }
  return workspaceScroll({
    conversationId: input.conversationId,
    userId: input.userId,
    direction: String(args.direction ?? "down"),
    amount: String(args.amount ?? "small"),
  });
}

function wrapWorkspaceToolResponse(toolName: string, output: { ok: boolean; [key: string]: unknown }) {
  return {
    agent_instruction: buildWorkspaceAgentInstruction(toolName, output),
    tool_result: output,
  };
}

function summarizeWorkspaceOutput(output: Record<string, unknown>) {
  const elements = Array.isArray(output.elements) ? output.elements.length : undefined;
  const refs = Array.isArray(output.refs) ? output.refs.length : undefined;
  return {
    ok: output.ok,
    message: output.message,
    status: output.status,
    streamUrl: output.streamUrl,
    snapshot_id: output.snapshot_id,
    mode: output.mode,
    ref_count: output.ref_count,
    refs,
    warning: output.warning,
    elements,
  };
}

function buildWorkspaceAgentInstruction(toolName: string, output: { ok: boolean; [key: string]: unknown }) {
  if (!output.ok) {
    return "Le tool workspace a echoue. Explique la limite si elle bloque la tache, ou appelle workspace_snapshot pour reprendre l'etat courant. N'invente pas l'etat de l'ecran.";
  }

  if (toolName === "start_workspace_browser") {
    return "Le navigateur workspace est demarre et visible par l'utilisateur. Appelle workspace_snapshot pour lire l'ecran avant toute action.";
  }

  if (toolName === "stop_workspace_browser") {
    return "Le navigateur workspace est arrete, mais tu restes en mode workspace. Si une nouvelle navigation visuelle est necessaire, appelle start_workspace_browser.";
  }

  if (toolName === "workspace_snapshot") {
    return "Lis tool_result.refs: c'est la liste des elements accessibles du snapshot courant. Les refs @eN de ce snapshot_id sont les seules cibles valides. Choisis la bonne ref avec role, name, text, value, description et states. Ne calcule jamais de coordonnees. Si un element semble manquer, rappelle workspace_snapshot en mode expanded.";
  }

  return "L'action workspace a ete executee et un nouveau snapshot est fourni. Continue uniquement avec les nouvelles refs et le nouveau snapshot_id.";
}

async function persistToolEvent(
  input: RunWorkspaceToolInput,
  parsedInput: unknown,
  status: "SUCCESS" | "ERROR",
  output: unknown,
) {
  const event = await addToolEvent({
    conversationId: input.conversationId,
    messageId: input.messageId ?? null,
    toolName: input.toolName,
    status,
    input: parsedInput,
    output,
  });
  await input.onToolEvent?.(event);
  return event;
}
