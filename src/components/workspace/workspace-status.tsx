type WorkspaceStatusProps = {
  status?: string;
};

export function WorkspaceStatus({ status = "MOCK" }: WorkspaceStatusProps) {
  const styles =
    status === "RUNNING"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : status === "STARTING"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
        : status === "FAILED"
          ? "border-red-500/30 bg-red-500/10 text-red-200"
          : "border-zinc-700 bg-zinc-900 text-zinc-300";
  const dot =
    status === "RUNNING"
      ? "bg-emerald-400"
      : status === "STARTING"
        ? "bg-sky-400"
        : status === "FAILED"
          ? "bg-red-400"
          : "bg-zinc-500";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${styles}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {status}
    </div>
  );
}
