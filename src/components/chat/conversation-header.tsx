"use client";

import { MonitorPlay, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConversationDetail } from "@/types/chat";

type ConversationHeaderProps = {
  conversation: ConversationDetail | null;
  onStartWorkspace: () => Promise<void>;
  onStopWorkspace: () => Promise<void>;
  workspaceAction?: "starting" | "stopping" | null;
  titlePending?: boolean;
};

export function ConversationHeader({
  conversation,
  onStartWorkspace,
  onStopWorkspace,
  workspaceAction,
  titlePending,
}: ConversationHeaderProps) {
  const workspaceActive = conversation?.mode === "WORKSPACE";
  const workspaceStopped = workspaceActive && conversation?.workspaceSession?.status === "STOPPED";
  const busy = workspaceAction !== null;

  return (
    <header className="flex h-14 min-w-0 items-center justify-between gap-3 overflow-hidden border-b border-zinc-900 px-4">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 truncate text-sm font-medium text-zinc-300">
          {titlePending ? <TitleDots /> : (conversation?.title ?? "Nouveau chat")}
        </div>
      </div>
      {workspaceActive && !workspaceStopped ? (
        <Button variant="ghost" onClick={onStopWorkspace} disabled={busy}>
          <PanelLeftClose size={17} />
          {workspaceAction === "stopping" ? "Arret..." : "Quitter workspace"}
        </Button>
      ) : (
        <Button variant="ghost" onClick={onStartWorkspace} disabled={!conversation || busy}>
          <MonitorPlay size={17} />
          {workspaceAction === "starting" ? "Preparation..." : "Activer workspace"}
        </Button>
      )}
    </header>
  );
}

function TitleDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Titre en cours de generation">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
    </span>
  );
}
