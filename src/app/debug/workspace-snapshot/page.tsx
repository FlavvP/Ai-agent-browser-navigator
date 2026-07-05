import { auth } from "@/auth";
import { AuthScreen } from "@/components/auth/auth-screen";
import { WorkspaceSnapshotDebugClient } from "@/app/debug/workspace-snapshot/workspace-snapshot-debug-client";

export default async function WorkspaceSnapshotDebugPage() {
  const session = await auth();
  if (!session?.user?.id) return <AuthScreen />;

  return <WorkspaceSnapshotDebugClient />;
}

