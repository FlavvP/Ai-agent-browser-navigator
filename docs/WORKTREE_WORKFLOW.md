# Workflow Codex Avec Git Worktrees

## Objectif

Chaque chat Codex dispose d'un espace de travail Git isole pendant chaque cycle d'implementation. Le chat reste rattache au checkout principal `Ai-agent-browser-navigator`, mais execute les lectures, modifications et commandes de developpement dans son worktree.

La regle d'identite est : **un chat = un seul worktree et une seule branche actifs a la fois**. Le worktree appartient au cycle d'implementation du chat, pas a une fonctionnalite individuelle. Plusieurs fonctionnalites, retours de review et corrections demandes tant que ce cycle est actif reutilisent donc toujours le meme worktree.

Apres validation, fusion et suppression du worktree, le cycle est clos. Une nouvelle demande d'implementation dans la meme conversation peut alors creer une nouvelle branche et un nouveau worktree en reprenant le workflow depuis le debut.

Les demandes de conseil, recherche, diagnostic sans modification ou review en lecture seule ne necessitent pas de worktree.

## Role Des Branches

- `main` reste la branche de reference. Le deploiement est hors du perimetre actuel.
- `dev` est la branche d'integration et la base normale de toutes les fonctionnalites et corrections.
- `codex/<slug>`, `feature/<slug>` et `fix/<slug>` sont des branches de travail temporaires creees depuis `dev` et isolees dans un worktree.
- Une branche de travail validee est fusionnee dans `dev`.

Il est interdit d'implementer directement sur `main` ou `dev`.

## Adoption Et Initialisation De Dev

`dev` est la branche d'integration. Les instructions suivantes permettent de l'initialiser dans un nouveau clone si necessaire.

Avant le premier cycle, verifier les branches distantes avec `git fetch origin`. Si `origin/dev` existe, creer la branche locale de suivi si necessaire. Si `dev` n'existe ni localement ni sur le distant, l'initialiser depuis `main` propre et synchronise avec `origin/main`, puis publier `dev` avec `git push -u origin dev`. Conserver tout changement local preexistant et le faire integrer dans un commit au perimetre identifie avant cette initialisation ; ne jamais le supprimer ou le stasher silencieusement. Ne pas poursuivre la creation du worktree tant que ces preconditions ne sont pas satisfaites.

## Creation Au Premier Travail D'Implementation

Avant toute modification, l'agent doit :

1. identifier le checkout principal avec `git worktree list` ;
2. verifier que le checkout principal et `dev` ne contiennent aucun changement local ;
3. recuperer les references distantes et synchroniser `dev` avec `origin/dev` par avance rapide uniquement ;
4. verifier que la base `dev` contient les changements de reference necessaires ;
5. choisir un slug court, explicite et unique pour le chat ;
6. creer une branche `codex/<slug>` et un worktree voisin dans `Ai-agent-browser-navigator-worktrees/<slug>`, a partir de `dev`.

Exemple PowerShell depuis le checkout principal :

```powershell
git status --short --branch
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch main
New-Item -ItemType Directory -Force -Path "..\Ai-agent-browser-navigator-worktrees" | Out-Null
git worktree add "..\Ai-agent-browser-navigator-worktrees\workspace-tools" -b "codex/workspace-tools" dev
```

Si le checkout principal ou `dev` n'est pas propre, si la branche ou le dossier existe deja, si la mise a jour en avance rapide est impossible ou si la base de travail est incomplete, l'agent doit s'arreter et expliquer le blocage. Il ne doit ni ecraser des fichiers ni employer une suppression forcee.

Si le chat possede deja un worktree actif, cette etape ne doit pas etre repetee. Toutes les demandes d'implementation suivantes utilisent le worktree existant, y compris lorsqu'elles concernent une autre fonctionnalite. Cette etape redevient applicable uniquement apres la fusion et la suppression completes du worktree precedent.

## Travail Dans Le Worktree

Chaque commande doit cibler explicitement le worktree du chat. La session peut rester ouverte dans `Ai-agent-browser-navigator` : elle n'a pas besoin de changer le workspace VS Code.

Exemple :

```powershell
git -C "..\Ai-agent-browser-navigator-worktrees\workspace-tools" status
npm --prefix "..\Ai-agent-browser-navigator-worktrees\workspace-tools" run lint
```

L'agent doit installer les dependances dans le worktree si necessaire, lire les instructions du projet depuis ce worktree, puis limiter tous ses changements et commits a la branche du chat.

## Configuration Et Verifications Du Projet

- Utiliser npm et le `package-lock.json` du worktree : `npm ci`.
- Preparer le `.env` local depuis `.env.example` ou la configuration locale autorisee, sans afficher ni committer de secrets. Les fichiers ignores ne sont pas copies automatiquement par Git dans un worktree.
- Verifier PostgreSQL, la configuration Prisma et les dependances Docker necessaires aux parcours testes. Ne pas lancer de reset, migration destructive ou nettoyage de volumes sur les donnees partagees avec un autre chat. Utiliser une base de test distincte pour les changements de schema.
- Executer les controles pertinents disponibles : `npm run lint`, `npx tsc --noEmit` et `npm run build`, ainsi que les tests cibles ou parcours manuels utiles. Aucun script `npm test` ou `npm run typecheck` n'est actuellement declare. Une modification purement documentaire peut etre verifiee par lecture, controle des liens et `git diff --check`.
- Consigner les travaux et validations dans `IMPLEMENTATION_LOG.md` depuis le worktree ; garder les instructions durables dans `AGENTS.md`.

## Serveurs De Developpement

Lancer le serveur avec `npm run dev -- --port 0` pour demander un port disponible. La sortie Next.js fait foi et affiche l'URL exacte :

```text
- Local: http://localhost:<port>
```

Ne jamais supposer que le port est `3000`. Recopier l'URL `Local` exacte dans le message de review. Si une integration exige une URL stable, choisir un port libre explicite avec `npm run dev -- --port <port>` et adapter la configuration locale d'authentification et les callbacks OAuth si necessaire.

Ne pas lancer deux serveurs Next.js simultanement dans le meme worktree. Les verifications doivent viser le serveur du worktree courant, jamais celui d'une autre branche. Ne pas arreter les processus d'un autre chat.

Tout serveur ou processus persistant demarre dans un worktree doit etre arrete avant la fusion et la suppression du worktree.

## Livraison Pour Review

Quand l'implementation est terminee, l'agent doit :

1. executer les controles pertinents ;
2. committer tous les changements sur `codex/<slug>` ;
3. verifier que le worktree est propre ;
4. ne pas fusionner ;
5. annoncer que l'implementation est prete pour review.

Le message doit contenir au minimum la branche, le chemin absolu du worktree et les commandes guidees :

```powershell
cd "C:\chemin\absolu\Ai-agent-browser-navigator-worktrees\workspace-tools"
npm ci
npm run dev -- --port 0
```

Si le serveur est deja lance, le message doit aussi donner son URL `Local` exacte. Sinon, il doit preciser que `npm run dev -- --port 0` affichera le port attribue.

Une review negative ne declenche aucune fusion ni aucun nettoyage. L'agent continue dans la meme branche et le meme worktree, corrige, teste, committe et soumet de nouveau le resultat.

## Validation, Fusion Dans Dev Et Nettoyage

La fusion est autorisee uniquement apres une validation positive et explicite de l'utilisateur. L'agent doit alors :

1. arreter les processus du worktree ;
2. verifier que le worktree est propre et que tout est committe ;
3. verifier que le checkout principal est sur `dev` et propre ;
4. recuperer `origin/dev` et mettre `dev` a jour en avance rapide uniquement ;
5. integrer le `dev` actualise dans la branche du chat si necessaire, resoudre et verifier les conflits dans le worktree ;
6. fusionner la branche dans `dev` avec un commit de merge explicite ;
7. executer sur `dev` les tests, le lint, le typecheck et le build pertinents ;
8. pousser `dev` uniquement si toutes les verifications reussissent ;
9. supprimer le worktree avec `git worktree remove`, puis supprimer la branche avec `git branch -d` ;
10. executer `git worktree prune`, puis confirmer que `dev` est propre et synchronise et que `main` n'a pas ete modifie.

Exemple de commandes de nettoyage depuis `Ai-agent-browser-navigator` apres une fusion dans `dev` verifiee et poussee :

```powershell
git worktree remove "..\Ai-agent-browser-navigator-worktrees\workspace-tools"
git branch -d "codex/workspace-tools"
git worktree prune
git status --short --branch
```

Ne jamais employer `git worktree remove --force` ou `git branch -D` dans le workflow normal. En cas de conflit, de tests en echec, de changements non commites ou de verrou Windows, conserver le worktree et signaler le probleme.

La suppression clot le cycle actif du worktree. Si une nouvelle implementation est demandee plus tard dans la meme conversation, l'agent recommence le workflow de creation et ouvre un nouveau cycle avec une nouvelle branche et un nouveau worktree. Il ne doit jamais y avoir deux worktrees actifs simultanement pour le meme chat.
