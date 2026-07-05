import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateDebugSnapshotConversation } from "@/lib/debug/workspace-snapshot-debug";
import { workspaceDebugSnapshot } from "@/lib/workspace/automation-client";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conversation = await getOrCreateDebugSnapshotConversation(session.user.id);
    const debugSnapshot = await workspaceDebugSnapshot({
      conversationId: conversation.id,
      userId: session.user.id,
      mode: "expanded",
    });

    return NextResponse.json({
      ok: true,
      conversationId: conversation.id,
      rawSnapshot: debugSnapshot.raw_snapshot,
      accerciserSnapshot: debugSnapshot.accerciser_snapshot,
      llmPayload: {
        agent_instruction:
          "Lis tool_result.refs: c'est la liste des elements accessibles du snapshot courant. Les refs @eN de ce snapshot_id sont les seules cibles valides. Choisis la bonne ref avec role, name, text, value, description et states. Ne calcule jamais de coordonnees. Si un element semble manquer, rappelle workspace_snapshot en mode expanded.",
        tool_result: debugSnapshot.cleaned_snapshot,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Workspace debug capture failed" },
      { status: 500 },
    );
  }
}
