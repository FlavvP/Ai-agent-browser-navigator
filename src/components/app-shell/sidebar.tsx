"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LogOut, MessageSquarePlus, MoreHorizontal, Pencil, Search, Trash2, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { SidebarToggle } from "@/components/app-shell/sidebar-toggle";
import { cn } from "@/lib/utils/cn";
import type { ConversationSummary } from "@/types/chat";

type SidebarProps = {
  collapsed: boolean;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  pendingTitleConversationId: string | null;
  onNewConversation: () => void;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onSelectConversation: (id: string) => void;
  onToggle: () => void;
};

export function Sidebar(props: SidebarProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setOpenMenuId(null);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  function openRename(conversation: ConversationSummary) {
    setOpenMenuId(null);
    setRenaming(conversation);
    setRenameTitle(conversation.title);
  }

  async function submitRename() {
    if (!renaming) return;
    const title = renameTitle.trim();
    if (!title) return;
    setBusy(true);
    try {
      await props.onRenameConversation(renaming.id, title);
      setRenaming(null);
    } finally {
      setBusy(false);
    }
  }

  async function submitDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await props.onDeleteConversation(deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (props.collapsed) {
    return (
      <aside className="flex h-screen w-16 shrink-0 flex-col items-center border-r border-zinc-800 bg-black px-2 py-3 text-zinc-100">
        <div className="mb-4 flex h-9 w-full items-center justify-center">
          <SidebarToggle collapsed={props.collapsed} onToggle={props.onToggle} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-10 px-0"
            onClick={props.onNewConversation}
            aria-label="Nouveau chat"
            title="Nouveau chat"
          >
            <MessageSquarePlus size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-10 px-0"
            disabled
            aria-label="Rechercher"
            title="Rechercher"
          >
            <Search size={18} />
          </Button>
        </div>
        <div className="flex-1" />
        <Button
          type="button"
          className="h-10 w-10 px-0"
          variant="ghost"
          onClick={() => signOut()}
          aria-label="Se deconnecter"
          title="Se deconnecter"
        >
          <LogOut size={18} />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-r border-zinc-800 bg-black p-3 text-zinc-100">
      <div className="mb-4 flex h-9 items-center justify-between px-2">
        <div className="text-xl font-semibold">Agent</div>
        <SidebarToggle collapsed={props.collapsed} onToggle={props.onToggle} />
      </div>
      <div className="space-y-1">
        <Button className="w-full justify-start" variant="ghost" onClick={props.onNewConversation}>
          <MessageSquarePlus size={18} />
          Nouveau chat
        </Button>
        <Button className="w-full justify-start" variant="ghost" disabled>
          <Search size={18} />
          Rechercher
        </Button>
      </div>
      <div className="mt-6 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recents</div>
      <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
        {props.conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              "group relative flex min-w-0 items-center rounded-lg text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white",
              props.activeConversationId === conversation.id && "bg-zinc-800 text-white",
            )}
          >
            <button
              type="button"
              onClick={() => props.onSelectConversation(conversation.id)}
              className="min-w-0 flex-1 truncate px-3 py-2 pr-10 text-left"
            >
              {props.pendingTitleConversationId === conversation.id ? <TitleDots /> : conversation.title}
            </button>
            <button
              type="button"
              aria-label="Options conversation"
              title="Options"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.nativeEvent.stopImmediatePropagation();
                setOpenMenuId((current) => current === conversation.id ? null : conversation.id);
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className={cn(
                "absolute right-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-700 hover:text-white group-hover:flex",
                openMenuId === conversation.id && "flex",
              )}
            >
              <MoreHorizontal size={16} />
            </button>
            {openMenuId === conversation.id ? (
              <div
                ref={menuRef}
                className="absolute right-1 top-9 z-20 w-44 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => openRename(conversation)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  <Pencil size={15} />
                  Renommer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    setDeleting(conversation);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-red-950/40"
                >
                  <Trash2 size={15} />
                  Supprimer
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <Button className="mt-3 w-full justify-start" variant="ghost" onClick={() => signOut()}>
        <LogOut size={18} />
        Se deconnecter
      </Button>

      {renaming ? (
        <Dialog title="Renommer la conversation" onClose={() => setRenaming(null)}>
          <input
            autoFocus
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitRename();
              if (event.key === "Escape") setRenaming(null);
            }}
            className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-400"
            maxLength={120}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenaming(null)} disabled={busy}>
              Annuler
            </Button>
            <Button type="button" onClick={submitRename} disabled={busy || !renameTitle.trim()}>
              Renommer
            </Button>
          </div>
        </Dialog>
      ) : null}

      {deleting ? (
        <Dialog title="Supprimer la conversation" onClose={() => setDeleting(null)}>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Cette action supprime la conversation et ses messages. Elle ne peut pas etre annulee.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={submitDelete}
              disabled={busy}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Supprimer
            </Button>
          </div>
        </Dialog>
      ) : null}
    </aside>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
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
