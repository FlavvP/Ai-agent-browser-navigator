# Agent Browser Navigator

Agent Browser Navigator est une application web de chat IA dont l'objectif est de piloter un agent capable de naviguer sur Internet d'une manière proche d'un utilisateur humain. L'agent peut ouvrir des pages, cliquer, remplir des champs, faire défiler une page, lire l'état courant de l'écran et enchaîner des actions dans une interface visible par l'utilisateur.

Le projet ne s'appuie pas sur une simple API navigateur invisible. Il démarre un workspace Linux distant, affiche ce workspace dans l'interface web, lance Chromium dans cette machine, lit l'interface via l'accessibilité Linux, puis exécute les clics, les frappes au clavier et les scrolls via l'OS. Le but est d'obtenir un comportement plus naturel et plus proche d'une vraie session utilisateur qu'une automatisation DOM classique.

Le workspace est une interface partagée entre l'humain et l'agent IA. Quand le mode workspace est activé, l'utilisateur voit la même machine, le même navigateur et la même session que l'agent. Il peut reprendre la main, cliquer, taper, se connecter, valider une action sensible ou résoudre une étape manuelle, puis laisser l'agent continuer depuis exactement le même état.

L'application propose deux modes :

- chat classique avec historique persistant ;
- workspace agentique Docker/Selkies en split-screen, avec navigateur visible et actions automatisées via l'OS.

## Démarrage

Démarrer PostgreSQL local :

```powershell
docker compose up -d
```

Installer les dépendances et préparer la base :

Node.js >= 20.19 et pnpm 11.15.1 sont requis. Avec Corepack disponible, executer `corepack enable` ; le champ `packageManager` fixe la version du projet.

```powershell
pnpm install --frozen-lockfile
pnpm run db:migrate
pnpm run db:generate
pnpm run dev
```

L'application est disponible sur `http://localhost:3000`.

Le verrou de dependances est `pnpm-lock.yaml`. `pnpm-workspace.yaml` conserve une disposition `node_modules` plate pour la resolution du client Prisma 5 sous Windows et autorise explicitement les scripts des dependances necessaires. Le script `postinstall` genere le client Prisma ; `pnpm run db:generate` permet de le regenerer apres un changement de schema.

## Variables d'environnement

Copier `.env.example` vers `.env`.

```powershell
DATABASE_URL="postgresql://agent:agent_password@localhost:5432/agent_browser_navigator?schema=public"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
OPENAI_TITLE_MODEL="gpt-4.1-nano"
OPENAI_TOOL_RUN_TIMEOUT_MS="180000"
SERPER_API_KEY=""
WEB_FETCH_TIMEOUT_MS="10000"
WEB_FETCH_MAX_CHARS="20000"
AUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
WORKSPACE_PROVIDER="docker-selkies"
WORKSPACE_IMAGE="agent-browser-workspace:local"
WORKSPACE_PUBLIC_HOST="localhost"
WORKSPACE_PORT_START="6100"
WORKSPACE_PORT_END="6199"
WORKSPACE_CONTAINER_PORT="3000"
WORKSPACE_AUTOMATION_PORT="6200"
WORKSPACE_AUTOMATION_CONTAINER_PORT="8765"
WORKSPACE_PROFILE_MOUNT="/config"
WORKSPACE_USER_PROFILE_MOUNT="/profiles/user"
WORKSPACE_IDLE_TIMEOUT_MINUTES="30"
WORKSPACE_IDLE_SWEEP_INTERVAL_MS="60000"
WORKSPACE_READY_DELAY_MS="3000"
WORKSPACE_DEFAULT_URL="https://www.google.com"
WORKSPACE_BROWSER_MODE="maximized"
WORKSPACE_BROWSER_WATCHDOG_ENABLED="true"
WORKSPACE_BROWSER_WATCHDOG_INTERVAL_MS="2000"
WORKSPACE_SCREEN_WIDTH="1366"
WORKSPACE_SCREEN_HEIGHT="768"
WORKSPACE_SCREEN_DPI="96"
LOG_ENABLED="false"
LOG_DIR="./logs"
LOG_LEVEL="info"
LOG_PRETTY="true"
LOG_REDACT_SECRETS="true"
LOG_MAX_INLINE_CHARS="20000"
LOG_ALL="false"
LOG_AGENT="true"
LOG_OPENAI="false"
LOG_TOOLS="true"
LOG_WORKSPACE="true"
LOG_AUTOMATION="true"
LOG_BROWSER="true"
LOG_SNAPSHOTS="true"
LOG_RAW_SNAPSHOTS="false"
LOG_COMPACT_SNAPSHOTS="true"
```

`AUTH_SECRET` doit être une valeur longue et aléatoire.

## Authentification

L'authentification utilise Auth.js / NextAuth avec deux modes :

- Google OAuth avec `AUTH_GOOGLE_ID` et `AUTH_GOOGLE_SECRET` ;
- email/password avec hash bcrypt côté serveur.

Si les variables Google sont vides, la connexion email/password reste disponible.

## Titres de conversations

Au premier message utilisateur d'une nouvelle conversation, le backend génère un titre court via OpenAI.

- `OPENAI_TITLE_MODEL` contrôle le modèle utilisé pour ce titrage.
- Le prompt demande un titre de 5 mots maximum, dans la langue du message si possible, sans abréviation ni faute volontaire.
- Le résultat est nettoyé côté backend et limité à 5 mots, même si le modèle dépasse.
- Si `OPENAI_API_KEY` est absente ou si l'appel échoue, un fallback local utilise les premiers mots du message.
- Les conversations déjà titrées ne sont pas renommées automatiquement.
- Pendant le titrage, l'interface affiche trois points dans le header et dans la sidebar, puis remplace ce placeholder dès que le titre serveur est disponible.

## Outils web

En mode classique, l'agent dispose de trois outils :

- `web_search` : recherche web via Serper.dev, activée avec `SERPER_API_KEY` ;
- `read_url` : lecture de pages publiques simples via extraction HTML côté serveur ;
- `enter_workspace_mode` : passage en mode agentique avancé, sans démarrer le navigateur.

Chaque résultat d'outil renvoyé au modèle est enveloppé ainsi :

```json
{
  "agent_instruction": "Instruction backend indiquant quoi faire ensuite.",
  "tool_result": {}
}
```

## Workspace Docker/Selkies

Le workspace lance un container Linux par session et affiche son stream dans le panneau gauche via Selkies/WebRTC.

- `WORKSPACE_IMAGE` rend l'image interchangeable sans modifier le code.
- `WORKSPACE_CONTAINER_PORT` est le port HTTP exposé par l'image Selkies dans le container. Pour `ghcr.io/linuxserver/baseimage-selkies:debiantrixie`, utiliser `3000`, pas `3001` qui correspond au websocket interne.
- `WORKSPACE_AUTOMATION_PORT` est le premier port local réservé au service automation.
- `WORKSPACE_AUTOMATION_CONTAINER_PORT` est le port HTTP du service automation dans le container.
- `WORKSPACE_READY_DELAY_MS` ajoute une courte stabilisation après la disponibilité HTTP pour laisser la couche Selkies/WebSocket se connecter avant l'affichage de l'iframe.
- `WORKSPACE_DEFAULT_URL` est l'URL ouverte dans Chromium si aucun site précis n'est fourni.
- `WORKSPACE_PORT_START` / `WORKSPACE_PORT_END` définissent la plage de ports locaux réservés aux streams.
- `WORKSPACE_PROFILE_MOUNT` est le chemin du profil Chromium propre à la conversation.
- `WORKSPACE_USER_PROFILE_MOUNT` est le chemin du profil utilisateur partagé, utilisé pour synchroniser cookies et connexions entre conversations.
- `WORKSPACE_IDLE_TIMEOUT_MINUTES` arrête un workspace non visible et sans activité récente après ce délai. `0` désactive le timeout.
- `WORKSPACE_IDLE_SWEEP_INTERVAL_MS` contrôle la fréquence de nettoyage des workspaces idle.
- `WORKSPACE_BROWSER_MODE` contrôle l'affichage Chromium : `maximized` par défaut, `app` ou `normal` pour le debug.
- `WORKSPACE_BROWSER_WATCHDOG_ENABLED` relance Chromium si l'utilisateur ferme la fenêtre et réactive ou remaximise la fenêtre si elle est minimisée ou restaurée.
- `WORKSPACE_BROWSER_WATCHDOG_INTERVAL_MS` définit la fréquence de vérification du watchdog navigateur.
- `WORKSPACE_SCREEN_WIDTH`, `WORKSPACE_SCREEN_HEIGHT` et `WORKSPACE_SCREEN_DPI` verrouillent la résolution Selkies. Par défaut, le workspace utilise `1366x768` à `96 DPI`.
- Un volume Docker `workspace-profile-{userId}` conserve l'identité web partagée entre conversations.
- Un volume Docker `workspace-conversation-{conversationId}` conserve les onglets et l'état Chromium de la conversation.
- Le container est supprimé à l'arrêt, mais les volumes profils restent.

Politique de session workspace :

- plusieurs conversations peuvent avoir un workspace actif en même temps ;
- changer de conversation ne stoppe pas le workspace précédent ;
- fermer l'onglet local de l'application ne stoppe pas immédiatement le workspace ;
- le workspace est arrêté uniquement par action explicite ou par idle timeout ;
- l'idle timeout ne se déclenche que si le workspace n'est plus visible et qu'aucune activité workspace récente n'a été observée ;
- les actions `workspace_snapshot`, `workspace_click`, `workspace_fill`, `workspace_press`, `workspace_scroll` et `start_workspace_browser` mettent à jour l'activité ;
- Chromium est fermé proprement via le service automation avant suppression du container pour sauvegarder la session.

Les générations agent sont détachées du stream HTTP client via `AgentRun`. Si l'utilisateur ferme l'onglet local, le run continue côté serveur tant que le process Next.js reste vivant. Le bouton stop annule le run côté serveur. En cas de redémarrage du serveur, les runs actifs précédents sont considérés comme interrompus.

Le projet ne stocke pas les identifiants ou mots de passe de sites tiers. Les cookies et sessions web peuvent toutefois vivre dans le volume profil Docker ; ce volume doit donc être traité comme une donnée sensible.

Le mode `maximized` conserve les onglets et la barre d'adresse. Les contrôles de fenêtre Linux restent visibles si le window manager les affiche, mais le watchdog neutralise leurs effets : fermeture -> relance Chromium, minimisation -> réactivation, restauration en petite fenêtre -> remaximisation. Ce n'est pas une barrière de sécurité forte contre un utilisateur déterminé ; l'isolation de sécurité reste assurée par le container workspace.

Quand une conversation passe en mode workspace, l'interface replie automatiquement la sidebar des conversations pour laisser plus de largeur au stream.

Chromium est uniformisé autour de Google :

- `WORKSPACE_DEFAULT_URL` vaut `https://www.google.com` par défaut ;
- le profil Chromium force le bouton home et la page de démarrage vers cette URL ;
- une extension locale `Agent Workspace New Tab` remplace la page nouvel onglet Debian/Chromium par Google ;
- Chromium est lancé en français (`--lang=fr-FR`) et le profil force `fr-FR,fr,en-US,en` comme langues acceptées ;
- la traduction automatique Chromium est désactivée pour éviter le popup de traduction ;
- les favoris Debian par défaut sont remplacés par un favori Google minimal.

Commandes utiles :

```powershell
docker ps --filter "label=app=agent-browser-navigator"
docker rm -f <container>
docker volume ls --filter "name=workspace-profile"
```

Limites actuelles : le stream local n'est pas encore sécurisé par reverse proxy, le terminal agentique n'est pas encore exposé comme outil, et l'image workspace peut devoir être adaptée selon le comportement exact de l'image Selkies retenue.

## Image workspace

Le workspace utilise une image locale custom avec Chromium, AT-SPI2, `xdotool` et un service Python automation.

```powershell
docker build -t agent-browser-workspace:local ./workspace
```

Le service automation expose :

```text
GET  /health
GET  /snapshot?mode=expanded
POST /click
POST /fill
POST /press
POST /scroll
POST /shutdown_browser
```

Après tout changement dans `workspace/automation/` ou `workspace/root/`, reconstruire l'image :

```powershell
docker build -t agent-browser-workspace:local ./workspace
```

Les outils workspace appellent ce service depuis le backend. Le modèle ne reçoit jamais de coordonnées, seulement des refs de type `@e1`.

`workspace_snapshot` supporte deux modes :

- `expanded` par défaut : retourne davantage de refs accessibles, avec les éléments interactifs, les champs et les contenus importants ;
- `compact` : format plus court, qui priorise les refs interactives ou focusables.

Le payload envoyé au LLM est centré sur `tool_result.refs`, une liste minimale issue de Dogtail/AT-SPI2 :

```text
arbre AT-SPI2 brut
-> parcours Dogtail
-> normalisation des rôles AT-SPI2
-> suppression des caractères invisibles, champs vides et objets U+FFFC
-> conservation des éléments interactifs, champs éditables/focusables et contenus importants
-> déduplication positionnelle prudente et limites déterministes
-> payload minimal refs[] pour le LLM
-> mapping complet avec bounds gardé uniquement côté backend
```

Les rôles AT-SPI2 sont normalisés avant rendu, notamment :

```text
push button -> button
toggle button -> button
entry -> textbox
password text -> textbox
check box -> checkbox
radio button -> radio
combo box -> combobox
page tab -> tab
document web -> document
landmark -> region
internal frame -> frame
tool bar -> toolbar
```

Exemple de shape :

```json
{
  "ok": true,
  "snapshot_id": "s42",
  "mode": "expanded",
  "refs": [
    {
      "ref": "@e1",
      "role": "textbox",
      "name": "Rechercher",
      "states": ["editable", "focusable"]
    }
  ],
  "warning": null
}
```

Les anciennes refs deviennent invalides après chaque nouveau snapshot. Les actions `workspace_click`, `workspace_fill`, `workspace_press` et `workspace_scroll` retournent donc toujours un nouveau snapshot et un nouveau `snapshot_id`.

Si le dashboard debug affiche un raw snapshot volumineux mais un payload nettoyé vide ou `refs: []`, vérifier en priorité :

- que le container workspace a bien été relancé après `docker build -t agent-browser-workspace:local ./workspace` ;
- que `python3-dogtail` est présent dans l'image workspace ;
- que Dogtail voit bien l'application Chromium via AT-SPI2 ;
- que `workspace/automation/snapshot.py` n'a pas filtré tous les rôles utiles.

En mode workspace, l'agent dispose notamment de :

- `start_workspace_browser` : démarre le container navigateur workspace, affiche le stream et ouvre Chromium avec une URL optionnelle ;
- `stop_workspace_browser` : arrête le container navigateur, sans quitter le mode workspace ;
- `workspace_snapshot`, `workspace_click`, `workspace_fill`, `workspace_press`, `workspace_scroll`.

Le bouton utilisateur "Activer workspace" reste un raccourci ergonomique : il passe en mode workspace et démarre directement le navigateur.

Quand l'utilisateur active le workspace manuellement via ce bouton, le prochain appel `/api/chat` en mode workspace ajoute automatiquement au contexte OpenAI un snapshot `expanded` du navigateur déjà affiché. L'agent sait donc que le workspace existe déjà et peut agir à partir du `snapshot_id` courant, ou appeler `start_workspace_browser` avec une URL pour naviguer dans le workspace existant.

Si `start_workspace_browser` est appelé avec une URL alors que le workspace est déjà `RUNNING`, le backend ne retourne plus simplement "déjà actif" : il appelle le service automation `/open_browser` du container existant pour ouvrir cette URL dans Chromium.

Limites actuelles : l'automatisation dépend de l'arbre AT-SPI2 exposé par le navigateur et par le site. Certaines pages virtualisées ou certains composants custom peuvent nécessiter des améliorations de snapshot/scroll plus tard.

`OPENAI_TOOL_RUN_TIMEOUT_MS` remplace l'ancienne limite fixe de nombre d'appels tools. Le workspace peut donc enchaîner autant d'actions que nécessaire tant que la durée totale de la réponse reste sous ce timeout. Cela évite les blocages rapides pendant une navigation tout en gardant une protection contre les boucles infinies.

## Logs de debug

Le projet dispose d'une politique de logs locale activable par `.env`. Par défaut, `LOG_ENABLED="false"` afin d'éviter de créer des fichiers sensibles inutilement.

Quand les logs sont actifs, ils sont rangés par utilisateur puis par conversation :

```text
logs/
  users/
    user_{userId}/
      conversations/
        conversation_{conversationId}/
          agent.log
          tools.log
          workspace.log
          automation.log
          openai/
          snapshots/
          container-logs/
```

Modes utiles :

```env
# Aucun log
LOG_ENABLED="false"

# Debug normal recommandé
LOG_ENABLED="true"
LOG_LEVEL="info"
LOG_AGENT="true"
LOG_TOOLS="true"
LOG_WORKSPACE="true"
LOG_AUTOMATION="true"
LOG_BROWSER="true"
LOG_COMPACT_SNAPSHOTS="true"
LOG_RAW_SNAPSHOTS="false"
LOG_OPENAI="false"

# Debug complet pour diagnostiquer un bug workspace/snapshot
LOG_ENABLED="true"
LOG_ALL="true"
LOG_OPENAI="true"
LOG_RAW_SNAPSHOTS="true"

# Logs workspace uniquement
LOG_ENABLED="true"
LOG_AGENT="false"
LOG_OPENAI="false"
LOG_TOOLS="false"
LOG_WORKSPACE="true"
LOG_AUTOMATION="true"
LOG_BROWSER="true"
LOG_SNAPSHOTS="true"
LOG_COMPACT_SNAPSHOTS="true"
LOG_RAW_SNAPSHOTS="true"
```

Catégories :

- `LOG_AGENT` : orchestration IA, mode courant, outils disponibles, décisions de tool, réponse finale ;
- `LOG_OPENAI` : artefacts JSON des requêtes/réponses OpenAI, très utiles mais potentiellement sensibles ;
- `LOG_TOOLS` : début, fin et erreurs des outils classiques et workspace ;
- `LOG_WORKSPACE` : lifecycle Docker/Selkies, ports, `streamUrl`, `automationUrl`, start/stop ;
- `LOG_AUTOMATION` : appels backend vers le service automation et logs `/config/log/agent-automation.log` ;
- `LOG_BROWSER` : extrait des logs Chromium du container ;
- `LOG_SNAPSHOTS` : interrupteur général conceptuel pour les snapshots ;
- `LOG_COMPACT_SNAPSHOTS` : snapshot envoyé au LLM ;
- `LOG_RAW_SNAPSHOTS` : arbre AT-SPI2 brut récupéré via `/raw_snapshot`, à activer seulement pour debug car il est volumineux.

Pour diagnostiquer "l'agent voit une page vide alors que le stream affiche la page" :

1. Vérifier `workspace.log` : container, ports et navigateur démarrés.
2. Vérifier `container-logs/*chromium*.json` : erreur Chromium ou popup de restauration.
3. Vérifier `automation.log` : appels `/snapshot` et stats.
4. Comparer `snapshots/*raw*.json` et `snapshots/*compact*.json` :
   - si le brut est vide, AT-SPI2 ne voit pas la page ou lit la mauvaise session ;
   - si le brut contient la page mais pas le compact/expanded, l'algorithme de filtrage est trop agressif.

`LOG_REDACT_SECRETS="true"` masque les champs sensibles connus. Les logs peuvent tout de même contenir du contenu de pages, des URLs, des noms ou des données utilisateur : ne pas les partager publiquement.

## Dashboard debug snapshot

Une page interne permet de comparer l'écran workspace, le snapshot brut Linux et le payload transmis au modèle :

```text
http://localhost:3000/debug/workspace-snapshot
```

Workflow :

1. Se connecter à l'application.
2. Ouvrir `/debug/workspace-snapshot`.
3. Cliquer `Lancer workspace`.
4. Naviguer manuellement dans Chromium.
5. Cliquer `Snapshot`.
6. Comparer :
   - la colonne gauche : stream Selkies visible ;
   - la colonne centrale : JSON brut AT-SPI2 (`/raw_snapshot`) ;
   - la colonne droite : wrapper `agent_instruction` + `tool_result` envoyé au LLM.

Cette page est réservée au debug local. Elle crée ou réutilise une conversation technique nommée `Debug snapshot workspace` pour rattacher le container et les logs à l'utilisateur connecté.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Auth.js / NextAuth
- OpenAI API officielle
- Serper.dev pour la recherche web
- Cheerio pour l'extraction de pages HTML
- Docker + Selkies/WebRTC pour le workspace local
- AT-SPI2 + xdotool pour l'automatisation workspace

## Scripts

```powershell
pnpm run dev
pnpm run build
pnpm run lint
pnpm run db:generate
pnpm run db:migrate
pnpm run db:deploy
pnpm run db:reset
pnpm run db:studio
```

## Reset local

```powershell
docker compose down -v
docker compose up -d
pnpm run db:migrate
```

SQLite n'est plus utilisé ; PostgreSQL est la base locale et cible.
