"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Copy, Loader2, Play, ScanSearch, Square } from "lucide-react";

type DebugStatus = "idle" | "starting" | "running" | "stopping" | "failed" | "stopped";

type StartResponse = {
  ok: boolean;
  conversationId?: string;
  status?: string;
  streamUrl?: string | null;
  note?: string;
  error?: string;
};

type CaptureResponse = {
  ok: boolean;
  conversationId?: string;
  rawSnapshot?: unknown;
  accerciserSnapshot?: unknown;
  llmPayload?: unknown;
  error?: string;
};

export function WorkspaceSnapshotDebugClient() {
  const [status, setStatus] = useState<DebugStatus>("idle");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [rawSnapshot, setRawSnapshot] = useState<unknown>(null);
  const [accerciserSnapshot, setAccerciserSnapshot] = useState<unknown>(null);
  const [llmPayload, setLlmPayload] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const canStart = status === "idle" || status === "failed" || status === "stopped";
  const canStop = status === "running";
  const canCapture = status === "running";

  async function startWorkspace() {
    if (!canStart || startingRef.current || stoppingRef.current) return;
    startingRef.current = true;
    setError(null);
    setStatus("starting");
    try {
      const response = await fetch("/api/debug/workspace-snapshot/start", { method: "POST" });
      const data = (await response.json()) as StartResponse;
      if (!response.ok || !data.ok) {
        setStatus("failed");
        setError(data.error ?? data.note ?? "Impossible de lancer le workspace debug.");
        return;
      }
      setStreamUrl(data.streamUrl ?? null);
      setStatus("running");
    } catch {
      setStatus("failed");
      setError("Impossible de lancer le workspace debug.");
    } finally {
      startingRef.current = false;
    }
  }

  async function stopWorkspace() {
    if (!canStop || startingRef.current || stoppingRef.current) return;
    stoppingRef.current = true;
    setError(null);
    setStopping(true);
    setStatus("stopping");
    setStreamUrl(null);
    try {
      const response = await fetch("/api/debug/workspace-snapshot/stop", { method: "POST" });
      const data = (await response.json()) as StartResponse;
      if (!response.ok || !data.ok) {
        setStatus("failed");
        setError(data.error ?? "Impossible d'arreter le workspace debug.");
        return;
      }
      setStatus("stopped");
    } catch {
      setStatus("failed");
      setError("Impossible d'arreter le workspace debug.");
    } finally {
      stoppingRef.current = false;
      setStopping(false);
    }
  }

  async function captureSnapshot() {
    setError(null);
    setCapturing(true);
    try {
      const response = await fetch("/api/debug/workspace-snapshot/capture", { method: "POST" });
      const data = (await response.json()) as CaptureResponse;
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Impossible de capturer le snapshot.");
        return;
      }
      setRawSnapshot(data.rawSnapshot ?? null);
      setAccerciserSnapshot(data.accerciserSnapshot ?? null);
      setLlmPayload(data.llmPayload ?? null);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <main className="flex h-screen min-w-0 flex-col overflow-hidden bg-black text-zinc-100">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-900 px-5 py-3">
        <div>
          <h1 className="text-base font-semibold">Debug snapshot workspace</h1>
          <p className="text-xs text-zinc-500">Compare l&apos;ecran visible, le snapshot AT-SPI2 brut et le payload LLM.</p>
        </div>
        <StatusBadge status={status} />
      </header>

      {error ? (
        <div className="border-b border-red-950 bg-red-950/30 px-5 py-2 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="grid min-h-0 flex-1 grid-cols-4 gap-3 p-3">
        <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          <PanelHeader title="Workspace visible">
            <button
              type="button"
              onClick={startWorkspace}
              disabled={!canStart}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
            >
              {status === "starting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Lancer
            </button>
            <button
              type="button"
              onClick={stopWorkspace}
              disabled={!canStop || stopping}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
            >
              {stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              {stopping ? "Arret..." : "Arreter"}
            </button>
            <button
              type="button"
              onClick={captureSnapshot}
              disabled={capturing || stopping || !canCapture}
              className="inline-flex items-center gap-1 rounded-md border border-blue-500/60 px-2 py-1 text-xs text-blue-100 hover:bg-blue-950/40 disabled:opacity-50"
            >
              {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
              Snapshot
            </button>
          </PanelHeader>

          <div className="min-h-0 flex-1 bg-black">
            {streamUrl ? (
              <iframe
                src={streamUrl}
                title="Workspace debug"
                className="h-full w-full border-0"
                allow="autoplay; microphone; camera; clipboard-read; clipboard-write; fullscreen"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-8 text-center text-sm text-zinc-500">
                Lance le workspace, navigue manuellement dans Chromium, puis capture un snapshot.
              </div>
            )}
          </div>
        </div>

        <JsonPanel title="Snapshot brut Linux" value={rawSnapshot} empty="Aucun snapshot brut capture." />
        <JsonPanel title="Vue Accerciser" value={accerciserSnapshot} empty="Aucune vue Accerciser capturee." />
        <JsonPanel title="Payload envoye au LLM" value={llmPayload} empty="Aucun payload LLM capture." />
      </section>
    </main>
  );
}

function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2">
      <h2 className="truncate text-sm font-medium">{title}</h2>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

function JsonPanel({ title, value, empty }: { title: string; value: unknown; empty: string }) {
  const [copied, setCopied] = useState(false);
  const text = value ? JSON.stringify(value, null, 2) : "";
  const CopyIcon = copied ? Check : Copy;

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copy() {
    if (!text) return;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        copyWithTextarea(text);
      }
      setCopied(true);
    } catch {
      copyWithTextarea(text);
      setCopied(true);
    }
  }

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <PanelHeader title={title}>
        <button
          type="button"
          onClick={copy}
          disabled={!text}
          aria-label={copied ? "JSON copie" : "Copier le JSON"}
          title={copied ? "JSON copie" : "Copier le JSON"}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition disabled:opacity-50 ${
            copied
              ? "border-emerald-700 bg-emerald-950/30 text-emerald-300"
              : "border-zinc-700 text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <CopyIcon className="h-3.5 w-3.5" />
          {copied ? "Copie" : "Copier"}
        </button>
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {text ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">{text}</pre>
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-zinc-500">{empty}</div>
        )}
      </div>
    </div>
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

function StatusBadge({ status }: { status: DebugStatus }) {
  const label = status.toUpperCase();
  const color =
    status === "running"
      ? "border-emerald-700 text-emerald-300"
      : status === "stopping" || status === "starting"
        ? "border-blue-800 text-blue-300"
        : status === "failed"
          ? "border-red-800 text-red-300"
          : "border-zinc-700 text-zinc-300";
  return <span className={`rounded-full border px-3 py-1 text-xs ${color}`}>{label}</span>;
}
