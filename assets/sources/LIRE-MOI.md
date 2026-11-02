# Sources des visuels (ChatGPT)

Planches telles que ChatGPT les a livrées, sur fond vert pour le détourage (ou fond noir pour le néon).
Chaque fichier est utilisé par un outil de `tools/` ; une planche remplacée est supprimée (l'ancienne reste dans l'historique de GitHub).
Prompts et images de référence : `docs/chatgpt/`.

## Personnages
- `max-expressions.png` — Max, 9 expressions en grille 3 × 3, lues dans cet ordre : neutre, concentré, content / fier, oups, stressé / triste, blasé, pompette. Remises dans l'ordre du jeu par `MAX_ORDER` (`tools/pack-chatgpt.py`).
- `alex-expressions.png` — Alex, 3 expressions : neutre, rigolard qui tend un shot, vexé bras croisés.
- `hugo-expressions.png` — Hugo, grille 2 × 2 : neutre bras croisés, autoritaire qui tapote sa montre / fier pouce levé, déçu main sur le front.
- `alex-carton.png`, `hugo-carton.png` — poses des cartons d'arrivée (plateau de shots, montre).
- `max-accueil.png` — Max qui essuie un verre (accueil), coupe au bol comme en jeu.
- `nico.png`, `roxane.png`, `jeremy.png` — amis clients, 4 expressions sur une ligne (`tools/pack-friend.py`).

Outil : `python3 tools/pack-chatgpt.py` (équipe, accueil, cartons et décors ci-dessous), puis `node build.mjs`.

## Décors et objets
- `story-fond.png` (v1.43) — fond de l'image de story Instagram, portrait 941 × 1670 : salle avec clients attablés, cheval lumineux, Max pouce levé derrière le comptoir, aucun texte. Converti tel quel en `assets/ui/story-fond.webp` (WebP qualité 86, Pillow) ; titre, ticket, bulle et néon sont ajoutés par `src/story.js`.
- `neon-allume.png`, `neon-eteint.png` — cadre néon des enseignes (fond noir).
- `cloche.png` — cloche et potence de dernière commande.
- `rideau-lames.png`, `rideau-bas.png` — rideau métallique.
- `ticket.png` — ticket de caisse de l'addition.
- `ardoise.png` — ardoise encadrée (pause, top, cartons).
- `ardoise-stations.png` (v1.46) — grain de l'ardoise des stations (l'ancienne `station-slate.webp`), base de `tools/pack-slate.py`.
- `craie.png` — chope, étoile, flèche, cœur à la craie (plus utilisée depuis la v1.45, découpe désactivée).
- `boissons-volta.png` (Volta) — chocolat, matcha, expresso, croissant ; ligne du haut vide, du bas pleine (`tools/pack-boissons.py` → `assets/drinks/drinks.webp`).
- `matcha-etapes.png` (Volta) — matcha en 6 étapes, dans la colonne de la stout (`tools/pack-stout.py` → `assets/drinks/stout-steps.webp`).
- `classement.png` — médailles, trophée, couronne et lauriers (`tools/pack-rank.py`).
- `salle-profonde.png` — salle du bar (redimensionnée et floutée avec Pillow, voir AGENTS.md).
- `apercu.png` — image d'aperçu des liens partagés, paysage 3:2 sans texte (`tools/pack-apercu.py` → `dist/apercu.jpg`).

## Avant d'intégrer une nouvelle planche
Le vert du fond change d'une génération à l'autre : l'outil le mesure sur les bords. Vérifier l'ordre des expressions (ChatGPT ne le respecte pas toujours), comparer à taille égale avec les clients, puis supprimer la planche remplacée.
