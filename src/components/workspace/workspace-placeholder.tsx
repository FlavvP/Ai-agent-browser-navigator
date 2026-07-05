import { Loader2, TerminalSquare } from "lucide-react";

type WorkspacePlaceholderProps = {
  status?: string;
};

export function WorkspacePlaceholder({ status }: WorkspacePlaceholderProps) {
  const isStarting = status === "STARTING";
  const isFailed = status === "FAILED";
  const isIdle = status === "WORKSPACE_MODE" || status === "STOPPED" || !status;

  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 p-8 text-center">
      <div className="max-w-md">
        {isStarting ? (
          <Loader2 className="mx-auto mb-5 animate-spin text-sky-300" size={44} />
        ) : (
          <TerminalSquare className="mx-auto mb-5 text-zinc-500" size={44} />
        )}
        <h2 className="text-xl font-semibold text-white">
          {isStarting ? "Workspace en preparation" : isFailed ? "Workspace indisponible" : "Workspace en attente"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          {isStarting
            ? "Le container Linux demarre et la connexion Selkies se stabilise. Le stream apparaitra automatiquement."
            : isFailed
              ? "Le lancement Docker/Selkies a echoue. Consultez les logs serveur ou changez l'image workspace si necessaire."
              : isIdle
                ? status === "STOPPED"
                  ? "Le workspace est arrete. Relancez-le pour restaurer le navigateur de cette conversation."
                  : "Mode workspace actif. Le navigateur n'est pas demarre. L'agent peut lancer Chromium avec start_workspace_browser."
                : "Ce panneau affichera le stream du workspace Linux lorsque le navigateur sera actif."}
        </p>
      </div>
    </div>
  );
}
