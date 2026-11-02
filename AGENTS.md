# Volta Arcade — note commune (Claude, Codex)

Copie de Galopins Arcade (prototype 1.50, 2 novembre 2026) habillée pour Volta, l'entreprise d'Anaïs : un espace barista dans une salle de sport.
Mêmes mécaniques que Galopins (service de 2 minutes, plateau, tirage, perturbateurs, classement) ; seuls les visuels, les noms et les phrases changent.
Projet séparé : ne rien modifier dans le dépôt `galopins-arcade`, ne jamais publier sur ses liens.

## Travailler avec Jérémie et Anaïs
- Tout en français, court et direct. Ils préfèrent tester une version jouable que lire un document.
- Jérémie ne connaît pas Git ni GitHub : ne jamais lui demander de commande, le faire à sa place.
- Économiser : modifications ciblées, pas de réécriture de fichiers entiers, retours groupés.

## Thème
- `src/theme.js` : tout ce qui fait « Volta » (nom du jeu, du lieu, adresse, Instagram, adresse publique, mot du mode public). Les `{{marques}}` de `src/template.html` sont remplies par `build.mjs` avec ces valeurs.
- Instagram vide : pas de néon, pas de rappel sur le ticket, pas d'enseigne sur la story (« partage ton score »).
- Mode public : nom d'hôte qui contient `THEME.motPublic` (« volta »). Ailleurs (lien claude.ai, fichier local, `?test`) : mode test.
- Étape 1 (2 novembre 2026, faite) : nom, lieu, partages, story, Instagram, adresse publique, Worker.
- Étape 2 (à faire, d'après la liste d'Anaïs) : boissons (noms et phrases : IPA, stout, spritz, shot, pinte…), personnages (Max, Alex, Hugo, Jérémie, amis), répliques. Les mots sont dans `src/main.js`, `src/scene.js`, `src/coach.js`, `src/core.js`, `src/config.js` (`DRINK_NAMES`). Les mettre dans `src/theme.js` au fur et à mesure.
- Étape 3 : visuels de ChatGPT aux mêmes formats et noms de fichiers (voir `docs/chatgpt/prompts.md`, `assets/sources/LIRE-MOI.md`) ; `dist/apercu.jpg` et les icônes portent encore Galopins (`tools/pack-apercu.py`, `tools/pack-icone.py`).

## Structure, tests, décisions
Identiques à Galopins au 2 novembre 2026 : voir `docs/galopins-AGENTS.md` (sections Structure, Tester, Décisions prises). La page s'appelle toujours `dist/galopins-arcade.html` (nom interne, jamais montré au joueur).
Avant d'enregistrer : `node build.mjs`, `node test/sim.mjs 50`, `node test/rejeu.mjs 100`.

## Publier
- Cloudflare : Worker `volta` (nom identique dans `wrangler.jsonc`), branché sur ce dépôt par Workers Builds (Jérémie le branche dans le tableau de bord) ; adresse prévue https://volta.jeremie-normand.workers.dev. Chaque enregistrement sur `main` met en ligne.
- Classement : base D1 `volta-scores` à créer par Jérémie, puis décommenter la liaison dans `wrangler.jsonc` avec son identifiant. Sans elle, le jeu marche et le classement se cache.
- Page de test claude.ai de Volta : https://claude.ai/artifact/NXu5bxmxdXEdf9PmLZsY44 (republier `dist/galopins-arcade.html` sur cette URL, paramètre `url`). Jamais l'artifact de Galopins.
