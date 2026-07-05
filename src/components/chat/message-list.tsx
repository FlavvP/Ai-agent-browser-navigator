import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Camera,
  FileText,
  Keyboard,
  MousePointerClick,
  PenLine,
  Power,
  Search,
  Square,
  TerminalSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChatMessage, ChatToolEvent } from "@/types/chat";
import { MessageBubble } from "@/components/chat/message-bubble";

type MessageListProps = {
  messages: ChatMessage[];
  toolEvents: ChatToolEvent[];
  loading: boolean;
  liveAssistantMessage: ChatMessage | null;
};

type TimelineItem =
  | { type: "message"; id: string; createdAt: string; message: ChatMessage }
  | { type: "tool"; id: string; createdAt: string; event: ChatToolEvent };

export function MessageList({ messages, toolEvents, loading, liveAssistantMessage }: MessageListProps) {
  if (messages.length === 0 && toolEvents.length === 0 && !loading && !liveAssistantMessage) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <h1 className="text-3xl font-semibold text-white">Comment puis-je aider ?</h1>
          <p className="mt-3 text-sm text-zinc-500">
            Chat classique maintenant, workspace agentique mocke pour preparer la suite.
          </p>
        </div>
      </div>
    );
  }

  const timeline = buildTimeline(messages, toolEvents);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-3 overflow-x-hidden px-5 py-5">
      {timeline.map((item) => (
        item.type === "message" ? (
          <MessageBubble key={`message-${item.id}`} message={item.message} />
        ) : (
          <ToolEventLine key={`tool-${item.id}`} event={item.event} />
        )
      ))}
      {loading ? <TypingIndicator /> : null}
      {liveAssistantMessage ? <MessageBubble key={`live-${liveAssistantMessage.id}`} message={liveAssistantMessage} /> : null}
    </div>
  );
}

function buildTimeline(messages: ChatMessage[], toolEvents: ChatToolEvent[]) {
  const items: TimelineItem[] = [
    ...messages.map((message) => ({
      type: "message" as const,
      id: message.id,
      createdAt: message.createdAt,
      message,
    })),
    ...toolEvents.map((event) => ({
      type: "tool" as const,
      id: event.id,
      createdAt: event.createdAt,
      event,
    })),
  ];

  return items.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function ToolEventLine({ event }: { event: ChatToolEvent }) {
  const input = parseJson(event.inputJson);
  const output = parseJson(event.outputJson);
  const display = formatToolEvent(event, input, output);
  const Icon = event.status === "ERROR" ? AlertCircle : display.icon;

  return (
    <div className="flex min-w-0 justify-start">
      <div className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{display.label}</span>
        <span className={event.status === "SUCCESS" ? "text-emerald-400" : "text-red-400"}>
          {event.status === "SUCCESS" ? "succes" : "erreur"}
        </span>
      </div>
    </div>
  );
}

function formatToolEvent(
  event: ChatToolEvent,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
): { label: string; icon: LucideIcon } {
  switch (event.toolName) {
    case "web_search":
      return { icon: Search, label: withDetail("Recherche web", input.query) };
    case "read_url":
      return { icon: FileText, label: withDetail("Lecture", input.url) };
    case "enter_workspace_mode":
      return { icon: TerminalSquare, label: "Activation du mode workspace" };
    case "start_workspace_browser":
      return { icon: Power, label: withDetail("Ouverture du navigateur workspace", input.url ?? output.streamUrl) };
    case "stop_workspace_browser":
      return { icon: Square, label: "Fermeture du navigateur workspace" };
    case "workspace_snapshot":
      return { icon: Camera, label: snapshotLabel(output) };
    case "workspace_click":
      return { icon: MousePointerClick, label: withDetail("Clic sur un element", input.ref) };
    case "workspace_fill":
      return { icon: PenLine, label: fillLabel(input) };
    case "workspace_press":
      return { icon: Keyboard, label: withDetail("Touche", input.keys) };
    case "workspace_scroll":
      return { icon: scrollIcon(input), label: scrollLabel(input) };
    default:
      return { icon: FileText, label: event.toolName };
  }
}

function withDetail(label: string, value: unknown) {
  const detail = formatShortValue(value);
  return detail ? `${label} : ${detail}` : label;
}

function snapshotLabel(output: Record<string, unknown>) {
  const result = output.tool_result && typeof output.tool_result === "object"
    ? output.tool_result as Record<string, unknown>
    : output;
  const refs = typeof result.ref_count === "number" ? result.ref_count : undefined;
  const refsList = Array.isArray(result.refs) ? result.refs.length : undefined;
  const elements = typeof result.elements === "number"
    ? result.elements
    : Array.isArray(result.elements)
      ? result.elements.length
      : undefined;
  const snapshotId = formatShortValue(result.snapshot_id);
  if (refs !== undefined && snapshotId) return `Lecture de la page : ${refs} refs (${snapshotId})`;
  if (refs !== undefined) return `Lecture de la page : ${refs} refs`;
  if (refsList !== undefined && snapshotId) return `Lecture de la page : ${refsList} refs (${snapshotId})`;
  if (refsList !== undefined) return `Lecture de la page : ${refsList} refs`;
  if (elements !== undefined && snapshotId) return `Lecture de la page : ${elements} elements (${snapshotId})`;
  if (elements !== undefined) return `Lecture de la page : ${elements} elements`;
  return "Lecture de la page";
}

function fillLabel(input: Record<string, unknown>) {
  const text = formatShortValue(input.text, 42);
  const ref = formatShortValue(input.ref);
  if (text && ref) return `Saisie de texte : ${text} (${ref})`;
  if (text) return `Saisie de texte : ${text}`;
  return "Saisie de texte";
}

function scrollLabel(input: Record<string, unknown>) {
  const direction = String(input.direction ?? "").toLowerCase();
  const amount = formatShortValue(input.amount);
  const directionLabel = direction === "up" ? "vers le haut" : direction === "down" ? "vers le bas" : "";
  return amount ? `Defilement ${directionLabel} : ${amount}` : `Defilement ${directionLabel}`.trim();
}

function scrollIcon(input: Record<string, unknown>) {
  return String(input.direction ?? "").toLowerCase() === "up" ? ArrowUp : ArrowDown;
}

function formatShortValue(value: unknown, maxLength = 80) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function parseJson(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function TypingIndicator() {
  return (
    <div className="flex min-w-0 justify-start">
      <div
        className="flex items-center gap-1 rounded-2xl bg-zinc-900 px-4 py-3"
        aria-label="L'assistant prepare sa reponse"
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-2 w-2 animate-bounce rounded-full bg-zinc-400"
            style={{ animationDelay: `${dot * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
