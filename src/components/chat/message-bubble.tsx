"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/cn";
import type { ChatMessage } from "@/types/chat";

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "USER";
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyMessage() {
    if (!message.content) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(message.content);
      } else {
        copyWithTextarea(message.content);
      }
      setCopied(true);
    } catch {
      copyWithTextarea(message.content);
      setCopied(true);
    }
  }

  return (
    <div className={cn("group flex w-full min-w-0", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex max-w-[min(48rem,85%)] min-w-0 flex-col text-[15px] leading-6",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "min-w-0 break-words",
            isUser ? "rounded-2xl bg-zinc-800 px-4 py-3 text-white" : "text-zinc-100",
          )}
        >
          {isUser ? <span className="whitespace-pre-wrap">{message.content}</span> : <MarkdownContent content={message.content} />}
        </div>
        {isUser ? (
          <CopyButton
            copied={copied}
            className="mt-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={copyMessage}
          />
        ) : null}
        {!isUser ? (
          <CopyButton copied={copied} className="mt-1" onClick={copyMessage} />
        ) : null}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: (props) => {
          const { href, children, ...rest } = omitMarkdownNode(props);
          return (
            <a
              {...rest}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 underline decoration-sky-300/40 underline-offset-4 transition hover:text-sky-200 hover:decoration-sky-200"
            >
              {children}
            </a>
          );
        },
        p: (props) => <p {...omitMarkdownNode(props)} className="mb-2.5 last:mb-0" />,
        ul: (props) => <ul {...omitMarkdownNode(props)} className="mb-2.5 ml-5 list-disc space-y-0.5 last:mb-0" />,
        ol: (props) => <ol {...omitMarkdownNode(props)} className="mb-2.5 ml-5 list-decimal space-y-0.5 last:mb-0" />,
        li: (props) => <li {...omitMarkdownNode(props)} className="pl-1" />,
        h1: (props) => <h1 {...omitMarkdownNode(props)} className="mb-2 text-xl font-semibold leading-7 text-white" />,
        h2: (props) => <h2 {...omitMarkdownNode(props)} className="mb-2 text-lg font-semibold leading-7 text-white" />,
        h3: (props) => <h3 {...omitMarkdownNode(props)} className="mb-1.5 text-base font-semibold leading-6 text-white" />,
        h4: (props) => (
          <h4 {...omitMarkdownNode(props)} className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-zinc-200" />
        ),
        blockquote: (props) => (
          <blockquote
            {...omitMarkdownNode(props)}
            className="mb-2.5 border-l-2 border-zinc-700 pl-3 text-zinc-300 last:mb-0"
          />
        ),
        code: (props) => (
          <code {...omitMarkdownNode(props)} className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-100" />
        ),
        pre: (props) => (
          <pre
            {...omitMarkdownNode(props)}
            className="mb-2.5 max-w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm leading-6 text-zinc-100 last:mb-0"
          />
        ),
        table: (props) => (
          <div className="mb-2.5 max-w-full overflow-x-auto last:mb-0">
            <table {...omitMarkdownNode(props)} className="min-w-full border-collapse text-sm" />
          </div>
        ),
        th: (props) => (
          <th
            {...omitMarkdownNode(props)}
            className="border border-zinc-800 bg-zinc-900 px-3 py-2 text-left font-semibold text-zinc-100"
          />
        ),
        td: (props) => <td {...omitMarkdownNode(props)} className="border border-zinc-800 px-3 py-2 text-zinc-200" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function omitMarkdownNode<T extends { node?: unknown }>(props: T) {
  const { node, ...rest } = props;
  void node;
  return rest;
}

function CopyButton({
  copied,
  className,
  onClick,
}: {
  copied: boolean;
  className?: string;
  onClick: () => void;
}) {
  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      aria-label={copied ? "Message copie" : "Copier le message"}
      title={copied ? "Message copie" : "Copier le message"}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-700/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500",
        copied && "text-emerald-400 hover:text-emerald-300",
        className,
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function copyWithTextarea(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
