import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateDebugSnapshotConversation } from "@/lib/debug/workspace-snapshot-debug";
import { startWorkspaceBrowser } from "@/lib/workspace/workspace-service";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conversation = await getOrCreateDebugSnapshotConversation(session.user.id);
    const result = await startWorkspaceBrowser(conversation.id, session.user.id, "https://www.google.com");

    return NextResponse.json({
      ok: result.status !== "FAILED",
      conversationId: conversation.id,
      status: result.status,
      streamUrl: result.streamUrl,
      note: result.note,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Workspace debug start failed" },
      { status: 500 },
    );
  }
}

