"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/chat-input";
import { ConversationHeader } from "@/components/chat/conversation-header";
import { MessageList } from "@/components/chat/message-list";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import type { ChatToolEvent, ConversationDetail } from "@/types/chat";

type ChatViewProps = {
  activeConversationId: string | null;
  onConversationChange: (conversationId: string) => void;
  onConversationsReload: () => Promise<void>;
  onTitlePendingChange: (conversationId: string | null) => void;
  onWorkspaceActivated: () => void;
};

const DEFAULT_CONVERSATION_TITLES = new Set(["Nouveau chat", "Nouvelle conversation"]);

type ChatStreamEvent =
  | {
      type: "start";
      conversationId: string;
      conversationTitle?: string;
      userMessage: ConversationDetail["messages"][number];
      agentRun: { id: string };
    }
  | { type: "tool"; event: ChatToolEvent }
  | { type: "delta"; delta: string }
  | { type: "done"; conversation: ConversationDetail }
  | { type: "error"; message: string };

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "string" && error.toLowerCase().includes("abort"))
  );
}

export function ChatView(props: ChatViewProps) {
  const { activeConversationId, onConversationChange, onConversationsReload, onTitlePendingChange, onWorkspaceActivated } =
    props;
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [titlePending, setTitlePending] = useState(false);
  const [workspaceAction, setWorkspaceAction] = useState<"starting" | "stopping" | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const wasWorkspaceModeRef = useRef(false);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const activeAgentRunIdRef = useRef<string | null>(null);
  const suppressDraftClearRef = useRef(false);
  const [streamingTextStarted, setStreamingTextStarted] = useState(false);
  const [liveAssistantContent, setLiveAssistantContent] = useState("");
  const messages = useMemo(() => {
    return dedupeMessagesById(conversation?.messages ?? []);
  }, [conversation]);
  const liveAssistantMessage = useMemo(() => {
    if (!conversation || !liveAssistantContent) return null;
    const activeRun = conversation.activeAgentRun;
    return {
      id: activeRun ? `run-${activeRun.id}` : "streaming-assistant",
      conversationId: conversation.id,
      role: "ASSISTANT" as const,
      content: liveAssistantContent,
      createdAt: activeRun?.startedAt ?? new Date().toISOString(),
    };
  }, [conversation, liveAssistantContent]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const element = scrollAreaRef.current;
      if (!element) return;
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    });
  }

  function addOptimisticUserMessage(content: string) {
    const now = new Date().toISOString();
    const pendingConversationId = activeConversationId ?? "pending-conversation";

    setConversation((current) => {
      const baseConversation =
        current ??
        ({
          id: pendingConversationId,
          title: content.slice(0, 48) || "Nouvelle conversation",
          mode: "CLASSIC",
          createdAt: now,
          updatedAt: now,
          messages: [],
          toolEvents: [],
          workspaceSession: null,
          activeAgentRun: null,
        } satisfies ConversationDetail);

      return {
        ...baseConversation,
        updatedAt: now,
        messages: [
          ...baseConversation.messages,
          {
            id: `optimistic-${Date.now()}`,
            conversationId: baseConversation.id,
            role: "USER",
            content,
            createdAt: now,
          },
        ],
      };
    });
  }

  const loadConversation = useCallback(async (id: string | null) => {
    if (!id) {
      if (!suppressDraftClearRef.current) setConversation(null);
      return;
    }
    try {
      const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
      if (response.ok) {
        const loadedConversation = await response.json();
        setConversation(loadedConversation);
        if (loadedConversation.activeAgentRun) {
          activeAgentRunIdRef.current = loadedConversation.activeAgentRun.id;
          setLoading(true);
          setStreamingTextStarted(Boolean(loadedConversation.activeAgentRun.partialContent));
          setLiveAssistantContent(loadedConversation.activeAgentRun.partialContent ?? "");
        } else if (activeAgentRunIdRef.current) {
          activeAgentRunIdRef.current = null;
          setLoading(false);
          setStreamingTextStarted(false);
          setLiveAssistantContent("");
        }
        if (!isDefaultConversationTitle(loadedConversation.title)) {
          setTitlePending(false);
          onTitlePendingChange(null);
        }
      }
    } catch {
      // Polling and background refreshes are best-effort; transient browser/network failures should not crash dev.
    }
  }, [onTitlePendingChange]);

  useEffect(() => {
    if (activeConversationId) suppressDraftClearRef.current = false;
    const task = setTimeout(() => {
      void loadConversation(activeConversationId);
    }, 0);
    return () => clearTimeout(task);
  }, [activeConversationId, loadConversation]);

  useEffect(() => {
    if (conversation?.mode !== "WORKSPACE") return;
    if (!wasWorkspaceModeRef.current) onWorkspaceActivated();
    wasWorkspaceModeRef.current = true;
  }, [conversation?.mode, onWorkspaceActivated]);

  useEffect(() => {
    if (conversation?.mode !== "WORKSPACE") {
      wasWorkspaceModeRef.current = false;
      return;
    }

    const status = conversation.workspaceSession?.status;
    const intervalMs = status === "STARTING" ? 2000 : status === "RUNNING" ? 10000 : null;
    if (!intervalMs) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/workspace/status?conversationId=${conversation.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (data.conversation) setConversation(data.conversation);
      } catch {
        // The workspace stream/browser extensions can interrupt fetches transiently; retry on the next tick.
      }
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [conversation?.id, conversation?.mode, conversation?.workspaceSession?.status]);

  useEffect(() => {
    if (!loading) return;

    const interval = window.setInterval(async () => {
      try {
        if (activeConversationId) await loadConversation(activeConversationId);
        await onConversationsReload();
      } catch {
        // Best-effort refresh while the assistant is running.
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [activeConversationId, loadConversation, loading, onConversationsReload]);

  async function sendMessage(content: string) {
    if (!activeConversationId) suppressDraftClearRef.current = true;
    const shouldShowTitlePending =
      (!conversation || isDefaultConversationTitle(conversation.title)) &&
      !(conversation?.messages ?? []).some((message) => message.role === "USER");
    const pendingTitleId = conversation?.id ?? activeConversationId;

    if (shouldShowTitlePending) {
      setTitlePending(true);
      onTitlePendingChange(pendingTitleId ?? null);
    }

    addOptimisticUserMessage(content);
    scrollToBottom();
    setLoading(true);
    setStreamingTextStarted(false);
    setLiveAssistantContent("");
    streamingAssistantIdRef.current = null;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversationId, content }),
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error("Chat request failed");
      await readChatStream(response, {
        onStart: ({ conversationId, conversationTitle, userMessage, agentRun }) => {
          activeAgentRunIdRef.current = agentRun.id;
          onConversationChange(conversationId);
          void onConversationsReload();
          setConversation((current) => {
            const now = new Date().toISOString();
            const baseConversation =
              current ??
              ({
                id: conversationId,
                title: conversationTitle ?? (content.slice(0, 48) || "Nouvelle conversation"),
                mode: "CLASSIC",
                createdAt: now,
                updatedAt: now,
                messages: [],
                toolEvents: [],
                workspaceSession: null,
                activeAgentRun: null,
              } satisfies ConversationDetail);
            const messagesWithoutOptimisticUser = baseConversation.messages.filter(
              (message) =>
                message.id !== userMessage.id &&
                !(message.id.startsWith("optimistic-") && message.content === content),
            );

            return {
              ...baseConversation,
              id: conversationId,
              title: conversationTitle ?? baseConversation.title,
              messages: dedupeMessagesById([...messagesWithoutOptimisticUser, userMessage]),
            };
          });
          if (conversationTitle && !isDefaultConversationTitle(conversationTitle)) {
            setTitlePending(false);
            onTitlePendingChange(null);
          }
          scrollToBottom();
        },
        onTool: (event) => {
          setConversation((current) => {
            if (!current) return current;
            if (current.toolEvents.some((toolEvent) => toolEvent.id === event.id)) return current;
            return {
              ...current,
              toolEvents: [...current.toolEvents, event],
            };
          });
          scrollToBottom();
        },
        onDelta: (delta) => {
          setStreamingTextStarted(true);
          streamingAssistantIdRef.current = streamingAssistantIdRef.current ?? `streaming-${Date.now()}`;
          setLiveAssistantContent((current) => `${current}${delta}`);
          scrollToBottom();
        },
        onDone: (streamedConversation) => {
          setLiveAssistantContent("");
          setConversation(streamedConversation);
          if (!isDefaultConversationTitle(streamedConversation.title)) {
            setTitlePending(false);
            onTitlePendingChange(null);
          }
        },
        onError: (message) => {
          throw new Error(message);
        },
      });
      await onConversationsReload();
      scrollToBottom();
    } catch (error) {
      if (isAbortError(error)) {
        await loadConversation(activeConversationId);
        scrollToBottom();
        return;
      }
      const now = new Date().toISOString();
      setConversation((current) => {
        if (!current) return current;
        return {
          ...current,
          messages: [
            ...current.messages,
            {
              id: `error-${Date.now()}`,
              conversationId: current.id,
              role: "ASSISTANT",
              content: "Erreur pendant la generation de la reponse. Reessayez dans un instant.",
              createdAt: now,
            },
          ],
        };
      });
      setTitlePending(false);
      onTitlePendingChange(null);
      setLiveAssistantContent("");
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setStreamingTextStarted(false);
      setLiveAssistantContent("");
      streamingAssistantIdRef.current = null;
      activeAgentRunIdRef.current = null;
    }
  }

  async function stopGeneration() {
    const runId = activeAgentRunIdRef.current ?? conversation?.activeAgentRun?.id;
    if (runId) {
      await fetch("/api/agent-runs/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
    }
    const controller = abortControllerRef.current;
    if (controller && !controller.signal.aborted) {
      controller.abort(new DOMException("Generation stopped by user.", "AbortError"));
    }
  }

  async function startWorkspace() {
    if (!conversation) return;
    const now = new Date().toISOString();
    const previousConversation = conversation;

    setWorkspaceAction("starting");
    onWorkspaceActivated();
    setConversation({
      ...conversation,
      mode: "WORKSPACE",
      workspaceSession: {
        id: `starting-${conversation.id}`,
        status: "STARTING",
        provider: "docker-selkies",
        externalId: null,
        containerName: null,
        streamUrl: null,
        metadataJson: null,
        startedAt: null,
        stoppedAt: null,
        lastSeenAt: now,
        lastVisibleAt: now,
        lastActivityAt: now,
        shutdownReason: null,
      },
    });

    try {
      const response = await fetch("/api/workspace/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id }),
      });
      if (!response.ok) throw new Error("Workspace start failed");
      const data = await response.json();
      setConversation(data.conversation);
      await onConversationsReload();
    } catch {
      setConversation(previousConversation);
    } finally {
      setWorkspaceAction(null);
    }
  }

  async function stopWorkspace() {
    if (!conversation) return;
    const previousConversation = conversation;

    setWorkspaceAction("stopping");
    setConversation({
      ...conversation,
      mode: "CLASSIC",
      workspaceSession: conversation.workspaceSession
        ? { ...conversation.workspaceSession, status: "STOPPED", stoppedAt: new Date().toISOString() }
        : null,
    });

    try {
      const response = await fetch("/api/workspace/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id }),
      });
      if (!response.ok) throw new Error("Workspace stop failed");
      const data = await response.json();
      setConversation(data.conversation);
      await onConversationsReload();
    } catch {
      setConversation(previousConversation);
    } finally {
      setWorkspaceAction(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden bg-black">
      <WorkspacePanel conversation={conversation} />
      <main className="flex h-screen min-w-0 flex-1 overflow-hidden flex-col">
        <ConversationHeader
          conversation={conversation}
          onStartWorkspace={startWorkspace}
          onStopWorkspace={stopWorkspace}
          workspaceAction={workspaceAction}
          titlePending={titlePending}
        />
        <div ref={scrollAreaRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <MessageList
            messages={messages}
            toolEvents={conversation?.toolEvents ?? []}
            loading={loading && !streamingTextStarted}
            liveAssistantMessage={liveAssistantMessage}
          />
        </div>
        <ChatInput generating={loading} onStop={stopGeneration} onSubmit={sendMessage} />
      </main>
    </div>
  );
}

function isDefaultConversationTitle(title: string) {
  return DEFAULT_CONVERSATION_TITLES.has(title);
}

function dedupeMessagesById(messages: ConversationDetail["messages"]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

async function readChatStream(
  response: Response,
  handlers: {
    onStart: (event: Extract<ChatStreamEvent, { type: "start" }>) => void;
    onTool: (event: ChatToolEvent) => void;
    onDelta: (delta: string) => void;
    onDone: (conversation: ConversationDetail) => void;
    onError: (message: string) => void;
  },
) {
  if (!response.body) throw new Error("Chat stream is empty");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ChatStreamEvent;
      if (event.type === "start") handlers.onStart(event);
      if (event.type === "tool") handlers.onTool(event.event);
      if (event.type === "delta") handlers.onDelta(event.delta);
      if (event.type === "done") handlers.onDone(event.conversation);
      if (event.type === "error") handlers.onError(event.message);
    }
  }

  buffer += decoder.decode();
  if (!buffer.trim()) return;
  const event = JSON.parse(buffer) as ChatStreamEvent;
  if (event.type === "start") handlers.onStart(event);
  if (event.type === "tool") handlers.onTool(event.event);
  if (event.type === "delta") handlers.onDelta(event.delta);
  if (event.type === "done") handlers.onDone(event.conversation);
  if (event.type === "error") handlers.onError(event.message);
}
