"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatView } from "@/components/chat/chat-view";
import { Sidebar } from "@/components/app-shell/sidebar";
import type { ConversationSummary } from "@/types/chat";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingTitleConversationId, setPendingTitleConversationId] = useState<string | null>(null);
  const collapseSidebar = useCallback(() => setCollapsed(true), []);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    if (response.status === 401) {
      window.location.reload();
      return;
    }
    const data = await response.json();
    setConversations(data.conversations);
    if (
      pendingTitleConversationId &&
      data.conversations.some(
        (conversation: ConversationSummary) =>
          conversation.id === pendingTitleConversationId && !isDefaultConversationTitle(conversation.title),
      )
    ) {
      setPendingTitleConversationId(null);
    }
  }, [pendingTitleConversationId]);

  function createConversation() {
    setActiveConversationId(null);
    setPendingTitleConversationId(null);
  }

  async function renameConversation(conversationId: string, title: string) {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (response.status === 401) {
      window.location.reload();
      return;
    }
    if (!response.ok) throw new Error("Conversation rename failed");
    await loadConversations();
  }

  async function deleteConversation(conversationId: string) {
    const response = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    if (response.status === 401) {
      window.location.reload();
      return;
    }
    if (!response.ok) throw new Error("Conversation delete failed");

    const remaining = conversations.filter((conversation) => conversation.id !== conversationId);
    setConversations(remaining);
    if (activeConversationId === conversationId) {
      setActiveConversationId(remaining[0]?.id ?? null);
    }
    await loadConversations();
  }

  useEffect(() => {
    const task = setTimeout(() => {
      void loadConversations();
    }, 0);
    return () => clearTimeout(task);
  }, [loadConversations]);

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      <Sidebar
        collapsed={collapsed}
        conversations={conversations}
        activeConversationId={activeConversationId}
        pendingTitleConversationId={pendingTitleConversationId}
        onNewConversation={createConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onSelectConversation={setActiveConversationId}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <ChatView
        activeConversationId={activeConversationId}
        onConversationChange={setActiveConversationId}
        onConversationsReload={loadConversations}
        onTitlePendingChange={setPendingTitleConversationId}
        onWorkspaceActivated={collapseSidebar}
      />
    </div>
  );
}

function isDefaultConversationTitle(title: string) {
  return title === "Nouveau chat" || title === "Nouvelle conversation";
}
