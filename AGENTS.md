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
- Étape 2 (2 novembre 2026, faite, liste d'Anaïs) : textes et personnages, visuels de Galopins gardés en attendant.
  - Boissons (`DRINK_NAMES`, `src/config.js`) : IPA → Chocolat (au maintien, zone dorée), stout → Matcha (lancé, infuse, repris), spritz → Expresso, shot → Croissant. L'inversion de Michel suit Anaïs : chocolat ⇄ matcha, expresso ⇄ croissant.
  - Personnages : Max → Etienne (le barista joué), Alex → Michel (la blague de trop : il raconte une blague salace, censurée « ★#@! », Etienne est mal à l'aise, commandes inversées et points ×2), Hugo → Fabien (la visite client, même rush), Jérémie → Marie (contrôle qualité sur le chocolat ; au second passage elle sort de sa séance, « affamée », et un croissant donne +300).
  - Bonus de Michel (seul changement de logique, demande d'Anaïs « bonus si pas d'erreur ») : à la fin de l'effet, +500 si au moins une commande servie et aucune erreur (`alexCleanBonus`, `alexEndEffect`, `src/core.js`) ; addition : « Blague de Michel · zéro faute +500 ». Au simulateur : menu Michel −1 % (bon) et +3 % (expert) face au menu Marie.
  - Identifiants du code inchangés (`alex`, `hugo`, `jeremie`, `ipa`…) : seuls les textes affichés changent. Nico a été remplacé par Antoine en v1.8.
- Étape 3 en cours. Boissons livrées (2 novembre 2026, v1.2) : `tools/pack-boissons.py` (planche 4 × 2, verre transparent gardé, une échelle commune, pied à y = 176) et `tools/pack-stout.py` pour le matcha en 6 étapes ; niveau du chocolat, surface et débordement recalés sur la tasse (`drawIllustratedGlass` et `CUP`, `src/render.js` : corps centré à −4,3, l’anse à droite, liquide de −1 à −28 ; la jauge de tirage `drawPullGauge` s’y cale depuis la v1.5.1). Michel (3 expressions et carton, `alex-*.png`) et Fabien (4 expressions et carton, `hugo-*.png`) livrés en v1.3-v1.4, découpés par `tools/pack-chatgpt.py`. Etienne (9 expressions, accueil) et Marie (5 expressions, carton ; `tools/pack-friend.py assets/sources/jeremie.png assets/characters/jeremie.webp 5`) livrés en v1.5, icône refaite avec Etienne et manifeste au nom de Volta (`tools/pack-icone.py`). Salle de Volta (v1.6, 3 novembre 2026) : `assets/sources/salle-profonde.png` → `assets/room/room-depth.webp` 720 × 960 (Pillow, WebP 88) ; « Ouvrir le comptoir » au lieu de « Ouvrir le bar ». Comptoir sombre (v1.7, 3 novembre 2026, « c'est mieux sombre ») : `tools/pack-comptoir.py` (bois de Galopins gardé en `assets/sources/comptoir-bois.webp`, assombri) → `assets/ui/service-wood.webp`, rebord en bois clair `#B9803F` / liseré `#E2AE62`, fond de repli `#2A201B` (`src/render.js`, `src/scene.js`, `src/story.js`, `src/style.css`). Référence de l'équipe pour ChatGPT : `docs/chatgpt/ref-equipe-volta.png`. Antoine, coach de la salle (v1.8, 3 novembre 2026), remplace Nico : planche `assets/sources/nico.png` → `assets/characters/nico.webp`, répliques de sport dans `TALK.nico` (`src/render.js`), clé « nico » gardée. Reste : 2 clients d'après les proches d'Anaïs pour remplacer Roxane et Jeremy (prompt en tête de `docs/chatgpt/prompts.md`), fond de story, aperçu des liens.
- Étape 3 : visuels de ChatGPT aux mêmes formats et noms de fichiers (voir `docs/chatgpt/prompts.md`, `assets/sources/LIRE-MOI.md`) ; `dist/apercu.jpg` et les icônes portent encore Galopins (`tools/pack-apercu.py`, `tools/pack-icone.py`).

## Structure, tests, décisions
Identiques à Galopins au 2 novembre 2026 : voir `docs/galopins-AGENTS.md` (sections Structure, Tester, Décisions prises). La page s'appelle toujours `dist/galopins-arcade.html` (nom interne, jamais montré au joueur).
Avant d'enregistrer : `node build.mjs`, `node test/sim.mjs 50`, `node test/rejeu.mjs 100`.

## Publier
- Cloudflare : Worker `volta` (nom identique dans `wrangler.jsonc`), branché sur ce dépôt par Workers Builds (Jérémie le branche dans le tableau de bord) ; adresse prévue https://volta.jeremie-normand.workers.dev. Chaque enregistrement sur `main` met en ligne.
- Classement : base D1 `volta-scores` à créer par Jérémie, puis décommenter la liaison dans `wrangler.jsonc` avec son identifiant. Sans elle, le jeu marche et le classement se cache.
- Page de test claude.ai de Volta : https://claude.ai/artifact/NXu5bxmxdXEdf9PmLZsY44 (republier `dist/galopins-arcade.html` sur cette URL, paramètre `url`). Jamais l'artifact de Galopins.
