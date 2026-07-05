# Agent Web Chat + Workspace Agentique

## Vision Produit

Le produit est une application web de chat IA proche de ChatGPT. Elle propose deux modes :

1. **Mode classique** : conversation textuelle avec l'assistant, historique des conversations, persistance locale, appels a l'API OpenAI, puis outils web API classiques.
2. **Mode agentique avance** : activation d'un workspace distant. L'interface passe en split-screen avec le stream de la machine a gauche et le chat a droite. A terme, le workspace permettra d'utiliser un navigateur, un terminal, le systeme de fichiers et des outils d'automatisation.

Le workspace avance ne doit pas etre pense comme un simple navigateur. C'est un environnement de travail distant complet.

## Regle De Memoire Longue

Apres chaque etape importante terminee, mettre a jour ce fichier avec un mini-recap :

- ce qui a ete fait ;
- les fichiers crees ou modifies ;
- les decisions prises ;
- les tests executes ;
- les problemes rencontres ;
- l'etape suivante.

Ce fichier doit permettre a une personne sans contexte de comprendre le projet, son architecture, son etat actuel et la prochaine action a mener.

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
  AGENT.md
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
- [x] Mettre a jour ce fichier avec le recap MVP 1.

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
- Garder ce fichier a jour.
- Ne jamais stocker de mots de passe de sites tiers en base ; seuls les cookies/sessions peuvent persister dans le volume workspace.
- Garder `WORKSPACE_IMAGE` configurable car l'image Selkies exacte peut evoluer.

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
