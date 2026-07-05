import { WorkspacePlaceholder } from "@/components/workspace/workspace-placeholder";
import { WorkspaceStatus } from "@/components/workspace/workspace-status";
import type { ConversationDetail } from "@/types/chat";

type WorkspacePanelProps = {
  conversation: ConversationDetail | null;
};

export function WorkspacePanel({ conversation }: WorkspacePanelProps) {
  if (conversation?.mode !== "WORKSPACE") return null;
  const session = conversation.workspaceSession;
  const status = session?.status ?? "WORKSPACE_MODE";
  const showStream = status === "RUNNING" && session?.streamUrl;
  const aspectRatio = getWorkspaceAspectRatio(session?.metadataJson ?? null);

  return (
    <section className="flex h-screen w-1/2 min-w-[420px] shrink-0 items-center overflow-y-auto border-r border-zinc-800 bg-black p-4 xl:min-w-[520px]">
      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-200">Workspace agentique</div>
            {showStream ? <div className="truncate text-xs text-zinc-500">{session.streamUrl}</div> : null}
          </div>
          <WorkspaceStatus status={status} />
        </div>
        <div className="overflow-hidden bg-black" style={{ aspectRatio }}>
          {showStream ? (
            <iframe
              key={`${session.id}:${session.streamUrl}`}
              src={session.streamUrl ?? ""}
              className="h-full w-full border-0 bg-black"
              allow="autoplay; microphone; camera; clipboard-read; clipboard-write; fullscreen"
              title="Workspace Linux"
            />
          ) : (
            <WorkspacePlaceholder status={status} />
          )}
        </div>
      </div>
    </section>
  );
}

function getWorkspaceAspectRatio(metadataJson: string | null) {
  if (!metadataJson) return "16 / 9";

  try {
    const metadata = JSON.parse(metadataJson) as { screenWidth?: unknown; screenHeight?: unknown };
    const width = Number(metadata.screenWidth);
    const height = Number(metadata.screenHeight);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return `${width} / ${height}`;
    }
  } catch {
    return "16 / 9";
  }

  return "16 / 9";
}
