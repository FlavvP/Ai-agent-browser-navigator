import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createConversation, listConversations } from "@/lib/db/conversations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await listConversations(session.user.id);
  return NextResponse.json({ conversations });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await createConversation(session.user.id);
  return NextResponse.json(conversation);
}
