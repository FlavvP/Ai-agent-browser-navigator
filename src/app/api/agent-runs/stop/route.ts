import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelAgentRun } from "@/lib/ai/agent-run-manager";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const runId = typeof body.runId === "string" ? body.runId : "";
  if (!runId) return NextResponse.json({ error: "runId is required" }, { status: 400 });

  await cancelAgentRun(runId, session.user.id);
  return NextResponse.json({ ok: true });
}
