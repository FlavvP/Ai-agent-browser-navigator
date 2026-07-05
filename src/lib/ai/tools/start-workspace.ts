import { enterWorkspaceMode, startWorkspaceBrowser } from "@/lib/workspace/workspace-service";

export async function enterWorkspaceModeTool(conversationId: string, userId: string) {
  return enterWorkspaceMode(conversationId, userId);
}

export async function startWorkspaceBrowserTool(conversationId: string, userId: string, url?: string | null) {
  return startWorkspaceBrowser(conversationId, userId, url);
}
