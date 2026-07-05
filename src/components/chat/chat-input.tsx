"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Plus, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChatInputProps = {
  disabled?: boolean;
  generating?: boolean;
  onStop?: () => void;
  onSubmit: (content: string) => Promise<void>;
};

const MAX_TEXTAREA_HEIGHT = 96;

export function ChatInput({ disabled, generating, onStop, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [value]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = value.trim();
    if (!content || disabled || generating) return;
    setValue("");
    await onSubmit(content);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full min-w-0 max-w-4xl px-4 pb-3">
      <div className="flex min-h-14 min-w-0 items-end gap-2 rounded-3xl border border-zinc-700 bg-zinc-900 p-2.5 shadow-2xl">
        <Button type="button" variant="ghost" className="h-9 w-9 rounded-full px-0">
          <Plus size={18} />
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Poser une question"
          rows={1}
          className="min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-base leading-6 text-white outline-none placeholder:text-zinc-500"
          disabled={disabled && !generating}
        />
        {generating ? (
          <Button
            type="button"
            variant="primary"
            className="h-9 w-9 rounded-full px-0"
            onClick={onStop}
            aria-label="Arreter la generation"
          >
            <Square size={14} fill="currentColor" />
          </Button>
        ) : (
          <Button type="submit" variant="primary" className="h-9 w-9 rounded-full px-0" disabled={disabled || generating}>
            <ArrowUp size={17} />
          </Button>
        )}
      </div>
    </form>
  );
}
