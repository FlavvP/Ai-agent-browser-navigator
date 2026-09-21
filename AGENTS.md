# Agent Web Chat + Workspace Agentique

## Vision Produit

Le produit est une application web de chat IA proche de ChatGPT. Elle propose deux modes :

1. **Mode classique** : conversation textuelle avec l'assistant, historique des conversations, persistance locale, appels a l'API OpenAI, puis outils web API classiques.
2. **Mode agentique avance** : activation d'un workspace distant. L'interface passe en split-screen avec le stream de la machine a gauche et le chat a droite. A terme, le workspace permettra d'utiliser un navigateur, un terminal, le systeme de fichiers et des outils d'automatisation.

Le workspace avance ne doit pas etre pense comme un simple navigateur. C'est un environnement de travail distant complet.

## Regle De Memoire Longue

Apres chaque etape importante terminee, ajouter une entree datee dans [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md) avec un mini-recap :

- ce qui a ete fait ;
- les fichiers crees ou modifies ;
- les decisions prises ;
- les tests executes ;
- les problemes rencontres ;
- l'etape suivante.

Le journal doit permettre a une personne sans contexte de comprendre les travaux effectues, leur validation et la prochaine action a mener. Consulter ses dernieres entrees pour retrouver le contexte recent.

Ne pas ajouter de logs d'implementation ou de recapitulatifs chronologiques dans `AGENTS.md`, `AGENT.md` ou `CLAUDE.md`. Garder les instructions durables, l'architecture et la roadmap dans `AGENTS.md`, et ne les modifier que lorsqu'elles evoluent. Le journal d'implementation est distinct des logs d'execution de l'application decrits dans la section Politique De Logs.

## Workflow Git Et Worktrees

Le workflow complet est defini dans [docs/WORKTREE_WORKFLOW.md](docs/WORKTREE_WORKFLOW.md). Le lire et le suivre avant tout nouveau cycle d'implementation, y compris documentaire.

- Une conversation utilise un seul worktree et une seule branche de travail actifs a la fois. Reutiliser ce worktree pour toutes les demandes successives jusqu'a la fin du cycle.
- `main` reste la branche de reference ; `dev` est la branche d'integration et la base normale des travaux. Le deploiement est hors du perimetre actuel.
- Creer le worktree avant la premiere modification, depuis un `dev` propre, synchronise avec `origin/dev`. Suivre la procedure d'initialisation documentee si `dev` n'existe pas encore.
- Utiliser une branche temporaire `codex/<slug>`, `feature/<slug>` ou `fix/<slug>` et un dossier voisin `Ai-agent-browser-navigator-worktrees/<slug>`.
- Ne jamais implementer directement sur `dev` ou `main`. Les recherches et reviews en lecture seule ne necessitent pas de worktree.
- Tester, mettre a jour `IMPLEMENTATION_LOG.md`, committer les changements du cycle et livrer pour review avec la branche, le chemin absolu du worktree et les commandes ou l'URL de test.
- Ne jamais fusionner sans validation explicite de l'utilisateur. Une review negative continue dans le meme worktree ; une review positive autorise la fusion dans `dev`, les verifications sur l'etat fusionne, le push et le nettoyage.
- Arreter les processus du worktree avant fusion et suppression. Ne jamais forcer la suppression d'un worktree contenant des changements non commites ni ecraser les modifications d'un autre chat.
- Apres fusion et suppression du worktree, une nouvelle implementation dans le meme chat ouvre un nouveau cycle avec une nouvelle branche et un nouveau worktree.

## Stack Technique

MVP 1 :

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui style local
- lucide-react
- Prisma
- PostgreSQL
- Prisma est verrouille en v5.22.0 pour eviter les changements de configuration Prisma 7.
- La base locale PostgreSQL est lancee via Docker Compose.
- OpenAI API officielle
- npm

Evolution SaaS :

- Auth.js / NextAuth
- service workspace/VM separe
- streaming VM via noVNC, WebRTC ou equivalent
- workers/background jobs pour taches longues

## Architecture Cible

```text
agent-browser-navigator/
  IMPLEMENTATION_LOG.md
  AGENTS.md
  CLAUDE.md
  README.md
  .env.example
  package.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  prisma/
    schema.prisma
    migrations/
  src/
    app/
      layout.tsx
      page.tsx
      globals.css
      api/
        chat/
          route.ts
        conversations/
          route.ts
        conversations/[conversationId]/
          route.ts
        workspace/
          start/
            route.ts
          stop/
            route.ts
    components/
      app-shell/
      chat/
      workspace/
      ui/
    lib/
      ai/
      db/
      utils/
      workspace/
    types/
```

## Responsabilites Des Dossiers

- `src/app/` : pages Next.js et routes API.
- `src/components/app-shell/` : layout global, sidebar, structure de l'application.
- `src/components/chat/` : interface conversationnelle.
- `src/components/workspace/` : panneaux et etats du mode workspace.
- `src/components/ui/` : primitives UI reutilisables.
- `src/lib/db/` : acces Prisma et requetes DB.
- `src/lib/ai/` : appels OpenAI, prompts et orchestration.
- `src/lib/ai/tools/` : outils agentiques.
- `src/lib/workspace/` : abstraction workspace, mock puis vraie VM.
- `src/lib/utils/` : helpers purs.
- `src/types/` : types partages.
- `prisma/` : schema et migrations DB.

## Conventions De Code

- Garder les fichiers courts et mono-responsabilite.
- Ne pas mettre de logique OpenAI dans les composants React.
- Ne pas mettre de logique DB directement dans les composants.
- Ne jamais exposer `OPENAI_API_KEY` cote client.
- Les tools doivent etre executes cote serveur.
- Chaque resultat de tool envoye au LLM doit etre enveloppe avec `agent_instruction` et `tool_result`.
- Les titres de conversations sont generes cote serveur au premier message utilisateur avec `OPENAI_TITLE_MODEL`, puis nettoyes et limites a 5 mots cote backend.
- Le mode workspace doit rester generique, pas limite au navigateur.
- Le MVP 1 ne doit pas inclure d'auth, de vraie VM ou de billing.
- Les workspaces peuvent etre actifs en parallele dans plusieurs conversations d'un meme utilisateur.
- Le profil Chromium de conversation conserve les onglets et la session de navigation de cette conversation.
- Le profil Chromium utilisateur conserve l'identite web partagee entre conversations, avec une synchronisation last-writer-wins lors des arrets propres.
- L'arret explicite du workspace ferme Chromium proprement avant suppression du container.
- L'idle timeout ne coupe qu'un workspace non visible et sans activite recente.
- Les generations agent longues sont representees par `AgentRun` et ne dependent pas du maintien du stream HTTP client.

## Politique De Logs

Les logs sont une partie importante du produit, car l'agent workspace combine plusieurs couches difficiles a debugguer : OpenAI, tools backend, Docker, Selkies/WebRTC, Chromium, AT-SPI2 et input OS.

Objectif : reconstruire une session complete par utilisateur et conversation.

Structure :

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

Variables :

```env
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

Modes :

- logs desactives : `LOG_ENABLED=false`.
- debug normal : `LOG_ENABLED=true`, `LOG_OPENAI=false`, `LOG_RAW_SNAPSHOTS=false`.
- debug complet : `LOG_ENABLED=true`, `LOG_ALL=true`, `LOG_OPENAI=true`, `LOG_RAW_SNAPSHOTS=true`.
- debug workspace uniquement : activer `LOG_WORKSPACE`, `LOG_AUTOMATION`, `LOG_BROWSER`, `LOG_COMPACT_SNAPSHOTS`, `LOG_RAW_SNAPSHOTS` et desactiver le reste.

Categories :

- `LOG_AGENT` : mode courant, tools disponibles, decisions du modele, changement de mode, reponse finale.
- `LOG_OPENAI` : artefacts JSON requete/reponse OpenAI. Potentiellement sensible.
- `LOG_TOOLS` : inputs/outputs resumes, erreurs, duree des tools.
- `LOG_WORKSPACE` : Docker, ports, `streamUrl`, `automationUrl`, lifecycle start/stop.
- `LOG_AUTOMATION` : appels au service Python automation et extraits de `/config/log/agent-automation.log`.
- `LOG_BROWSER` : extraits de `/config/log/chromium.log`.
- `LOG_COMPACT_SNAPSHOTS` : snapshot envoye au LLM.
- `LOG_RAW_SNAPSHOTS` : arbre AT-SPI2 brut. Tres volumineux, a n'activer que pour debug.

Regles :

- garder `LOG_OPENAI=false` par defaut ;
- garder `LOG_RAW_SNAPSHOTS=false` par defaut ;
- ne jamais logger de secrets volontairement ;
- garder `LOG_REDACT_SECRETS=true` ;
- considerer les logs comme sensibles car ils peuvent contenir des URLs, textes de pages, noms, donnees utilisateur ou fragments de session.

Diagnostic "le stream affiche la page mais l'agent voit vide" :

1. `workspace.log` confirme le container, les ports, le stream et le navigateur.
2. `container-logs/*chromium*.json` montre les erreurs Chromium et les problemes de profil.
3. `automation.log` montre les appels `/snapshot`, les durees et stats.
4. `snapshots/*raw*.json` montre ce qu'AT-SPI2 voit vraiment.
5. `snapshots/*compact*.json` montre ce que le LLM recoit.

Si le raw est vide, le probleme est cote accessibilite/session graphique. Si le raw contient la page mais pas le compact, le probleme est dans le filtrage/compression.

## Politique Workspace Et AgentRun

- Lancement uniforme : bouton UI, tool agent et dashboard debug doivent passer par `startWorkspaceBrowser`.
- Multi-workspace : chaque conversation utilise un volume Docker `workspace-conversation-{conversationId}` monte sur le profil Chromium de travail.
- Identite partagee : le volume `workspace-profile-{userId}` est monte separement et sert a propager cookies/storage utiles entre conversations.
- Changement de conversation : ne stoppe jamais le container precedent.
- Fermeture de l'application locale : ne stoppe pas immediatement le workspace; le janitor applique `WORKSPACE_IDLE_TIMEOUT_MINUTES`.
- Activite workspace : start, snapshot, click, fill, press et scroll mettent a jour `lastActivityAt`; le polling de statut quand le panneau est visible met a jour `lastVisibleAt`.
- Watchdog Chromium : si la fenetre Chromium est fermee dans la VM, elle est relancee avec le profil conversation pour restaurer les onglets.
- AgentRun : `/api/chat` cree un run persistant en base; le stream UI est seulement un abonnement au run. Le bouton stop appelle l'annulation serveur.
- Limite actuelle : un redemarrage complet du serveur Next.js ne reprend pas les runs en cours; ils doivent etre consideres interrompus.

## Roadmap

### Phase 0 - Nettoyage Et Pilotage

- [x] Supprimer l'ancien `windows-uia-mcp/`.
- [x] Supprimer `PROJET_AGENT_NAVIGATEUR.md`.
- [x] Verifier que le dossier projet est vide.
- [x] Creer `AGENT.md`.
- [x] Documenter vision, stack, architecture, roadmap, workflows et points de vigilance.

### MVP 1 - Socle Web Local

- [x] Initialiser Next.js TypeScript.
- [x] Installer Tailwind, lucide-react et dependances UI.
- [x] Installer Prisma + SQLite.
- [x] Installer SDK OpenAI officiel.
- [x] Creer `.env.example`.
- [x] Definir schema Prisma initial.
- [x] Creer tables `Conversation`, `Message`, `WorkspaceSession`, `ToolEvent`.
- [x] Implementer sidebar conversations.
- [x] Implementer nouvelle conversation.
- [x] Implementer affichage messages.
- [x] Implementer input chat.
- [x] Implementer sauvegarde messages utilisateur/assistant.
- [x] Implementer `/api/chat`.
- [x] Brancher OpenAI API.
- [x] Ajouter mode workspace mocke.
- [x] Ajouter split-screen workspace/chat.
- [x] Ajouter bouton pour quitter le mode workspace.
- [x] Consigner le recap MVP 1 dans `IMPLEMENTATION_LOG.md`.

### MVP 2 - Tools Web API Classiques

- [x] Creer systeme interne de tools backend.
- [x] Ajouter `web_search` via Serper.dev.
- [x] Ajouter `read_url` via extraction HTML maison.
- [x] Retirer `summarize_page` du MVP 2.
- [x] Enregistrer chaque tool call dans `ToolEvent`.
- [x] Afficher les tool calls dans la conversation.
- [x] Ajouter prompt systeme du mode classique.
- [x] Ajouter gestion d'erreurs et timeouts.

### MVP 3 - Authentification Et Multi-Utilisateur

- [x] Installer Auth.js / NextAuth.
- [x] Ajouter modeles `User`, `Account`, `Session`.
- [x] Ajouter connexion Google et email/password.
- [x] Ajouter creation de compte email/password.
- [x] Lier conversations a un utilisateur.
- [x] Proteger toutes les routes API metier.
- [x] Verifier isolation des donnees utilisateur.

### MVP 4 - Migration SaaS Et PostgreSQL

- [x] Remplacer SQLite par PostgreSQL.
- [x] Adapter `DATABASE_URL`.
- [x] Ajouter migration initiale PostgreSQL.
- [x] Decider de ne pas ajouter de seed minimal pour l'instant.
- [x] Ajouter index utiles.

### MVP 5 - Workspace Reel Avec VM Linux

- [x] Creer abstraction `WorkspaceProvider`.
- [x] Garder `MockWorkspaceProvider`.
- [x] Ajouter `DockerSelkiesWorkspaceProvider`.
- [x] Ajouter routes start/stop/status.
- [x] Ajouter `streamUrl`.
- [x] Demarrer un container Linux a la demande.
- [x] Afficher le stream a gauche du chat.
- [x] Gerer etats `starting`, `running`, `stopped`, `failed`.

### MVP 6 - Tools Workspace Navigateur

- [x] Installer navigateur dans l'image workspace.
- [x] Installer stack accessibilite Linux.
- [x] Lire arbre AT-SPI2.
- [x] Ajouter `workspace_snapshot`.
- [x] Ajouter `workspace_click`.
- [x] Ajouter `workspace_fill`.
- [x] Ajouter `workspace_press`.
- [x] Ajouter `workspace_scroll`.
- [x] Nettoyer et compresser les snapshots.
- [x] Envoyer au LLM uniquement des refs symboliques.
- [x] Garder coordonnees cote backend/service automation.

### MVP 7 - Tools Workspace Terminal Et Fichiers

- [ ] Ajouter `workspace_open_terminal`.
- [ ] Ajouter `workspace_run_command`.
- [ ] Ajouter `workspace_read_file`.
- [ ] Ajouter `workspace_create_file`.
- [ ] Ajouter `workspace_edit_file`.
- [ ] Ajouter `workspace_list_files`.
- [ ] Ajouter garde-fous commandes sensibles.

### MVP 8 - Prompt Et Orchestration Agentique

- [ ] Definir prompt mode classique.
- [ ] Definir prompt mode workspace.
- [ ] Ajouter contexte `workspaceStatus`.
- [ ] Donner les tools selon le mode actif.
- [ ] Ajouter regles human-in-the-loop.

### MVP 9 - Produit SaaS Complet

- [ ] Ajouter organisations.
- [ ] Ajouter roles et permissions.
- [ ] Ajouter quotas.
- [ ] Ajouter billing.
- [ ] Ajouter monitoring.
- [ ] Ajouter nettoyage automatique VM.
- [ ] Ajouter export/suppression donnees.

## Decisions Techniques Structurantes

Cette section resume les decisions prises pendant la conception. Elle est volontairement detaillee pour qu'une personne qui arrive sur le projet sans connaitre la conversation puisse comprendre pourquoi l'architecture est faite ainsi.

### Principe Central : Le LLM Doit Avoir Le Moins De Responsabilite Possible

Le modele ne doit pas calculer de coordonnees, deviner la position d'un bouton, manipuler directement la souris ou inventer l'etat du workspace.

Le backend doit prendre en charge tout ce qui peut etre deterministe :

- detection de l'etat courant de la conversation ;
- selection des tools disponibles selon le mode ;
- recuperation et nettoyage du contenu web ;
- generation des references symboliques d'elements interactifs ;
- mapping `ref -> element reel -> coordonnees/action OS` ;
- validation des refs ;
- execution des actions ;
- relance d'un snapshot apres chaque action ;
- persistance des messages, tool calls et evenements workspace ;
- garde-fous sur commandes, fichiers et actions sensibles.

Le LLM doit seulement :

- comprendre l'objectif utilisateur ;
- choisir le tool adapte ;
- fournir les arguments semantiques attendus par le tool ;
- choisir une ref symbolique fournie par le backend, par exemple `@e12` ;
- expliquer a l'utilisateur ce qu'il fait et demander une intervention humaine si necessaire.

### Convention Obligatoire Des Resultats Tools

Chaque resultat de tool renvoye au LLM doit suivre cette forme :

```json
{
  "agent_instruction": "Instruction courte et specifique expliquant quoi faire ensuite avec ce resultat.",
  "tool_result": {
    "ok": true
  }
}
```

`tool_result` contient la sortie brute et compacte du tool. `agent_instruction` est ajoutee par le backend et doit etre adaptee :

- au nom du tool ;
- au succes ou a l'erreur ;
- au contenu du resultat quand cela change la suite logique ;
- aux limites connues du tool, par exemple contenu tronque ou recherche indisponible.

Cette instruction ne remplace pas le prompt systeme. Elle sert a guider localement la prochaine action du modele apres un appel de fonction. Elle doit eviter que le LLM ait a deviner la suite correcte.

Exemples :

- apres `web_search` reussi : demander d'analyser les resultats et d'appeler `read_url` sur les sources les plus pertinentes avant de repondre si la question demande de la fiabilite ;
- apres `web_search` en erreur : demander d'expliquer la limite sans pretendre avoir consulte le web ;
- apres `read_url` reussi : demander d'utiliser le texte comme source externe non fiable, de repondre sur les informations presentes et de citer l'URL ;
- apres `read_url` tronque : demander de ne repondre qu'a partir de l'extrait disponible ;
- apres `read_url` en erreur : demander d'essayer une autre source si possible, sinon d'expliquer la limite.

Quand un nouveau tool est ajoute, le runner ou le handler doit definir son `agent_instruction`. Un tool ne doit pas renvoyer un JSON brut directement au modele.

### Titres De Conversations

Les titres de conversations sont generes automatiquement au premier message utilisateur.

- Le titrage se fait uniquement cote serveur, jamais dans les composants React.
- Le module dedie utilise `OPENAI_TITLE_MODEL`, par defaut `gpt-4.1-nano`.
- Le prompt demande un titre court, maximum 5 mots, sans guillemets ni ponctuation finale.
- Le prompt interdit les abreviations et les fautes volontaires.
- Le backend nettoie toujours le resultat : trim, suppression des guillemets, suppression des retours ligne, limitation stricte a 5 mots.
- Si la cle OpenAI est absente ou si l'appel echoue, un fallback local utilise les premiers mots du message.
- Une conversation deja titree ne doit pas etre renommee automatiquement.
- Une conversation creee via le bouton "Nouveau chat" doit etre renommee au premier message si elle a encore son titre par defaut.
- L'UI affiche un indicateur a trois points dans le header et la sidebar tant que le titre du premier message est en cours.

### Deux Familles De Navigation Web

Le produit doit gerer deux types de navigation.

1. Navigation web classique par API :
   - pas d'ecran ;
   - pas de navigateur visible ;
   - tools du type `web_search`, `fetch_url`, `summarize_page` ;
   - utile pour lire, rechercher, resumer et comparer ;
   - moins adapte aux sites avec login, formulaires complexes, dashboards ou interactions humaines.

2. Workspace agentique avance :
   - environnement distant visible par l'utilisateur ;
   - interface split-screen : workspace a gauche, chat a droite ;
   - l'utilisateur peut suivre, reprendre la main, se connecter, passer une 2FA ou resoudre un CAPTCHA ;
   - le workspace n'est pas limite au navigateur : il doit pouvoir ouvrir navigateur, terminal, fichiers et outils systeme ;
- les actions se font via des tools backend, pas via des coordonnees donnees par le modele.
- Chromium est lance en mode `maximized` par defaut dans le workspace pour conserver les onglets et la barre d'adresse.
- Le service automation contient un watchdog navigateur qui relance Chromium sur la derniere URL demandee si la fenetre disparait, puis re-active et re-maximise la fenetre si l'utilisateur la minimise ou la restaure en petite taille.
- Le navigateur workspace est uniformise autour de Google au MVP : page de demarrage, bouton home et nouvel onglet doivent pointer vers `https://www.google.com`.
- L'interface replie automatiquement la sidebar des conversations des qu'une conversation passe en mode workspace.
- Selkies est verrouille par defaut en resolution `1366x768` a `96 DPI` via `SELKIES_IS_MANUAL_RESOLUTION_MODE`, pour eviter le rendu trop carre du 1024x768 initial.

### Strategie Browser/Workspace Retenue

Les pistes etudiees etaient :

- CDP/DevTools/Playwright : tres puissant, mais plus detectable et moins proche d'un utilisateur reel.
- Extension navigateur : acces DOM interessant, mais complexite forte et couplage navigateur.
- Screenshot + OCR : universel mais couteux, lent et moins fiable.
- Sauvegarde HTML via `Ctrl+S` : donne beaucoup de contenu, mais lent, intrusif, lourd en tokens et pas ideal a chaque tour.
- Accessibilite / UI Automation : donne une structure texte exploitable par le backend, avec roles, noms, et parfois coordonnees.

Pour le MVP agentique futur, la piste retenue est :

- utiliser un navigateur visible dans une session graphique ;
- lire l'arbre d'accessibilite expose par le navigateur ;
- compacter cet arbre en snapshot lisible par LLM ;
- envoyer au LLM seulement les elements utiles avec refs symboliques ;
- executer les actions par le backend via input OS ou API d'accessibilite ;
- relire un nouveau snapshot apres chaque action.

Sur Windows local, le prototype utilise Windows UI Automation. Sur Linux VM, l'equivalent cible sera AT-SPI2. Le contrat applicatif doit rester le meme, meme si l'implementation bas niveau change.

### Windows UI Automation Et Equivalent Linux

Windows UI Automation expose a un programme externe une representation d'interface utilisateur :

- fenetres ;
- boutons ;
- liens ;
- champs texte ;
- menus ;
- tabs ;
- textes ;
- roles ;
- noms accessibles ;
- etats ;
- rectangles/coordonnees ;
- parfois elements non visibles mais deja charges.

Ce contenu depend principalement :

- du navigateur ;
- du moteur de rendu ;
- de la facon dont le site expose son accessibilite ;
- de la virtualisation ou non de la page ;
- du fait que la fenetre soit visible/non minimisee.

Ce n'est pas exactement le DOM HTML. C'est l'arbre d'accessibilite produit par le navigateur pour les lecteurs d'ecran et outils d'assistance. Il peut contenir des elements offscreen deja charges, mais ce n'est pas garanti. Pour les pages virtualisees ou en infinite scroll, il faudra scroller et refaire des snapshots.

Sur Linux, l'equivalent technique est AT-SPI2 :

- utilise par les lecteurs d'ecran et outils d'accessibilite Linux ;
- fonctionne mieux dans une session graphique X11 controlee ;
- Wayland est plus restrictif pour l'automatisation globale ;
- une VM Linux avec session X11 est donc la cible la plus simple pour le produit agentique.

### Pourquoi Une VM Linux Pour Le Produit Final

La VM Linux permet :

- isolation par utilisateur/session ;
- environnement reproductible ;
- couts et automatisation plus simples que Windows Server dans beaucoup de cas ;
- controle du navigateur, du terminal et des fichiers ;
- affichage streamable dans l'interface web ;
- possibilite de laisser l'utilisateur interagir manuellement avec le workspace.

Le flux prevu :

```text
Utilisateur discute en mode classique
-> l'agent juge qu'un environnement interactif est necessaire
-> l'agent appelle start_workspace
-> backend cree WorkspaceSession
-> backend demarre ou reserve une VM Linux
-> backend recupere streamUrl
-> UI passe en split-screen
-> prompt et tools disponibles changent
-> l'agent agit via tools workspace
```

### Contrat Snapshot/Action Pour La Navigation Avancee

Le contrat est volontairement stable et independant du systeme bas niveau.

1. `workspace_snapshot`
   - lit l'arbre d'accessibilite ;
   - trouve la fenetre ou l'application cible ;
   - extrait les elements utiles ;
   - genere `snapshot_id` ;
   - genere des refs `@e1`, `@e2`, etc. ;
   - stocke cote backend le mapping complet ;
   - retourne au LLM une version compacte.

2. `workspace_click`
   - prend seulement une `ref` ;
   - refuse si la ref n'existe plus ou appartient a un ancien snapshot ;
   - retrouve l'element reel cote backend ;
   - verifie etat, visibilite et action possible ;
   - calcule la meilleure action ;
   - clique via API accessibilite ou input OS ;
   - attend brievement ;
   - relance `workspace_snapshot` ;
   - retourne le nouveau snapshot.

3. `workspace_fill`
   - prend `ref`, `text`, `mode` ;
   - verifie que la ref cible un champ editable ;
   - focus le champ ;
   - si `mode = replace`, selectionne le contenu existant ;
   - tape le texte ;
   - relance `workspace_snapshot`.

4. `workspace_press`
   - prend une touche ou combinaison whitelistee ;
   - au debut : `Enter`, `Tab`, `Esc`, `Backspace`, `Ctrl+A`, `Ctrl+F` ;
   - refuse les touches non prevues ;
   - relance `workspace_snapshot`.

5. `workspace_scroll`
   - prend `direction` et `amount` ;
   - scroll via input OS ;
   - relance `workspace_snapshot`.

Regles absolues :

- ne jamais exposer `click_at(x, y)` au LLM ;
- ne jamais demander au LLM de calculer une coordonnee ;
- garder les coordonnees uniquement cote backend ;
- chaque action retourne un nouveau snapshot ;
- chaque nouveau snapshot remplace l'ancien store actif ;
- les anciennes refs deviennent invalides ;
- le LLM ne peut agir que sur des refs du dernier snapshot.

### Nettoyage Et Compression Des Snapshots

L'arbre d'accessibilite brut peut etre tres volumineux et contenir beaucoup de bruit. Il faut donc un pipeline backend avant d'envoyer quoi que ce soit au LLM.

Pipeline cible :

```text
arbre accessibilite brut
-> normalisation roles/noms/etats
-> filtrage elements inutiles
-> detection elements interactifs
-> detection textes importants visibles/offscreen utiles
-> deduplication
-> scoring d'importance
-> generation refs
-> store backend complet
-> snapshot compact pour LLM
```

Informations envoyees au LLM :

- `snapshot_id` ;
- titre fenetre/page ;
- URL si disponible par l'UI ou par le navigateur ;
- liste compacte d'elements ;
- pour chaque element : `ref`, `role`, `name`, `kind`, `states`, contexte court.

Informations gardees uniquement backend :

- handle/process/window ;
- element object/accessibility node ;
- rectangle ;
- coordonnees ;
- parent/children bruts ;
- strategies d'action ;
- metadonnees de debug volumineuses.

### Pages Virtualisees Et Scroll

Certaines pages ne chargent pas tout le contenu dans l'arbre UI tant qu'on ne scrolle pas. D'autres exposent des elements offscreen deja charges. Il ne faut donc pas supposer que le snapshot contient toujours toute la page.

Strategie future :

- prendre un snapshot initial ;
- scroller par pages ;
- prendre de nouveaux snapshots ;
- fusionner des elements par identite stable approximative ;
- garder une memoire de page courte ;
- eviter de reutiliser une ref d'un ancien snapshot pour agir ;
- utiliser la memoire fusionnee seulement pour raisonner, pas pour cliquer directement.

## Plan Technique Detaille Par MVP

### MVP 1 - Socle Web Local

Objectif technique : disposer d'une application locale utilisable qui ressemble a ChatGPT et qui persiste les conversations.

Frontend :

- Next.js App Router ;
- page unique centree sur le chat, pas de landing page ;
- sidebar retractable avec conversations ;
- bouton nouvelle conversation ;
- conversation active au centre ;
- input en bas ;
- message utilisateur affiche immediatement via etat optimiste ;
- indicateur d'attente pendant la reponse assistant ;
- mode workspace mock avec split-screen.

Backend :

- routes API Next.js ;
- `/api/conversations` pour lister/creer ;
- `/api/conversations/[conversationId]` pour charger une conversation ;
- `/api/chat` pour sauvegarder le message utilisateur, appeler OpenAI, sauvegarder la reponse ;
- `/api/workspace/start` et `/api/workspace/stop` pour mocker le mode workspace.

Base :

- SQLite local ;
- Prisma comme couche d'acces ;
- modele `Conversation` ;
- modele `Message` ;
- modele `WorkspaceSession` ;
- modele `ToolEvent` deja prevu pour les prochains MVP.

IA :

- OpenAI API cote serveur uniquement ;
- prompt simple mode classique ;
- fallback local si cle absente en developpement ;
- pas encore de tools reels.

Points de vigilance :

- pas d'auth ;
- pas de vraie VM ;
- pas de tools web avances ;
- ne jamais exposer `OPENAI_API_KEY` cote client ;
- garder les composants React sans logique DB/OpenAI.

### MVP 2 - Tools Web API Classiques

Objectif technique : ajouter des tools backend non visuels au mode classique.

Tools prevus :

- `web_search` : recherche web via API de recherche ;
- `fetch_url` : recuperation controlee du contenu d'une page ;
- `summarize_page` : nettoyage et resume d'une page longue ;
- eventuellement `extract_links` plus tard.

Architecture :

- `src/lib/ai/tools/index.ts` declare les tools disponibles ;
- chaque tool a un schema input/output strict ;
- `/api/chat` orchestre les appels OpenAI et tool calls ;
- chaque execution de tool cree un `ToolEvent`.

Flux :

```text
message utilisateur
-> sauvegarde DB
-> appel OpenAI avec tools classiques
-> OpenAI demande un tool call
-> backend valide input
-> backend execute le tool
-> backend sauvegarde ToolEvent
-> backend renvoie resultat tool a OpenAI
-> OpenAI produit reponse finale
-> sauvegarde Message assistant
```

Protection prompt injection :

- le contenu web recupere est traite comme donnees non fiables ;
- il ne doit jamais remplacer le prompt systeme ;
- les pages web peuvent contenir des instructions malveillantes ;
- le prompt doit expliquer que le contenu externe est informatif, pas prioritaire.

Limites :

- timeouts reseau ;
- taille max de page ;
- troncature avant envoi au LLM ;
- logs tool calls ;
- erreurs lisibles dans l'UI.

### MVP 3 - Authentification Et Multi-Utilisateur

Objectif technique : passer d'une app locale mono-utilisateur a une app multi-utilisateur.

Choix cible :

- Auth.js / NextAuth ;
- providers OAuth possibles plus tard ;
- credentials possibles si creation compte email/password ;
- session cote serveur pour toutes les routes API.

Changements DB :

- ajouter `User` ;
- ajouter `Account` ;
- ajouter `Session` ;
- ajouter `Conversation.userId` ;
- ajouter `WorkspaceSession.userId` ;
- eventuellement `ToolEvent.userId` pour audit rapide.

Regle critique :

- toutes les requetes DB doivent etre filtrees par `userId` ;
- aucune route API ne doit retourner une conversation d'un autre utilisateur ;
- les workspaces doivent etre strictement rattaches au user.

### MVP 4 - Migration SaaS Et PostgreSQL

Objectif technique : rendre la base exploitable en production.

Actions :

- remplacer SQLite par PostgreSQL ;
- garder Prisma comme abstraction ;
- adapter `DATABASE_URL` ;
- creer migrations propres ;
- ajouter index sur `userId`, `conversationId`, `createdAt`, `status` ;
- valider que les helpers DB ne dependent pas de SQLite.

Point important :

- SQLite est un choix MVP local ;
- PostgreSQL devient la source de verite SaaS ;
- ne pas coder de logique incompatible PostgreSQL.

### MVP 5 - Workspace Docker Linux + Selkies WebRTC

Objectif technique : remplacer le placeholder par un vrai environnement distant.

Composants :

- `WorkspaceProvider` interface ;
- `MockWorkspaceProvider` pour dev ;
- `DockerSelkiesWorkspaceProvider` comme implementation principale locale ;
- service de lifecycle container ;
- stockage `WorkspaceSession` avec `status`, `provider`, `externalId`, `containerName`, `streamUrl`, `metadataJson` ;
- stockage `WorkspaceProfile` pour conserver un volume Docker de profil par utilisateur.

Etats :

- `mock` ;
- `starting` ;
- `running` ;
- `stopped` ;
- `failed`.

Routes :

- `POST /api/workspace/start` ;
- `POST /api/workspace/stop` ;
- `GET /api/workspace/status`.

Workflow :

```text
start_workspace
-> verifier conversation et user
-> creer ou retrouver WorkspaceProfile user
-> creer WorkspaceSession starting
-> reserver un port local dans WORKSPACE_PORT_START/END
-> lancer un container Docker base sur WORKSPACE_IMAGE
-> monter le volume workspace-profile-{userId}
-> mapper le port Selkies/WebRTC du container
-> exposer streamUrl
-> passer WorkspaceSession running
-> UI affiche le stream
```

Streaming :

- Selkies/WebRTC est la brique retenue pour le streaming ;
- Selkies reste une dependance d'infrastructure dans le container, pas du code integre au frontend Next.js ;
- l'image workspace est configurable via `WORKSPACE_IMAGE` ;
- `WORKSPACE_CONTAINER_PORT` et `WORKSPACE_PROFILE_MOUNT` permettent d'adapter l'app a l'image retenue ;
- pour `ghcr.io/linuxserver/baseimage-selkies:debiantrixie`, le port iframe HTTP est `3000`, tandis que `3001` correspond au websocket interne et ne doit pas etre utilise comme `streamUrl` ;
- `WORKSPACE_READY_DELAY_MS` garde l'interface en etat `STARTING` quelques secondes apres le HTTP ready pour eviter d'afficher l'iframe pendant la reconnexion initiale Selkies/WebSocket ;
- l'utilisateur doit voir l'ecran et pouvoir intervenir.

Persistance :

- 1 profil workspace persistant par utilisateur ;
- le container est jetable et supprime a l'arret ;
- le volume Docker profil est conserve pour garder cookies/session navigateur ;
- l'application ne stocke jamais les identifiants, mots de passe, codes 2FA ou credentials de sites tiers ;
- les cookies presents dans le volume sont sensibles et devront etre proteges en production ;
- une future action "reinitialiser mon profil workspace" sera necessaire.

Points de vigilance :

- arret automatique des containers ;
- nettoyage des containers orphelins ;
- isolation par utilisateur ;
- logs de lifecycle ;
- couts infra ;
- ne pas appeler ce mode `browser` car c'est un workspace complet.

### MVP 6 - Tools Workspace Navigateur Via Accessibilite

Objectif technique : permettre a l'agent d'agir dans le navigateur visible du workspace.

Bas niveau Linux cible :

- session graphique Linux controlee ;
- idealement X11 au depart pour faciliter l'automatisation ;
- navigateur compatible accessibilite ;
- AT-SPI2 pour lire l'arbre d'accessibilite ;
- input OS pour souris/clavier si necessaire.
- image custom `agent-browser-workspace:local` basee sur Selkies ;
- service Python interne expose sur `WORKSPACE_AUTOMATION_CONTAINER_PORT` ;
- backend Next.js appelle le service via `automationUrl` stockee dans `WorkspaceSession.metadataJson`.

Contrat tools :

- `workspace_snapshot({})` ;
- `workspace_click({ ref })` ;
- `workspace_fill({ ref, text, mode })` ;
- `workspace_press({ keys })` ;
- `workspace_scroll({ direction, amount })`.

Service automation :

```text
GET  /health
GET  /snapshot
GET  /raw_snapshot
POST /click
POST /fill
POST /press
POST /scroll
POST /shutdown_browser
```

Snapshot :

- lecture AT-SPI2 via Dogtail ;
- normalisation des roles AT-SPI2 vers des roles proches navigateur (`button`, `textbox`, `tab`, etc.) ;
- nettoyage des champs vides et caracteres objet `U+FFFC` ;
- filtrage des elements utiles ;
- deduplication et limites deterministes ;
- rendu LLM en liste minimale `refs[]` ;
- mapping complet garde dans le service Python ;
- seules les refs du dernier `snapshot_id` sont valides.

Snapshot :

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

Store backend :

- garde uniquement le dernier snapshot actif pour l'action directe ;
- mappe `@e1` vers l'objet accessibilite ou une representation actionnable ;
- garde rect/coordonnees/metadata ;
- invalide les refs au prochain snapshot.

Algorithme snapshot :

```text
lire fenetre active du workspace
-> parcourir arbre Dogtail/AT-SPI2
-> extraire roles utiles et labels propres
-> marquer action/input/text/navigation en refs
-> filtrer bruit
-> compacter labels, etats utiles et contenus
-> generer refs[] minimal pour le LLM
-> stocker mapping complet backend
-> retourner tool_result.refs au modele
```

Actions :

- click : ref seulement, backend calcule point/action ;
- fill : ref + texte, backend focus et tape ;
- press : whitelist stricte ;
- scroll : direction/amount, puis resnapshot.

Points de vigilance :

- le modele ne recoit jamais de coordonnees ;
- le modele ne peut pas agir sur une ancienne ref ;
- chaque action retourne un nouveau snapshot ;
- si raw snapshot est riche mais `tool_result.refs` vaut `[]`, verifier Dogtail/AT-SPI2 et les filtres de roles utiles ;
- si login/2FA/CAPTCHA/paiement/action sensible : demander l'utilisateur ;
- les pages virtualisees demanderont scroll + fusion dans une version suivante.

### MVP 7 - Tools Workspace Terminal Et Fichiers

Objectif technique : permettre au workspace de faire autre chose que naviguer.

Tools prevus :

- `workspace_open_terminal` ;
- `workspace_run_command` ;
- `workspace_list_files` ;
- `workspace_read_file` ;
- `workspace_create_file` ;
- `workspace_edit_file`.

Regles :

- commandes executees dans un repertoire de travail limite ;
- logs complets dans `ToolEvent` ;
- timeouts ;
- limite de taille output ;
- confirmation humaine pour commandes destructives ;
- denylist ou sandbox pour operations dangereuses ;
- distinction claire entre terminal et edition de fichiers.

### MVP 8 - Prompt Et Orchestration Agentique

Objectif technique : donner au modele le bon prompt et les bons tools selon l'etat.

Modes :

- classic : repondre, chercher via API, fetcher des pages, demarrer workspace si necessaire ;
- workspace starting : expliquer que le workspace demarre, eviter actions indisponibles ;
- workspace running : tools navigateur/terminal/fichiers disponibles ;
- workspace stopped/failed : ne pas inventer d'action workspace.

Orchestrateur :

- lit conversation ;
- lit workspace status ;
- construit prompt ;
- selectionne tools ;
- appelle OpenAI ;
- execute tool calls ;
- sauvegarde events ;
- renvoie reponse et etat UI.

Regles human-in-the-loop :

- login ;
- 2FA ;
- CAPTCHA ;
- paiement ;
- action irreversible ;
- acces donnees sensibles ;
- demande explicite de l'utilisateur de reprendre la main.

### MVP 9 - Produit SaaS Complet

Objectif technique : transformer le produit en SaaS exploitable.

Fonctions :

- organisations ;
- memberships ;
- roles ;
- quotas ;
- billing ;
- monitoring ;
- audit logs ;
- nettoyage automatique des workspaces ;
- export/suppression donnees ;
- gestion API keys ;
- parametrage utilisateur.

Securite :

- isolation stricte DB ;
- isolation VM ;
- expiration des sessions workspace ;
- chiffrement secrets si necessaire ;
- audit des actions agentiques ;
- politique de retention des donnees.

## Workflows Produit

### Chat Classique

```text
Utilisateur envoie un message
-> API sauvegarde le message utilisateur
-> API appelle OpenAI
-> API sauvegarde la reponse assistant
-> UI recharge/affiche la conversation
```

### Activation Workspace Mock

```text
Utilisateur ou agent active le workspace
-> API cree WorkspaceSession status=mock
-> Conversation passe en mode workspace
-> UI passe en split-screen
-> Placeholder workspace visible a gauche
```

### Workspace Reel Futur

```text
Agent appelle start_workspace
-> Backend cree WorkspaceSession
-> Workspace service demarre un container Linux Docker/Selkies
-> streamUrl retourne au frontend
-> UI affiche stream
-> Prompt et tools passent en mode workspace
```

### Workspace Docker/Selkies MVP 5

```text
Utilisateur active le workspace
-> API verifie session Auth.js
-> API verifie que la conversation appartient au user
-> service cree/reutilise WorkspaceProfile
-> service cree WorkspaceSession STARTING
-> service execute docker run avec labels app/user/conversation/session
-> service monte le volume profil utilisateur
-> service mappe le port local du stream
-> WorkspaceSession passe RUNNING avec streamUrl
-> UI affiche iframe Selkies
-> UI poll /api/workspace/status
-> stop supprime le container mais garde le volume profil
```

## Points De Vigilance

- Ne pas surcharger MVP 1.
- Ne pas coupler UI et orchestration agentique.
- Ne pas exposer les secrets au client.
- Ne pas nommer le workspace comme un simple navigateur.
- Ne pas donner de coordonnees au LLM dans le futur mode navigateur.
- Garder les refs symboliques et la mecanique cote backend.
- Garder les instructions durables de ce fichier a jour et consigner les recapitulatifs dans `IMPLEMENTATION_LOG.md`.
- Ne jamais stocker de mots de passe de sites tiers en base ; seuls les cookies/sessions peuvent persister dans le volume workspace.
- Garder `WORKSPACE_IMAGE` configurable car l'image Selkies exacte peut evoluer.
