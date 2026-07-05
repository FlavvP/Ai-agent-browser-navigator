import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateDebugSnapshotConversation } from "@/lib/debug/workspace-snapshot-debug";
import { stopWorkspaceBrowser } from "@/lib/workspace/workspace-service";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conversation = await getOrCreateDebugSnapshotConversation(session.user.id);
    await stopWorkspaceBrowser(conversation.id, session.user.id);

    return NextResponse.json({
      ok: true,
      conversationId: conversation.id,
      status: "STOPPED",
      streamUrl: null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Workspace debug stop failed" },
      { status: 500 },
    );
  }
}

