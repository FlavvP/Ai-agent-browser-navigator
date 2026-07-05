# Agent Browser Navigator

Agent Browser Navigator est une application web de chat IA dont l'objectif est de piloter un agent capable de naviguer sur Internet de maniere proche d'un utilisateur humain. L'agent doit pouvoir ouvrir des pages, cliquer, remplir des champs, scroller, lire l'etat courant de l'ecran et enchainer des actions dans une interface visible par l'utilisateur.

Pour cela, le projet ne s'appuie pas sur une simple API navigateur invisible. Il demarre un workspace Linux distant, affiche ce workspace dans l'interface web, lance Chromium dans cette machine, lit l'interface via l'accessibilite Linux, puis execute les clics, frappes clavier et scrolls via l'OS. Le but est d'obtenir un comportement plus naturel et plus proche d'une vraie session utilisateur qu'une automatisation DOM classique.

Le workspace est une interface partagee entre l'humain et l'agent IA. Quand le mode workspace est active, l'utilisateur voit la meme machine, le meme navigateur et la meme session que l'agent. Il peut reprendre la main, cliquer, taper, se connecter, valider une action sensible ou resoudre une etape manuelle, puis laisser l'agent continuer sur exactement le meme etat.

L'application propose deux modes :

- chat classique avec historique persistant ;
- workspace agentique Docker/Selkies en split-screen, avec navigateur visible et actions automatisees via l'OS.

## Demarrage

Demarrer PostgreSQL local :

```powershell
docker compose up -d
```

Installer et preparer la base :

```powershell
npm install
npm run db:migrate
npm run db:generate
npm run dev
```

L'application est disponible sur `http://localhost:3000`.

## Variables D'environnement

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

`AUTH_SECRET` doit etre une valeur longue et aleatoire.

## Authentification

L'authentification utilise Auth.js / NextAuth avec deux modes :

- Google OAuth avec `AUTH_GOOGLE_ID` et `AUTH_GOOGLE_SECRET`.
- Email/password avec hash bcrypt cote serveur.

Si les variables Google sont vides, le login email/password reste disponible.

## Titres De Conversations

Au premier message utilisateur d'une nouvelle conversation, le backend genere un titre court via OpenAI.

- `OPENAI_TITLE_MODEL` controle le modele utilise pour ce titrage.
- Le prompt demande un titre de 5 mots maximum, dans la langue du message si possible, sans abrevier les mots et sans faute volontaire.
- Le resultat est nettoye cote backend et limite a 5 mots meme si le modele depasse.
- Si `OPENAI_API_KEY` est absente ou si l'appel echoue, un fallback local utilise les premiers mots du message.
- Les conversations deja titrees ne sont pas renommees automatiquement.
- Pendant le titrage, l'interface affiche trois points dans le header et dans la sidebar, puis remplace ce placeholder des que le titre serveur est disponible.

## Tools Web

En mode classique, l'agent dispose de trois tools :

- `web_search` : recherche web via Serper.dev, active avec `SERPER_API_KEY`.
- `read_url` : lecture de pages publiques simples via extraction HTML cote serveur.
- `enter_workspace_mode` : passage en mode agentique avance, sans demarrer le navigateur.

Chaque resultat de tool renvoye au modele est enveloppe ainsi :

```json
{
  "agent_instruction": "Instruction backend indiquant quoi faire ensuite.",
  "tool_result": {}
}
```

## Workspace Docker/Selkies

Le workspace lance un container Linux par session et affiche son stream dans le panneau gauche via Selkies/WebRTC.

- `WORKSPACE_IMAGE` rend l'image interchangeable sans modifier le code.
- `WORKSPACE_CONTAINER_PORT` est le port HTTP expose par l'image Selkies dans le container. Pour `ghcr.io/linuxserver/baseimage-selkies:debiantrixie`, utiliser `3000`, pas `3001` qui correspond au websocket interne.
- `WORKSPACE_AUTOMATION_PORT` est le premier port local reserve au service automation.
- `WORKSPACE_AUTOMATION_CONTAINER_PORT` est le port HTTP du service automation dans le container.
- `WORKSPACE_READY_DELAY_MS` ajoute une courte stabilisation apres la disponibilite HTTP pour laisser la couche Selkies/WebSocket se connecter avant l'affichage de l'iframe.
- `WORKSPACE_DEFAULT_URL` est l'URL ouverte dans Chromium si aucun site precis n'est fourni.
- `WORKSPACE_PORT_START` / `WORKSPACE_PORT_END` definissent la plage de ports locaux reserves aux streams.
- `WORKSPACE_PROFILE_MOUNT` est le chemin du profil Chromium propre a la conversation.
- `WORKSPACE_USER_PROFILE_MOUNT` est le chemin du profil utilisateur partage, utilise pour synchroniser cookies et connexions entre conversations.
- `WORKSPACE_IDLE_TIMEOUT_MINUTES` arrete un workspace non visible et sans activite recente apres ce delai. `0` desactive le timeout.
- `WORKSPACE_IDLE_SWEEP_INTERVAL_MS` controle la frequence de nettoyage des workspaces idle.
- `WORKSPACE_BROWSER_MODE` controle l'affichage Chromium : `maximized` par defaut, `app` ou `normal` pour debug.
- `WORKSPACE_BROWSER_WATCHDOG_ENABLED` relance Chromium si l'utilisateur ferme la fenetre et re-active/re-maximise la fenetre si elle est minimisee ou restauree.
- `WORKSPACE_BROWSER_WATCHDOG_INTERVAL_MS` definit la frequence de verification du watchdog navigateur.
- `WORKSPACE_SCREEN_WIDTH`, `WORKSPACE_SCREEN_HEIGHT` et `WORKSPACE_SCREEN_DPI` verrouillent la resolution Selkies. Par defaut, le workspace utilise `1366x768` a `96 DPI` pour avoir un rendu plus large que le 1024x768 initial.
- Un volume Docker `workspace-profile-{userId}` conserve l'identite web partagee entre conversations.
- Un volume Docker `workspace-conversation-{conversationId}` conserve les onglets et l'etat Chromium de la conversation.
- Le container est supprime a l'arret, mais les volumes profils restent.

Politique de session workspace :

- plusieurs conversations peuvent avoir un workspace actif en meme temps ;
- changer de conversation ne stoppe pas le workspace precedent ;
- fermer l'onglet local de l'application ne stoppe pas immediatement le workspace ;
- le workspace est arrete uniquement par action explicite ou par idle timeout ;
- l'idle timeout ne se declenche que si le workspace n'est plus visible et qu'aucune activite workspace recente n'a ete observee ;
- les actions `workspace_snapshot`, `workspace_click`, `workspace_fill`, `workspace_press`, `workspace_scroll` et `start_workspace_browser` mettent a jour l'activite ;
- Chromium est ferme proprement via le service automation avant suppression du container pour sauvegarder la session.

Les generations agent sont detachees du stream HTTP client via `AgentRun`. Si l'utilisateur ferme l'onglet local, le run continue cote serveur tant que le process Next.js reste vivant. Le bouton stop annule le run cote serveur. En cas de redemarrage du serveur, les runs actifs precedents sont consideres interrompus.

Le projet ne stocke pas les identifiants ou mots de passe de sites tiers. Les cookies et sessions web peuvent toutefois vivre dans le volume profil Docker ; ce volume doit donc etre traite comme une donnee sensible.

Le mode `maximized` conserve les onglets et la barre d'adresse. Les controles de fenetre Linux restent visibles si le window manager les affiche, mais le watchdog neutralise leurs effets : fermeture -> relance Chromium, minimisation -> reactivation, restauration petite fenetre -> re-maximisation. Ce n'est pas une barriere de securite forte contre un utilisateur determine ; l'isolation de securite reste assuree par le container workspace.

Quand une conversation passe en mode workspace, l'interface replie automatiquement la sidebar des conversations pour laisser plus de largeur au stream.

Chromium est uniformise autour de Google :

- `WORKSPACE_DEFAULT_URL` vaut `https://www.google.com` par defaut.
- Le profil Chromium force le bouton home et la page de demarrage vers cette URL.
- Une extension locale `Agent Workspace New Tab` remplace la page nouvel onglet Debian/Chromium par Google.
- Chromium est lance en francais (`--lang=fr-FR`) et le profil force `fr-FR,fr,en-US,en` comme langues acceptees.
- La traduction automatique Chromium est desactivee pour eviter le popup de traduction.
- Les favoris Debian par defaut sont remplaces par un favori Google minimal.

Commandes utiles :

```powershell
docker ps --filter "label=app=agent-browser-navigator"
docker rm -f <container>
docker volume ls --filter "name=workspace-profile"
```

Limites actuelles : le stream local n'est pas encore securise par reverse proxy, le terminal agentique n'est pas encore expose comme tool, et l'image workspace peut devoir etre adaptee selon le comportement exact de l'image Selkies retenue.

## Build Image Workspace

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

Apres tout changement dans `workspace/automation/` ou `workspace/root/`, reconstruire l'image :

```powershell
docker build -t agent-browser-workspace:local ./workspace
```

Les tools workspace appellent ce service depuis le backend. Le modele ne recoit jamais de coordonnees, seulement des refs de type `@e1`.

`workspace_snapshot` supporte deux modes :

- `expanded` par defaut : retourne davantage de refs accessibles, avec interactifs, champs et contenus importants.
- `compact` : format plus court, priorise les refs interactives/focusables.

Le payload envoye au LLM est centre sur `tool_result.refs`, une liste minimale issue de Dogtail/AT-SPI2 :

```text
arbre AT-SPI2 brut
-> parcours Dogtail
-> normalisation des roles AT-SPI2
-> suppression des caracteres invisibles, champs vides et objets U+FFFC
-> conservation des interactifs, champs editables/focusables et contenus importants
-> deduplication positionnelle prudente et limites deterministes
-> payload minimal refs[] pour le LLM
-> mapping complet avec bounds garde uniquement cote backend
```

Les roles AT-SPI2 sont normalises avant rendu, notamment :

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

Les anciennes refs deviennent invalides apres chaque nouveau snapshot. Les actions `workspace_click`, `workspace_fill`, `workspace_press` et `workspace_scroll` retournent donc toujours un nouveau snapshot et un nouveau `snapshot_id`.

Si le dashboard debug affiche un raw snapshot volumineux mais un payload nettoye vide ou `refs: []`, verifier en priorite :

- que le container workspace a bien ete relance apres `docker build -t agent-browser-workspace:local ./workspace` ;
- que `python3-dogtail` est present dans l'image workspace ;
- que Dogtail voit bien l'application Chromium via AT-SPI2 ;
- que `workspace/automation/snapshot.py` n'a pas filtre tous les roles utiles.

En mode workspace, l'agent dispose notamment de :

- `start_workspace_browser` : demarre le container navigateur workspace, affiche le stream et ouvre Chromium avec URL optionnelle.
- `stop_workspace_browser` : arrete le container navigateur, sans quitter le mode workspace.
- `workspace_snapshot`, `workspace_click`, `workspace_fill`, `workspace_press`, `workspace_scroll`.

Le bouton utilisateur "Activer workspace" reste un raccourci ergonomique : il passe en mode workspace et demarre directement le navigateur.

Quand l'utilisateur active le workspace manuellement via ce bouton, le prochain appel `/api/chat` en mode workspace ajoute automatiquement au contexte OpenAI un snapshot `expanded` du navigateur deja affiche. L'agent sait donc que le workspace existe deja et peut agir a partir du `snapshot_id` courant, ou appeler `start_workspace_browser` avec une URL pour naviguer dans le workspace existant.

Si `start_workspace_browser` est appele avec une URL alors que le workspace est deja `RUNNING`, le backend ne retourne plus simplement "deja actif" : il appelle le service automation `/open_browser` du container existant pour ouvrir cette URL dans Chromium.

Limites actuelles : l'automatisation depend de l'arbre AT-SPI2 expose par le navigateur et le site. Certaines pages virtualisees ou composants custom peuvent necessiter des ameliorations de snapshot/scroll plus tard.

`OPENAI_TOOL_RUN_TIMEOUT_MS` remplace l'ancienne limite fixe de nombre d'appels tools. Le workspace peut donc enchainer autant d'actions que necessaire tant que la duree totale de la reponse reste sous ce timeout. Cela evite les blocages rapides pendant une navigation tout en gardant une protection contre les boucles infinies.

## Logs De Debug

Le projet dispose d'une politique de logs locale activable par `.env`. Par defaut, `LOG_ENABLED="false"` afin d'eviter de creer des fichiers sensibles inutilement.

Quand les logs sont actifs, ils sont ranges par utilisateur puis par conversation :

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

# Debug normal recommande
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

Categories :

- `LOG_AGENT` : orchestration IA, mode courant, tools disponibles, decisions de tool, reponse finale.
- `LOG_OPENAI` : artefacts JSON des requetes/reponses OpenAI. Tres utile mais potentiellement sensible.
- `LOG_TOOLS` : debut/fin/erreurs des tools classiques et workspace.
- `LOG_WORKSPACE` : lifecycle Docker/Selkies, ports, `streamUrl`, `automationUrl`, start/stop.
- `LOG_AUTOMATION` : appels backend vers le service automation et logs `/config/log/agent-automation.log`.
- `LOG_BROWSER` : extrait des logs Chromium du container.
- `LOG_SNAPSHOTS` : interrupteur general conceptuel pour les snapshots.
- `LOG_COMPACT_SNAPSHOTS` : snapshot envoye au LLM.
- `LOG_RAW_SNAPSHOTS` : arbre AT-SPI2 brut recupere via `/raw_snapshot`, a activer seulement pour debug car volumineux.

Pour diagnostiquer "l'agent voit une page vide alors que le stream affiche la page" :

1. Verifier `workspace.log` : container, ports et navigateur demarres.
2. Verifier `container-logs/*chromium*.json` : erreur Chromium ou popup de restauration.
3. Verifier `automation.log` : appels `/snapshot` et stats.
4. Comparer `snapshots/*raw*.json` et `snapshots/*compact*.json` :
   - si le brut est vide, AT-SPI2 ne voit pas la page ou lit la mauvaise session ;
   - si le brut contient la page mais pas le compact/expanded, l'algorithme de filtrage est trop agressif.

`LOG_REDACT_SECRETS="true"` masque les champs sensibles connus. Les logs peuvent tout de meme contenir du contenu de pages, des URLs, des noms ou des donnees utilisateur : ne pas les partager publiquement.

## Dashboard Debug Snapshot

Une page interne permet de comparer l'ecran workspace, le snapshot brut Linux et le payload transmis au modele :

```text
http://localhost:3000/debug/workspace-snapshot
```

Workflow :

1. Se connecter a l'application.
2. Ouvrir `/debug/workspace-snapshot`.
3. Cliquer `Lancer workspace`.
4. Naviguer manuellement dans Chromium.
5. Cliquer `Snapshot`.
6. Comparer :
   - la colonne gauche : stream Selkies visible ;
   - la colonne centrale : JSON brut AT-SPI2 (`/raw_snapshot`) ;
   - la colonne droite : wrapper `agent_instruction` + `tool_result` envoye au LLM.

Cette page est reservee au debug local. Elle cree ou reutilise une conversation technique nommee `Debug snapshot workspace` pour rattacher le container et les logs a l'utilisateur connecte.

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
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:reset
npm run db:studio
```

## Reset Local

```powershell
docker compose down -v
docker compose up -d
npm run db:migrate
```

SQLite n'est plus utilise ; PostgreSQL est la base locale et cible.
