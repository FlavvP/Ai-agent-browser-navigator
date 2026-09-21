# Journal D'Implementation

Historique des travaux et validations du projet. Les instructions durables sont dans [AGENTS.md](AGENTS.md). Les entrees historiques ci-dessous sont conservees telles quelles ; leurs references aux fichiers modifies decrivent la situation au moment des travaux.

## Journal D'Avancement

### 2026-05-24 - Phase 0

- Ancien contenu du repo supprime : `windows-uia-mcp/` et `PROJET_AGENT_NAVIGATEUR.md`.
- Creation de `AGENT.md`.
- Initialisation Next.js effectuee avec TypeScript, App Router, Tailwind et npm.
- Installation effectuee : Prisma, OpenAI SDK, lucide-react, clsx, tailwind-merge, class-variance-authority.
- Prisma 7 a ete evite pour ce MVP car sa configuration SQLite a change. Prisma est verrouille en v5.22.0.
- `prisma db push` echouait silencieusement dans cet environnement ; ajout de `scripts/init-sqlite.py` pour initialiser SQLite de maniere reproductible.
- Schema Prisma ajoute et base SQLite locale creee dans `prisma/dev.db`.
- Routes API ajoutees : conversations, conversation detail, chat, workspace start, workspace stop.
- UI ajoutee : sidebar, chat, message list, input, header, workspace panel mock.
- OpenAI API branchee via Responses API cote serveur avec fallback local si `OPENAI_API_KEY` est absente.
- Validations executees : `npm run lint`, `npm run build`, smoke tests HTTP `/`, `/api/conversations`, `/api/chat`, `/api/workspace/start`.
- La base de test a ete videe apres smoke test.
- Serveur de dev lance sur `http://localhost:3000`.
- Prochaine etape : MVP 2, ajouter les tools web API classiques et l'affichage des tool calls.

### 2026-05-24 - Ajustement UX Chat

- Correction de l'envoi des messages cote interface.
- Le message utilisateur est maintenant ajoute immediatement dans la conversation via un etat optimiste avant la reponse serveur.
- Ajout d'un indicateur d'attente a trois points pendant la generation de la reponse assistant.
- Fichiers modifies : `src/components/chat/chat-view.tsx`, `src/components/chat/message-list.tsx`.
- Prochaine etape : verifier le comportement dans le navigateur, puis continuer MVP 2.

### 2026-05-24 - Enrichissement Du Plan Technique

- Ajout d'une section detaillee sur les decisions techniques structurantes.
- Documentation explicite du principe : le LLM doit avoir le moins de responsabilite possible.
- Ajout du contexte sur les deux familles de navigation : API classique et workspace agentique.
- Ajout du plan technique detaille par MVP, avec architecture, workflows, tools, snapshots et points de vigilance.
- Documentation du contrat `snapshot -> ref -> action backend -> nouveau snapshot`.
- Clarification du role de Windows UI Automation pour les prototypes locaux et d'AT-SPI2 pour la VM Linux cible.
- Fichier modifie : `AGENTS.md`.
- Prochaine etape : continuer le MVP 2 avec les tools web API classiques.

### 2026-05-24 - MVP 2 Tools Web API Classiques

- Ajout du tool `web_search` avec Serper.dev (`SERPER_API_KEY`).
- Ajout du tool `read_url` avec `fetch` serveur, timeout, validation URL publique et extraction HTML via Cheerio.
- Ajout d'un runner tools qui valide le nom du tool, execute le handler, normalise les erreurs et sauvegarde `ToolEvent`.
- Modification de l'orchestration OpenAI Responses API pour gerer les function calls avec une limite de 5 iterations.
- Les tools MVP 2 sont disponibles uniquement en mode classique.
- Les conversations retournent maintenant les `toolEvents`, affiches dans le chat sous forme de lignes discretes.
- Documentation mise a jour dans `.env.example`, `README.md` et ce fichier.
- Prochaine etape : tester avec une vraie cle Serper et ameliorer l'extraction `read_url` si les pages sont trop bruitees.

### 2026-05-24 - Convention `agent_instruction` Pour Tools

- Ajout d'une enveloppe obligatoire pour les resultats de tools envoyes au LLM.
- Chaque output contient maintenant `agent_instruction` et `tool_result`.
- `agent_instruction` est construite cote backend dans le runner tools selon le tool, le succes, l'erreur et certains details comme `truncated`.
- Documentation de cette convention dans `AGENTS.md` et `README.md`.
- Fichier modifie : `src/lib/ai/tools/tool-runner.ts`.
- Prochaine etape : appliquer cette meme convention a tous les futurs tools workspace.

### 2026-05-24 - MVP 3 Authentification Multi-Utilisateur

- Ajout d'Auth.js / NextAuth avec Prisma Adapter.
- La version resolue est `next-auth@4`, donc la route utilise `NextAuth(authOptions)` et `getServerSession`.
- Ajout de Google OAuth et email/password via Credentials provider.
- Ajout du modele `PasswordCredential` pour stocker les hash bcrypt separement du modele `User`.
- Ajout de `Conversation.userId` et protection des routes API metier par `auth()`.
- Ajout d'un ecran de connexion/inscription et d'un bouton deconnexion dans la sidebar.
- `npm run db:init` reinitialise volontairement la base SQLite de developpement pour appliquer le schema auth.
- Documentation mise a jour dans `.env.example`, `README.md` et ce fichier.
- Variables auth locales : `AUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
- Test manuel utilisateur valide : creation et connexion email/password fonctionnent.
- Prochaine etape : MVP 4, migration SaaS et PostgreSQL.

### 2026-05-24 - MVP 4 PostgreSQL Et Prisma Migrations

- Migration du datasource Prisma de SQLite vers PostgreSQL.
- Ajout de `docker-compose.yml` avec PostgreSQL 16 local.
- Suppression du script SQLite maison `scripts/init-sqlite.py` et du dossier `scripts`.
- Remplacement des scripts DB par le workflow Prisma standard : `db:migrate`, `db:deploy`, `db:reset`, `db:studio`, `db:generate`.
- Ajout de la migration initiale PostgreSQL dans `prisma/migrations/20260524230000_init_postgresql/migration.sql`.
- Mise a jour de `.env.example` et `README.md` pour `DATABASE_URL` PostgreSQL.
- Docker CLI est installe mais Docker Desktop n'etait pas lance pendant l'implementation ; `docker compose up -d` devra etre relance quand Docker Desktop sera actif.
- `prisma generate`, `lint` et `build` ont ete executes avec une `DATABASE_URL` PostgreSQL locale.
- Seed minimal non ajoute volontairement : les comptes de test sont crees via l'UI email/password.
- Prochaine etape : lancer Docker Desktop, appliquer `npm run db:migrate`, puis tester creation de compte et conversation sur PostgreSQL.

### 2026-05-25 - MVP 5 Workspace Docker/Selkies

- Ajout des modeles et champs workspace : `WorkspaceProfile`, `WorkspaceSession.userId`, `workspaceProfileId`, `provider`, `externalId`, `containerName`, `startedAt`, `stoppedAt`, `lastSeenAt`, `metadataJson`.
- Ajout de la migration `20260525010000_workspace_docker_selkies`.
- Ajout d'une abstraction `WorkspaceProvider` avec provider mock et provider Docker/Selkies.
- Le provider Docker lance un container par session, ajoute des labels Docker, monte un volume profil persistant par utilisateur et expose `streamUrl`.
- Ajout de `GET /api/workspace/status`.
- L'UI workspace affiche maintenant le stream en iframe quand la session est `RUNNING`, un etat de demarrage en `STARTING` et une erreur en `FAILED`.
- Ajout d'un polling frontend : 2 secondes pendant `STARTING`, 10 secondes pendant `RUNNING`.
- Ajout des variables `WORKSPACE_*` dans `.env.example` et documentation dans `README.md`.
- Decision confirmee : pas de vraie VM au MVP 5, mais un container Linux jetable avec profil utilisateur persistant.
- Decision securite : ne jamais stocker en base les identifiants ou mots de passe de sites tiers ; le volume profil peut contenir des cookies et doit etre considere sensible.
- Tests executes : `prisma migrate status`, `npm run db:generate`, `npm run lint`, `npm run build`.
- Smoke test Docker execute : l'image `ghcr.io/linuxserver/baseimage-selkies:debiantrixie` demarre avec le port container `3001`, puis le container jetable est supprime.
- Prochaine etape : tester le lancement d'un workspace depuis l'UI connectee, puis ajuster le chemin de profil ou l'image Docker si le comportement navigateur n'est pas suffisant.

### 2026-05-25 - MVP 6 Tools Navigateur Workspace

- Ajout de l'image custom `agent-browser-workspace:local` dans `workspace/Dockerfile`.
- Installation dans l'image de Chromium, AT-SPI2, Python, `python3-pyatspi` et `xdotool`.
- Ajout d'un service Python automation expose sur `/health`, `/snapshot`, `/click`, `/fill`, `/press`, `/scroll`.
- Le service automation lit l'arbre AT-SPI2, compacte les elements utiles, attribue des refs `@e1`, garde le mapping du dernier snapshot en memoire et refuse les refs obsoletes.
- Ajout du client backend `automation-client` qui recupere `automationUrl` depuis `WorkspaceSession.metadataJson`.
- Le provider Docker mappe maintenant le port automation, attend `/health`, et stocke `automationUrl` dans les metadata.
- Ajout des tools OpenAI workspace : `workspace_snapshot`, `workspace_click`, `workspace_fill`, `workspace_press`, `workspace_scroll`.
- Ajout du tool classique `start_workspace`, avec URL optionnelle, pour permettre a l'agent de basculer lui-meme vers le mode agentique avance.
- L'orchestration OpenAI selectionne les tools classiques en mode `CLASSIC`, puis bascule vers les tools workspace si `start_workspace` reussit.
- Le workspace ouvre automatiquement Chromium au demarrage, sur `WORKSPACE_DEFAULT_URL` ou sur l'URL fournie au tool `start_workspace`.
- Chaque resultat de tool workspace respecte la convention `agent_instruction` + `tool_result` et chaque call est sauvegarde dans `ToolEvent`.
- Le prompt workspace a ete mis a jour : refs symboliques obligatoires, pas de coordonnees, intervention humaine pour login/2FA/CAPTCHA/paiement.
- Tests executes : `docker build -t agent-browser-workspace:local ./workspace`, smoke test `/health`, smoke test `/snapshot`, `npm run lint`, `npm run build`.
- Ancien container workspace lance avec l'image Selkies generique arrete pour forcer les prochains tests a utiliser l'image custom.
- Prochaine etape : tester depuis l'UI avec Chromium ouvert dans le workspace, puis durcir le snapshot selon les sites reels.

### 2026-05-25 - Correction Flux Agentique Workspace/Browser

- Remplacement du flux monolithique `start_workspace` par deux niveaux.
- En mode classique, ajout de `enter_workspace_mode` en plus de `web_search` et `read_url`.
- `enter_workspace_mode` bascule seulement la conversation en mode workspace, sans demarrer Docker.
- En mode workspace, ajout de `start_workspace_browser` et `stop_workspace_browser`.
- `start_workspace_browser` accepte une URL optionnelle pour ouvrir directement Chromium sur un site cible.
- `stop_workspace_browser` arrete le container navigateur sans quitter le mode workspace.
- Le service automation expose `POST /open_browser`.
- Le provider workspace appelle `/open_browser` apres readiness Selkies + automation, avec `WORKSPACE_DEFAULT_URL` si aucune URL n'est fournie.
- L'orchestration OpenAI peut basculer de `CLASSIC` a `WORKSPACE` pendant la meme boucle tool-calling si `enter_workspace_mode` reussit.
- Le bouton UI "Activer workspace" reste un raccourci : il passe en mode workspace et demarre directement le browser.
- Pendant une reponse longue, le frontend poll la conversation pour afficher le panneau workspace quand l'agent declenche le mode avance.
- Tests executes : rebuild image workspace, smoke test `/health`, smoke test `/open_browser`, `npm run lint`, `npm run build`.

### 2026-05-25 - Correction Lancement Chromium Dans Workspace

- Correction du lancement automatique du navigateur dans le container workspace.
- Le service automation continue de tourner en root, mais lance maintenant Chromium et `xdotool` sous l'utilisateur desktop Selkies `abc`.
- Avant lancement, le service corrige les droits du profil persistant `/config/chromium` et des dossiers cache/config/log.
- Ajout d'un nettoyage prudent des verrous Chromium `Singleton*` quand aucun Chromium ne tourne dans le container, pour gerer les profils persistants provenant d'anciens containers.
- Ajout d'un log navigateur separe dans `/config/log/chromium.log`.
- Smoke test Docker valide : Chromium demarre sous `abc` avec le profil possede par `abc`.

### 2026-05-25 - Politique De Logs Multi-Niveaux

- Ajout d'une couche de logs locale dans `src/lib/logging`.
- Les logs sont classes par utilisateur et conversation dans `logs/users/user_{userId}/conversations/conversation_{conversationId}`.
- Ajout de categories activables par `.env` : agent, OpenAI, tools, workspace, automation, browser, snapshots compact/raw.
- Instrumentation de `/api/chat`, `chat-runner`, runners de tools, provider workspace et client automation.
- Ajout d'artefacts OpenAI optionnels dans `openai/`.
- Ajout d'artefacts snapshots compact et raw optionnels dans `snapshots/`.
- Ajout de la route automation `/raw_snapshot` pour recuperer l'arbre AT-SPI2 brut cote backend sans l'envoyer au LLM.
- Ajout de la recuperation d'extraits des logs container Chromium et automation dans `container-logs/`.
- Ajout de flags Chromium pour reduire le popup de restauration apres arret non propre : `--disable-session-crashed-bubble`, `--disable-infobars`, `--no-first-run`, `--no-default-browser-check`.
- Nettoyage prudent des fichiers de session Chromium `Current/Last Session/Tabs` avant lancement, sans supprimer cookies ni sessions de sites tiers.
- Documentation complete ajoutee dans `README.md` et ce fichier.

### 2026-05-25 - Correction AT-SPI2 Snapshot Vide

- Analyse des logs d'une session reelle : le stream affichait LinkedIn, mais `workspace_snapshot` retournait `raw_nodes=1`, uniquement le `desktop frame`.
- Conclusion : le service automation lisait un bus AT-SPI different de Chromium.
- Correction : le service automation Python tourne maintenant sous l'utilisateur desktop `abc`.
- Ajout d'un bus DBus de session stable dans `/tmp/runtime-abc/session-bus`.
- Automation et Chromium utilisent maintenant le meme `DBUS_SESSION_BUS_ADDRESS`.
- Ajout des paquets `libatk-adaptor` et `libgail-common`.
- Ajout des variables d'accessibilite : `NO_AT_BRIDGE=0`, `GTK_MODULES=gail:atk-bridge`, `GNOME_ACCESSIBILITY=1`, `ACCESSIBILITY_ENABLED=1`.
- Smoke test valide sur `https://www.linkedin.com/login` : raw snapshot passe de 1 noeud a 397 noeuds, compact snapshot detecte 97 elements.
- Impact : l'agent devrait maintenant voir les champs/boutons de la page LinkedIn au lieu de conclure que la page est vide.

### 2026-05-25 - Suppression Limite Fixe Tools Et Durcissement Chromium Restore

- Suppression de la limite fixe `MAX_TOOL_ITERATIONS = 5`.
- Remplacement par un timeout global configurable `OPENAI_TOOL_RUN_TIMEOUT_MS`, par defaut 180 secondes.
- Objectif : permettre aux taches workspace de faire plus d'actions sans tomber sur "limite d'appels tools".
- Ajout d'un nettoyage plus robuste du popup "Chromium didn't shut down correctly".
- Avant lancement Chromium, le service automation marque `Preferences` et `Local State` avec `profile.exit_type = Normal`, `profile.exited_cleanly = true`, `profile.should_restore_old_session = false`.
- Conservation explicite des cookies et sessions de sites tiers : seuls les locks/session restore/crash flags sont touches.
- Ajout du flag Chromium `--hide-crash-restore-bubble`.

### 2026-05-25 - Titres De Conversations Generes Par LLM

- Correction du bug des conversations creees via "Nouveau chat" qui conservaient le titre par defaut apres le premier message.
- Ajout de `src/lib/ai/conversation-title.ts` pour generer un titre serveur avec OpenAI.
- Ajout de `OPENAI_TITLE_MODEL`, par defaut `gpt-4.1-nano`.
- Le titre est demande au premier message utilisateur uniquement, puis nettoye et limite a 5 mots cote backend.
- Ajout d'un fallback local si OpenAI est indisponible ou non configure.
- Documentation mise a jour dans `.env.example`, `README.md` et ce fichier.

### 2026-05-25 - UX Titrage Conversation

- Durcissement du prompt de titrage : pas d'abreviation, pas de faute volontaire, conservation des noms propres.
- Ajout d'un etat visuel de titrage en cours avec trois points dans le header de conversation et dans la sidebar.
- Pendant une generation assistant, la sidebar recharge aussi les conversations afin d'afficher le titre des qu'il est disponible, sans attendre la fin de la reponse.

### 2026-05-25 - Workspace Browser Maximise Et Watchdog

- Remplacement du mode `kiosk` par `WORKSPACE_BROWSER_MODE=maximized` par defaut pour conserver les onglets et la barre d'adresse.
- Modes alternatifs conserves pour debug : `app` et `normal`.
- Ajout de `WORKSPACE_BROWSER_WATCHDOG_ENABLED` et `WORKSPACE_BROWSER_WATCHDOG_INTERVAL_MS`.
- Le service automation relance Chromium sur la derniere URL connue si le navigateur est ferme ou disparait.
- Le watchdog re-active et re-maximise aussi la fenetre si l'utilisateur clique sur minimiser ou restaurer en petite fenetre.
- Ajout de `wmctrl` dans l'image workspace pour maximiser la fenetre Chromium via le window manager.
- Ajout du flag Chromium `--test-type` pour reduire les bandeaux lies aux flags de ligne de commande.
- Documentation mise a jour dans `.env.example`, `README.md` et ce fichier.

### 2026-05-25 - Uniformisation Nouvel Onglet Google

- Decision produit : utiliser Google comme page neutre du workspace au MVP, plutot que la page Debian/Chromium native.
- Le profil Chromium est force cote automation : homepage, bouton home, provider de recherche et startup URL.
- Ajout d'une extension locale `/opt/agent-newtab-extension` chargee par Chromium pour remplacer `chrome://newtab` par Google.
- Objectif : demarrage navigateur, bouton home et nouvel onglet donnent tous une experience coherente.
- Chromium est lance en francais avec `--lang=fr-FR`, langues acceptees `fr-FR,fr,en-US,en`, traduction automatique desactivee.
- Les favoris Debian par defaut sont nettoyes et remplaces par un favori Google minimal.

### 2026-05-25 - Workspace Sidebar Auto-Collapse Et Resolution Large

- L'UI replie automatiquement la sidebar des conversations quand le workspace est active, que ce soit par le bouton utilisateur ou par l'agent.
- Ajout des variables `WORKSPACE_SCREEN_WIDTH`, `WORKSPACE_SCREEN_HEIGHT` et `WORKSPACE_SCREEN_DPI`.
- Le provider Docker passe `SELKIES_IS_MANUAL_RESOLUTION_MODE=true`, `SELKIES_MANUAL_WIDTH`, `SELKIES_MANUAL_HEIGHT` et `SELKIES_SCALING_DPI` au container.
- Valeur par defaut retenue : `1366x768` a `96 DPI`, pour obtenir un rendu plus large et moins carre.

### 2026-05-25 - Ajustement Layout Workspace Et Sidebar

- Le placeholder de chargement/erreur/attente du workspace utilise maintenant le meme cadre et le meme ratio que le stream Selkies.
- Objectif : eviter un saut visuel entre `STARTING` et `RUNNING`.
- L'auto-collapse de la sidebar ne se declenche plus en boucle pendant le polling workspace.
- La sidebar se replie toujours automatiquement a l'activation du workspace, mais l'utilisateur peut ensuite la rouvrir manuellement.

### 2026-05-25 - Snapshot Workspace Expanded

- Refonte du snapshot AT-SPI2 pour reduire les faux negatifs qui rendaient l'agent aveugle sur certaines pages.
- `workspace_snapshot` accepte maintenant `mode: "compact" | "expanded"`, avec `expanded` par defaut.
- Le mode `expanded` conserve davantage d'elements visibles/focusables/editables/actionnables.
- Ajout de contexte parent/voisin sur les elements pour aider l'agent a choisir le bon resultat ou bouton.
- Ajout de `regions` et `visible_text` dans le snapshot envoye au modele.
- Deduplication rendue plus prudente : deux elements au meme nom sont conserves s'ils sont dans des zones/positions differentes.
- Documentation mise a jour dans `README.md`.

### 2026-05-25 - Contexte Workspace Manuel Et Navigation Existante

- Correction de `start_workspace_browser` quand le workspace est deja `RUNNING`.
- Si une URL est fournie, le backend appelle maintenant `/open_browser` sur le service automation existant au lieu de retourner seulement "Workspace deja actif".
- Quand `/api/chat` demarre en mode `WORKSPACE`, le backend tente de recuperer un snapshot `expanded` initial.
- Ce snapshot est ajoute au contexte OpenAI avec une instruction indiquant que l'utilisateur a deja active le workspace via l'interface.
- Objectif : eviter que l'agent ignore le workspace manuel ou croie devoir demarrer une autre session.

### 2026-05-25 - Anti-Boucle Clic Et Priorisation Modales

- Analyse d'un blocage PagesJaunes : l'agent recliquait plusieurs fois `@e97` alors que le snapshot ne changeait pas.
- Cause principale : une modale cookies etait presente, mais les elements derriere la modale restaient dans le snapshot.
- Le scoring snapshot donne maintenant une forte priorite aux libelles de consentement/cookies/accepter/refuser/continuer/fermer.
- La detection `visibility` utilise aussi le chevauchement avec le viewport, car AT-SPI2 ne fournit pas toujours les etats `visible/showing`.
- Ajout d'un garde-fou dans `chat-runner` : une meme action workspace repetee plusieurs fois sur la meme ref est bloquee et renvoie une instruction de reprise au modele.
- Le prompt workspace indique de traiter les modales en priorite et de ne pas repeter un clic si le snapshot ne change pas.

### 2026-05-25 - Reservation Ports Docker Workspace

- Analyse d'un bug de demarrage workspace : plusieurs containers restaient en etat `Created` car Docker refusait `6100`, deja utilise par un ancien workspace.
- `findFreePort` tient maintenant compte des ports publies par les containers Docker actifs, pas seulement des ports detectes par `net.listen`.
- En cas d'echec pendant `docker run`, le provider supprime maintenant le container partiellement cree pour eviter l'accumulation de workspaces `Created`.
- Les volumes profils persistent ; seuls les containers jetables sont nettoyes.

### 2026-05-25 - Copie Des Messages Chat

- Ajout d'une action de copie sur chaque message dans `src/components/chat/message-bubble.tsx`.
- Les messages utilisateur affichent l'icone copier en bas a droite de la bulle uniquement au survol ou au focus clavier.
- Les messages assistant affichent l'icone copier en permanence en bas a gauche du message.
- Le bouton utilise `navigator.clipboard` avec fallback textarea, puis affiche une icone de confirmation courte.
- Test execute : `npm.cmd run lint`.
- Probleme rencontre : aucun.
- Ajustement suivant : pour les messages utilisateur, l'icone est maintenant en dehors de la bulle, sous son coin bas droit, sans padding interne dedie.
- Etape suivante : verifier visuellement dans le navigateur que le positionnement convient sur mobile et desktop.

### 2026-05-25 - Streaming Des Reponses Assistant

- Activation du streaming texte pour les reponses assistant dans le chat.
- `src/app/api/chat/route.ts` renvoie maintenant un flux NDJSON avec evenements `start`, `delta`, `done` et `error`.
- `src/lib/ai/chat-runner.ts` conserve la boucle tool-calling existante et utilise le streaming OpenAI Responses API pour emettre les deltas de texte.
- `src/components/chat/chat-view.tsx` lit le stream, cree un message assistant temporaire et ajoute les deltas au fur et a mesure.
- Le polling pendant generation ne recharge plus la conversation complete afin de ne pas ecraser le message en cours de streaming.
- Tests executes : `npm.cmd run lint`, `npm.cmd run build`.
- Probleme rencontre : un cast TypeScript du fallback de reponse stream a ete ajuste.
- Etape suivante : tester manuellement avec une vraie cle OpenAI et une reponse longue pour verifier le rendu progressif et le stop.

### 2026-05-25 - Correction Streaming Tools Et Texte Final

- Analyse des logs de `conversation_cmple4i4k001bbhnyi6tiewz1` : OpenAI renvoyait bien le texte final, mais `response.output_text` etait vide dans l'objet stream final.
- Correction de `src/lib/ai/chat-runner.ts` : extraction du texte final depuis `response.output` quand `output_text` est vide, pour eviter de sauvegarder le fallback local "Ajoute OPENAI_API_KEY".
- Ajout d'un callback `onToolEvent` dans les runners de tools classique et workspace.
- `src/app/api/chat/route.ts` emet maintenant aussi des evenements NDJSON `tool` des qu'un `ToolEvent` est persiste.
- `src/components/chat/chat-view.tsx` ajoute les tool events au fil de l'eau, garde les trois points tant qu'aucun delta texte n'est recu, puis les masque au premier delta.
- Le message assistant temporaire n'est plus cree vide au `start`; il est cree uniquement au premier morceau de texte.
- Tests executes : `npm.cmd run lint`, `npm.cmd run build`.
- Probleme rencontre : aucun apres correction.
- Etape suivante : refaire un test manuel avec une requete qui utilise `web_search` pour valider l'ordre visuel : points, tools, points, texte streamé, done sans remplacement erronne.

### 2026-05-25 - Dashboard Debug Snapshot Workspace

- Ajout d'une page interne `/debug/workspace-snapshot` protegee par l'authentification existante.
- Objectif : comparer visuellement le stream Selkies, le snapshot brut AT-SPI2 et le payload exact envoye au LLM.
- Ajout d'une conversation technique par utilisateur nommee `Debug snapshot workspace`, sans nouvelle table Prisma.
- Ajout des routes debug `start`, `stop` et `capture` sous `/api/debug/workspace-snapshot`.
- Ajout de `workspaceRawSnapshot` cote backend pour appeler `/raw_snapshot` sans exposer ce endpoint comme tool OpenAI.
- Le payload LLM affiche dans le dashboard conserve le wrapper `agent_instruction` + `tool_result`.
- Documentation mise a jour dans `README.md` et ce fichier.

### 2026-05-25 - Simplification Du Snapshot LLM

- Le snapshot brut Linux reste inchange et continue d'exposer l'arbre AT-SPI2 brut dans le dashboard.
- Le snapshot nettoye envoye au LLM ne contient plus les metadata globales `mode`, `page`, `viewport`, `summary` et `stats`.
- Le payload LLM se concentre sur `ok`, `snapshot_id`, `elements` et `warning` seulement si une erreur existe.
- Les elements utilisent maintenant les cles `ref`, `type`, `name`, `contenu`, `description`, `value`, `state` et `context`.
- Les champs vides sont supprimes.
- Les caracteres objet `U+FFFC` visibles sous la forme `￼` sont retires du snapshot nettoye.
- Les instructions workspace et la documentation ont ete alignees sur ce nouveau format.

### 2026-05-26 - Sessions Workspace Et AgentRun Persistants

- Ajout d'une architecture de profils Chromium separes : volume utilisateur pour l'identite web partagee et volume conversation pour les onglets/session.
- Ajout de `WorkspaceConversationProfile`, de champs `lastVisibleAt`, `lastActivityAt`, `shutdownReason` sur `WorkspaceSession`, et du modele `AgentRun`.
- Le service workspace monte maintenant deux volumes Docker et ferme Chromium via `/shutdown_browser` avant suppression du container.
- Le watchdog Chromium restaure la session de conversation lorsqu'une fenetre est fermee accidentellement.
- Ajout d'un janitor idle timeout base sur visibilite + activite.
- `/api/chat` cree un `AgentRun` detache du stream HTTP; fermer l'UI n'annule plus automatiquement la generation.
- Le bouton stop annule maintenant le run cote serveur.

### 2026-05-26 - Snapshot AT-SPI2 Texte Inspire Agent-Browser

- Refonte du snapshot LLM workspace : remplacement de la liste plate `elements[]` par `tool_result.snapshot`, un arbre texte indente avec refs inline.
- Le pipeline choisit prioritairement le meilleur sous-arbre `document web` actif/visible pour reduire la UI Chromium dans le contexte modele.
- Les roles AT-SPI2 sont normalises vers des roles plus proches navigateur, les champs vides et caracteres objet `U+FFFC` sont retires, et les refs restent mappees cote Python pour les actions.
- `compact` et `expanded` conservent des limites deterministes de refs/lignes/caracteres et signalent la troncature via `warning`.
- Les prompts workspace indiquent maintenant de lire `tool_result.snapshot`, d'utiliser uniquement les refs inline du snapshot courant et de considerer les anciennes refs comme obsoletes apres chaque action.
- Le dashboard debug conserve le wrapper `agent_instruction` + `tool_result`, mais affiche desormais le nouveau snapshot texte dans le payload LLM.

### 2026-05-26 - Correction Visibilite Snapshot AT-SPI2

- Bug observe dans le dashboard debug : le raw snapshot Linux etait volumineux, mais le snapshot nettoye renvoyait `(no accessible elements)` avec `ref_count: 0`.
- Cause : sur certains arbres Chromium/AT-SPI2, tous les noeuds avaient `states: []` malgre des `bounds` valides. Le filtre precedent exigeait `visible/showing`, donc il supprimait tout.
- Correction : si les etats de visibilite AT-SPI2 sont absents, `snapshot.py` detecte la visibilite par intersection entre les `bounds` du noeud et le viewport deduit du `desktop frame` ou de l'application Chromium.
- Ajout de normalisations de roles exposees par Chromium dans ces arbres : `toggle button -> button`, `internal frame -> frame`, `landmark -> region`, ainsi que des roles de contenu comme `header`, `footer`, `notification` et `video`.
- Validation effectuee sur un raw snapshot logge : passage de `0` ref a `177` refs sur une page LinkedIn.
- Rappel operationnel : apres modification de `workspace/automation/`, reconstruire l'image Docker puis arreter/relancer le workspace existant, car un container deja demarre conserve l'ancien code Python.

### 2026-05-27 - Snapshot Dogtail Minimal

- Le snapshot LLM workspace utilise maintenant Dogtail au-dessus d'AT-SPI2.
- `tool_result.snapshot` est remplace par `tool_result.refs`, une liste minimale d'objets contenant `ref`, `role`, `name`, `text`, `description`, `value` et `states` uniquement quand ces champs sont non vides.
- Le LLM ne recoit plus `tree`, `ref_count`, `node_count`, `actions`, `bounds` ou metadata de generation.
- Les bounds et l'objet AT-SPI/Dogtail restent stockes uniquement dans le `STORE` Python pour executer `click` et `fill`.
- `python3-dogtail` est ajoute a l'image workspace ; reconstruire l'image Docker est obligatoire apres cette modification.

### 2026-07-05 - Nettoyage Avant Remote GitHub

- Nettoyage du depot local avant creation du remote GitHub.
- Suppression des artefacts temporaires ou sensibles : `.next/`, `logs/`, `.env`, `.next-dev*.log`, `debug-dogtail-snapshot.json`, `text.txt`, `next-env.d.ts`, `workspace/automation/__pycache__/` et les clones externes `references/`.
- Suppression lancee sur `node_modules/`; un binaire Tailwind verrouille par Windows peut rester localement, mais le dossier est ignore par Git.
- Mise a jour de `.gitignore` pour ignorer les snapshots debug, `references/`, les caches Python et les artefacts deja exclus.
- Mise a jour de `README.md` avec une description courte du produit : agent IA web, workspace Linux visible, navigation Chromium et actions simulees via l'OS.
- Tests executes : aucun test applicatif, car `node_modules/` a ete supprime pour nettoyer le workspace avant versionnement.
- Probleme rencontre : suppression incomplete possible de `node_modules/` si un fichier natif est encore verrouille par un processus Windows.
- Etape suivante : verifier `git status`, creer le repository GitHub distant prive, ajouter `origin`, puis pousser le depot nettoye.

### 2026-07-05 - Creation Remote GitHub

- Creation du depot GitHub prive `ai-agent-browser-navigator` sous le compte `IsFIVI`.
- Nom retenu : `ai-agent-browser-navigator`, version fluide et compatible GitHub de "AI Agent Browser Navigator App".
- Remote local `origin` ajoute vers `https://github.com/IsFIVI/ai-agent-browser-navigator`.
- Decision : utiliser un depot prive par defaut, car le projet peut manipuler logs, profils navigateur, variables locales et donnees sensibles.
- Tests executes : verification `gh repo view` implicite via creation du repo; push a effectuer apres commit.
- Probleme rencontre : aucun.
- Etape suivante : committer le depot nettoye, renommer la branche principale en `main`, puis pousser vers `origin`.

### 2026-07-05 - Nettoyage README Presentation Produit

- Suppression des references aux etapes MVP dans `README.md` pour presenter le projet comme un produit coherent plutot qu'une roadmap interne.
- Ajout d'une explication du workspace comme interface partagee : l'utilisateur humain et l'agent IA voient et manipulent la meme machine, le meme navigateur et la meme session.
- Clarification de la description generale : chat classique d'un cote, workspace agentique Docker/Selkies de l'autre, avec actions navigateur automatisees via l'OS.
- Fichiers modifies : `README.md` et `AGENTS.md`.
- Tests executes : recherche `rg "MVP|Phase|Roadmap" README.md`, aucune occurrence restante.
- Probleme rencontre : aucun.
- Etape suivante : committer et pousser cette correction de documentation vers GitHub.

### 2026-07-05 - Correction Orthographe README

- Relecture et reecriture du `README.md` en francais accentue et encodage UTF-8 propre.
- Correction des accents manquants, de plusieurs formulations maladroites et des erreurs creees par une premiere passe automatique de remplacement.
- Conservation du fond technique : demarrage, variables d'environnement, workspace Docker/Selkies, outils web, snapshots, logs et debug.
- Fichiers modifies : `README.md` et `AGENTS.md`.
- Tests executes : lecture du debut du README et recherches `rg` ciblees sur les formes sans accents et les erreurs de remplacement connues.
- Probleme rencontre : le README avait temporairement un encodage invalide pour `apply_patch`; il a ete reecrit en UTF-8 via PowerShell.
- Etape suivante : committer et pousser la correction documentaire.

### 2026-09-21 - Verification Et Synchronisation GitHub

- Verification du depot local : la branche `main` etait deja reliee a GitHub et synchronisee sans commit d'ecart.
- Le depot canonique est `FlavvP/Ai-agent-browser-navigator`, actuellement public ; l'ancienne URL `IsFIVI/ai-agent-browser-navigator` redirigeait vers ce depot.
- Mise a jour du remote local `origin` vers `https://github.com/FlavvP/Ai-agent-browser-navigator.git`, puis push de verification.
- Verification des fichiers suivis et ignores : le code, les migrations Prisma, l'image workspace, `.env.example` et le lockfile sont versionnes ; `.env`, `node_modules`, `.next` et les logs restent exclus.
- Aucun secret evident de type cle OpenAI, jeton GitHub ou cle privee n'a ete detecte dans les fichiers suivis.
- Tests executes : `npm.cmd ci`, `npm.cmd run lint`, `npm.cmd run build` et `docker compose config --quiet`.
- Probleme rencontre : PowerShell bloquait `npm.ps1`; les commandes ont ete relancees via `npm.cmd`. `npm ci` signale 15 vulnerabilites de dependances a auditer separement.
- Etape suivante : cloner le depot sur l'autre appareil, copier `.env.example` vers `.env`, renseigner les secrets locaux, demarrer PostgreSQL et appliquer les migrations.

### 2026-09-21 - Preparation Locale Apres Clonage

- Installation propre des dependances avec `npm ci` sur Node.js 24.12.0 et npm 11.6.2.
- Creation du fichier local ignore `.env` depuis les valeurs d'exemple, avec un `AUTH_SECRET` aleatoire ; les cles `OPENAI_API_KEY`, `SERPER_API_KEY` et Google OAuth restent a renseigner par l'utilisateur si ces integrations sont souhaitees.
- Demarrage de Docker Desktop et de PostgreSQL via Docker Compose ; le container `agent-browser-postgres` est sain.
- Application des quatre migrations Prisma existantes et generation du client Prisma 5.22.0.
- Construction de l'image locale `agent-browser-workspace:local`, incluant Selkies, Chromium, Dogtail et AT-SPI2.
- Tests executes : `npm run lint` et `npm run build`, tous deux reussis.
- Probleme rencontre : Docker Desktop etait installe mais initialement arrete ; il a ete lance. `npm ci` signale 15 vulnerabilites transitives a auditer sans appliquer de mise a jour forcee. Next.js signale aussi un lockfile npm parent hors du depot, sans bloquer le build.
- Etape suivante : renseigner au minimum `OPENAI_API_KEY` dans `.env` pour activer les reponses IA, puis lancer l'application avec `docker compose up -d; npm run dev`.

### 2026-09-21 - Analyse Du Fonctionnement Applicatif

- Analyse statique du chat, de l'authentification, du schema Prisma, de la boucle OpenAI, des AgentRun, du lifecycle Docker/Selkies et des snapshots/actions Python.
- Confirmation des deux modes : recherche/lecture web par API et navigation Chromium partagee avec l'utilisateur via le workspace.
- Distinction entre les capacites implementees et la roadmap : prompts et nettoyage idle existent deja ; outils terminal/fichiers, billing et reprise des runs apres redemarrage restent absents.
- Points releves : les snapshots sont des listes `refs` Dogtail/AT-SPI2 ; les profils conversation sont initialises depuis le profil utilisateur puis recopies vers celui-ci a l'arret ; les runs restent executes dans le processus Next.js.
- Fichiers modifies : `AGENTS.md` uniquement, ajout de ce recap sans modification applicative.
- Tests executes : lecture et recherches ciblees du code ; aucun test dynamique ni appel externe effectue pour cette analyse.
- Limites identifiees : dependance a l'accessibilite des pages, validation humaine principalement prescrite par prompt, service automation sans authentification dans son handler et ports Docker publies sans restriction explicite a localhost.
- Etape suivante : valider un parcours complet en execution et consolider l'isolation reseau et les validations serveur avant un deploiement multi-utilisateur public.

### 2026-09-21 - Etude Architecture Hybride LLM Et TypeSafe Jev

- Recherche dans la documentation officielle TypeSafe : introduction, API, Choice, State, Confidence, Models, limites Jev 1.13, SDK JavaScript et patterns de questions paralleles.
- Proposition, non encore implementee ni validee par l'utilisateur : le LLM definit des sous-objectifs et prepare les textes ; Jev selectionne des actions bornees ; un orchestrateur serveur controle permissions, execution, progression et retour au LLM.
- L'API documentee evalue `state` et `questions` par requete ; la memoire de navigation doit rester applicative. Ne pas supposer une session conversationnelle distante Jev.
- Contraintes verifiees : Choice limite a 255 options ; Jev accepte du texte/JSON ; contexte total 64k tokens et state + question la plus longue 32k ; prix annonce de 0,042 USD par million de tokens entrants, sorties gratuites. Valeurs susceptibles d'evoluer.
- Points critiques : choisir des actions completes et non seulement des elements ; autoriser le remplissage sans LLM lorsque la valeur est deja connue ; conserver une option de recours ; ne pas assimiler confidence a une garantie de succes ; tester les sites francophones et les injections de contenu.
- Adaptations envisagees : separer texte de page et elements actionnables, enrichir les snapshots de contexte semantique, limiter les candidats, conserver les refs liees au snapshot, verrouiller l'execution par workspace et revalider la cible avant action. Les snapshots actuels peuvent contenir 320 refs et des textes tronques.
- Validation proposee : comparaison hors execution sur snapshots annotes, puis parcours controles et mesure du cout par tache reussie, latences, erreurs, boucles et recours au LLM. Aucun gain reel mesure a ce stade.
- Sources : https://docs.typesafe.ai/models ; https://docs.typesafe.ai/primitives/choice ; https://docs.typesafe.ai/confidence ; https://docs.typesafe.ai/model-jaggedness/jev-1.13 ; https://docs.typesafe.ai/sdk/javascript .
- Fichiers modifies : `AGENTS.md` seulement. Aucun changement applicatif, installation SDK ou appel payant effectue ; aucun test d'inference realise.
- Etape suivante : discuter la proposition puis construire un prototype limite, avec version Jev epinglee et mode de comparaison sans execution, avant generalisation.

### 2026-09-21 - Separation Du Journal D'Implementation

- Travail effectue : transfert integral du journal d'avancement de `AGENTS.md` vers `IMPLEMENTATION_LOG.md`, sans modification des entrees historiques.
- Fichiers crees ou modifies : creation de `IMPLEMENTATION_LOG.md` et mise a jour de `AGENTS.md` ; `CLAUDE.md` conserve son renvoi vers `AGENTS.md`.
- Decision : ajouter les prochains recapitulatifs dates uniquement dans ce journal ; conserver les instructions durables, l'architecture et la roadmap dans `AGENTS.md`.
- Verifications : comparaison exacte de l'historique avant/apres transfert, controle des renvois documentaires et verification du diff ; aucun test applicatif necessaire pour cette modification documentaire.
- Problemes rencontres : aucun ; les modifications locales preexistantes du journal ont ete conservees.
- Etape suivante : consigner les prochaines etapes importantes dans ce fichier.

### 2026-09-21 - Adoption Du Workflow Git Et Worktrees De SunPDF

- Travail effectue : lecture des instructions de SunPDF et adaptation de son workflow complet ; ajout d'un resume obligatoire dans `AGENTS.md`.
- Fichiers crees ou modifies : `docs/WORKTREE_WORKFLOW.md`, `AGENTS.md` et `IMPLEMENTATION_LOG.md`.
- Decisions : un worktree par cycle de conversation, branches de travail depuis `dev`, review explicite avant fusion, promotion vers `main` distincte, nettoyage sans force. Commandes adaptees a npm, Prisma et Docker ; aucune hypothese de deploiement SunPDF conservee.
- Verifications : comparaison avec le workflow source, lecture des scripts npm et des branches connues, controle des references et `git diff --check`. Aucun test applicatif requis pour cette documentation.
- Probleme constate : `dev` absent des references locales connues ; procedure d'initialisation documentee. Modifications locales preexistantes conservees ; adoption documentaire dans le checkout courant, sans commit, push ou creation de branche.
- Etape suivante : preparer un checkout propre, verifier les branches distantes et initialiser `dev` si necessaire avant le premier cycle d'implementation.

### 2026-09-21 - Initialisation Dev Et Perimetre Local

- Travail : retrait des procedures de promotion et de deploiement du workflow Git, a la demande de l'utilisateur ; preparation de `dev` depuis `main` pour y conserver les changements documentaires valides.
- Fichiers : `AGENTS.md`, `docs/WORKTREE_WORKFLOW.md`, `IMPLEMENTATION_LOG.md`.
- Decision : developpement et integration dans `dev` uniquement ; migration pnpm dans un worktree dedie, a soumettre pour review.
- Verification : `git fetch origin`, inspection des branches et `git diff --check`.
- Probleme : aucun ; les modifications documentaires preexistantes sont incluses dans le commit d'initialisation autorise.
- Suite : publier `dev`, puis migrer le gestionnaire de paquets dans la branche de travail.

### 2026-09-21 - Migration Npm Vers Pnpm

- Travail : `dev` initialisee et publiee sur `origin/dev` avec les instructions validees ; migration realisee dans `codex/pnpm-migration`, worktree voisin `Ai-agent-browser-navigator-worktrees/pnpm-migration`.
- Fichiers : `package.json`, suppression de `package-lock.json`, creation de `pnpm-lock.yaml` et `pnpm-workspace.yaml`, `next.config.ts`, `README.md`, `AGENTS.md`, `docs/WORKTREE_WORKFLOW.md` et ce journal.
- Decisions : pnpm 11.15.1 epingle, Node >=20.19, import du verrou npm via `pnpm import` ; versions de toutes les dependances directes conservees. Scripts de dependances autorises explicitement ; generation Prisma via `postinstall`. Commandes documentees migrees vers pnpm.
- Compatibilite : `nodeLinker: hoisted` evite la resolution d'un client Prisma 5 vide dans la structure isolee sous Windows ; racines Turbopack et tracage Next.js fixees au dossier courant pour isoler chaque worktree des lockfiles parents.
- Verifications finales : installation neuve `pnpm install --frozen-lockfile`, `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run build`, resolution runtime des modeles Prisma, comparaison des versions directes avec le verrou npm et `git diff --check`, reussis. Aucun changement de schema, migration DB ou deploiement effectue.
- Problemes resolus : scripts de dependances initialement bloques par pnpm ; types Prisma absents en disposition isolee ; inference incorrecte de la racine Next.js depuis un verrou npm hors depot.
- Limite locale : le controle automatique a refuse la suppression de la sauvegarde temporaire des dependances. Les dossiers de sauvegarde sous `.next/` restent ignores par Git ; aucun contournement du refus n'a ete effectue.
- Source de la conversion : https://pnpm.io/cli/import .
- Etape suivante : review de la migration, puis fusion dans `dev` apres validation explicite selon le workflow ; aucun serveur de test laisse actif.
