# Demandes à ChatGPT

À joindre à chaque demande de personnage :
- **Image 1** : `ref-style-clients.png` — le style à suivre (clients du jeu).
- **Image 2** : `ref-equipe.png` — Max, Alex, Hugo tels qu'ils sont en jeu, de gauche à droite.

Ce qui marche : fond vert uni, cases 4:5 de même taille, bustes de face coupés mi-poitrine, tête près du haut de la case, un geste par expression quand le personnage doit se lire en petit, aucun texte. Vérifier l'ordre des expressions à la réception.

## Fond de la story Instagram (v1.43, livré le 31 octobre)

Joindre `ref-style-clients.png` (image 1), `ref-equipe.png` (image 2) et `assets/sources/salle-profonde.png` (image 3).
À la réception : `assets/sources/story-fond.png`, puis WebP 86 → `assets/ui/story-fond.webp`. Si la composition bouge, recaler `STORY_LAYOUT.fond` (`src/story.js`) ; en mode test, `window.__galopins.storyLab` permet d'essayer des positions.

### Demande
```
Illustration de fond pour une story Instagram du jeu, format portrait le plus haut possible, dans le style exact des images jointes.
Décor : le bar de l'image 3 (plantes suspendues, enseigne au cheval lumineux, fenêtres bleues, bois), vu depuis la salle, face au comptoir.
Composition de haut en bas :
- le tiers du haut : le mur du bar, calme et assez sombre, sans texte (un titre sera ajouté par-dessus) ;
- au milieu à droite : un espace dégagé devant le mur (un ticket de caisse sera posé dessus) ;
- en bas à gauche : Max de l'image 2 derrière le comptoir, fier, grand sourire, pouce levé, visible jusqu'à la taille, le bas caché par le comptoir ;
- le quart du bas : le devant du comptoir en bois, uni, sans objet (une enseigne néon sera ajoutée dessus).
Garder de la marge à gauche et à droite : les bords seront un peu rognés.
Style : celui des clients de l'image 1 (contours fins, quelques tons chauds, petits pixels nets), éclairage chaud du soir.
Aucun texte, aucun logo, aucune lettre nulle part.
```

### Correction (Max trop lisse, salle vide)
```
Retouche cette dernière image en gardant exactement la même composition et le même format : cheval lumineux au même endroit, comptoir à la même hauteur, Max au même endroit et à la même taille, pouce levé, plafond, plantes et fenêtres inchangés.

Deux corrections :
1. Max : le redessiner exactement dans le style de Max de l'image 2 (contours fins et sombres, ombres en aplats simples de quelques tons chauds, petits pixels nets, rendu moins lisse). Même pose, même expression, même tenue.
2. La salle est trop vide : ajoute des clients attablés comme dans l'image 3. Deux ou trois tables hautes avec tabourets au fond de la salle, devant le lambris, avec des gens assis qui discutent autour d'une bière, dans le style des clients de l'image 1. Ils restent petits et au fond, sans cacher le cheval ni Max.

Toujours aucun texte, aucune lettre, aucun logo ajouté.
```

## Jérémie, le brasseur (v1.26, livré le 31 octobre avec la retouche de la grimace et l'aperçu des liens)

Joindre `ref-style-clients.png` (image 1), `ref-equipe.png` (image 2) et une photo de Jérémie de face, bien éclairée (image 3).
Faire les deux demandes dans la même conversation ChatGPT, pour que la tenue soit la même.
À la réception : planche → `assets/sources/jeremie.png`, découpée par `python3 tools/pack-friend.py assets/sources/jeremie.png assets/characters/jeremie.webp 5` ; pose → `assets/sources/jeremie-carton.png` → `assets/characters/card-jeremie.webp` (440 px de haut). Dès que `jeremie.webp` est dans la page, Jérémie apparaît aussi dans le jeu public.

### Jérémie, 5 expressions
```
Planche de 5 bustes de Jérémie sur une ligne, cases 4:5 de même taille, même cadrage dans chaque case.
Style : exactement celui des clients de l'image 1 (tête grande, yeux expressifs, contours fins sombres, quelques tons chauds, petits pixels nets).
Identité : l'homme de la photo (image 3), dont il faut garder la ressemblance : coupe, barbe, lunettes s'il en porte, carrure. C'est le brasseur du bar : tablier de brasseur foncé par-dessus un tee.
Il fait partie de la même équipe que Max, Alex et Hugo de l'image 2 : même famille de dessin, même teinte de peau chaude.
Expressions exagérées, lisibles à 50 pixels de haut, chacune avec un geste bien visible devant le torse :
1. neutre : il tient un petit carnet et un crayon, un sourcil levé, l'air d'un inspecteur ;
2. goûte : il boit une gorgée d'une pinte d'IPA dorée, yeux fermés, très concentré ;
3. approuve : grand sourire, pouce levé, la pinte dans l'autre main ;
4. grimace : il grimace, langue tirée, et éloigne la pinte de lui du bout des doigts ;
5. pompette : joues rouges, sourire béat, yeux mi-clos, il lève sa pinte pour trinquer.
Bustes de face coupés mi-poitrine, tête près du haut de la case. Fond vert uni #00FF00 partout autour des bustes, sans ombre ni halo. Aucun texte.
```

### Pose du carton
```
Un grand buste du même Jérémie pour son écran d'arrivée, case 4:5, même tenue que sur la planche.
Style : celui des clients de l'image 1.
Légèrement tourné vers la droite, comme s'il s'adressait à quelqu'un hors champ, cadré à la taille, plus dynamique qu'un portrait :
il lève une pinte d'IPA dorée à contre-jour devant son œil pour l'inspecter, carnet sous le bras, sourcil levé, air d'expert.
Fond vert uni #00FF00, sans ombre ni halo. Aucun texte.
```

### Retouche de la grimace (idée de Jérémie : la pinte ratée, pleine de mousse)
Joindre la planche livrée.
```
Renvoie seulement la 4e case de cette planche (Jérémie qui grimace en tirant la langue), seule, au même format 4:5, même cadrage, même fond vert.
Garde exactement la pose, l'expression, les vêtements et la main. Change uniquement la pinte qu'il éloigne : elle est ratée,
presque entièrement de la mousse blanche qui déborde et coule le long du verre, avec juste un fond de bière dorée en bas. Aucun texte.
```

### Image d'aperçu des liens partagés, avec Jérémie
Joindre l'aperçu actuel `assets/sources/apercu.png` (image 1) et la planche de Jérémie (image 2). Claude relance ensuite `tools/pack-apercu.py`.
```
Garde exactement cette image : cadrage, décor, comptoir, lumière, et les quatre personnages inchangés.
Ajoute Jérémie (image 2, la case où il goûte) derrière le comptoir, entre le personnage aux shots et celui qui tend la pinte, un peu en retrait comme celui qui fait le V :
il lève une pinte d'IPA dorée à contre-jour pour l'inspecter, sourcil levé. Même style, même lumière, coupé à la taille par le comptoir comme les autres.
Le tiers du haut reste calme. Aucun texte, aucune lettre.
```

## Déjà livrées (v1.21 – v1.23)

### Retouche d'une image existante (Max de l'accueil, coiffure au bol)

Joindre l'image à retoucher et `ref-equipe.png`.

```
Garde exactement cette image (pose, cadrage, couleurs, torchon, verre, fond vert).
Change uniquement la coiffure : la coupe au bol arrondie du Max de l'image 2, sans épis.
```

### Hugo, 4 expressions
```
Planche de 4 bustes d'Hugo, grille 2 × 2, cases 4:5 de même taille, même cadrage dans chaque case.
Style : exactement celui des clients de l'image 1 (tête grande, yeux expressifs, contours fins sombres, quelques tons chauds, petits pixels nets).
Identité : Hugo, à droite sur l'image 2 : casquette bleue, lunettes rondes, barbe brune, tee corail. Casquette relevée : elle ne cache jamais les sourcils.
Expressions exagérées, lisibles à 40 pixels de haut, chacune avec un geste bien visible devant le torse :
1. neutre : bras croisés, un sourcil levé, bouche droite ;
2. autoritaire : il tapote sa montre en criant, sourcils très froncés, bouche grande ouverte ;
3. fier : grand sourire, pouce levé ;
4. déçu : la main sur le front, yeux mi-clos, bouche tombante.
Bustes de face coupés mi-poitrine, tête près du haut de la case. Fond vert uni #00FF00 partout autour des bustes, sans ombre ni halo. Aucun texte.
```

### Poses des cartons
```
Deux grands bustes pour l'écran d'arrivée d'un personnage, côte à côte, cases 4:5 de même taille.
Style : celui des clients de l'image 1. Identités : Alex et Hugo de l'image 2.
Les deux sont légèrement tournés vers la droite, comme s'ils s'adressaient à quelqu'un hors champ, cadrés à la taille, plus dynamiques qu'un portrait :
1. Alex débarque : il lève d'une main un plateau de trois petits shots rouges, clin d'œil, grand sourire ;
2. Hugo débarque : bras tendu, il montre sa montre, sourcils froncés, il crie.
Fond vert uni #00FF00, sans ombre ni halo. Aucun texte.
```

### Max, 9 expressions
```
Planche de 9 bustes de Max, grille 3 × 3, cases 4:5 de même taille, même cadrage dans chaque case.
Style et identité : exactement le Max de l'image 2, dans le style des clients de l'image 1.
Expressions exagérées, lisibles à 50 pixels de haut : neutre ; content ; stressé ; blasé ; oups ; triste ; fier ; pompette ; concentré.
Bustes de face coupés mi-poitrine, sans les mains, tête près du haut de la case. Fond vert uni #00FF00 partout, sans ombre ni halo. Aucun texte.
```

### Alex, 3 expressions
```
Planche de 3 bustes d'Alex sur une ligne, cases 4:5 de même taille, même cadrage.
Style et identité : exactement l'Alex de l'image 2, dans le style des clients de l'image 1.
1. neutre, petit sourire ; 2. rigolard, il tend un petit shot rouge vers le joueur ; 3. vexé, bras croisés, moue boudeuse.
Bustes de face coupés mi-poitrine, tête près du haut de la case. Fond vert uni #00FF00, sans ombre ni halo. Aucun texte.
```

### Max qui essuie un verre
```
Un buste de Max qui essuie une pinte vide avec un torchon à carreaux rouges, regard vers le joueur, sourire tranquille.
Style : exactement celui des clients de l'image 1. Identité : Max de l'image 2.
Cadrage 4:5, de face, coupé mi-poitrine, tête près du haut, mains et verre devant le torse. Fond vert uni #00FF00, sans ombre ni halo. Aucun texte.
```

## Image d'aperçu des liens partagés (v1.24, livrée)

### Demande

Joindre `ref-style-clients.png` (image 1), `ref-equipe.png` (image 2), `assets/sources/salle-profonde.png` (image 3) et `assets/sources/nico.png` (image 4, Nico qui s'incruste, idée de Jérémie).
Claude recadre en 1200 × 630, ajoute le titre « GALOPINS ARCADE » et « Tu me bats ? » avec la police du jeu, puis branche l'image (`og:image`).

```
Une illustration au format paysage 3:2 pour l'aperçu d'un lien partagé (WhatsApp, Messages).
Style : exactement celui des clients de l'image 1. Identités : Max, Alex et Hugo de l'image 2.
Scène vue depuis la salle, de face : un comptoir en bois traverse tout le bas de l'image.
Au centre, derrière le comptoir, Max pose une pinte d'IPA bien pleine vers le spectateur, sourire de défi, sourcil levé.
À gauche, Alex lève son plateau de trois petits shots rouges avec un clin d'œil. À droite, Hugo tapote sa montre, sourcils froncés.
Nico (image 4, son expression rieuse) s'incruste dans la photo : il surgit derrière, entre Max et Hugo, grand sourire, il fait un V de la victoire au-dessus de l'épaule de Max et tient sa propre bière de l'autre main (il est en repos mais toujours au bar). Son tee blanc à col bleu, sans écusson.
Max, Alex et Hugo coupés à la taille par le comptoir, têtes à mi-hauteur de l'image, bien regroupés au centre.
Fond : la salle de l'image 3 (enseigne du cheval lumineux, plantes, fenêtres bleues, lumière chaude du soir), plus sombre et légèrement floue pour que les personnages ressortent.
Le tiers du haut reste calme (mur et enseigne) : j'y poserai un titre. Rien d'important dans les bords gauche et droit.
Aucun texte, aucune lettre, aucun logo ni écusson.
```

### Correction (la première version avait inversé Max et Alex)
Renvoyer l'image avec `ref-equipe.png`.
```
Garde exactement cette image : cadrage, décor, comptoir, lumière, Nico et Hugo inchangés.
Échange seulement l'identité des deux personnages de gauche, en gardant leurs gestes et leurs places :
- au centre, celui qui tend la pinte devient Max (à gauche sur l'image 2) : coupe au bol arrondie, lunettes rondes, barbe, tee kaki ;
- à gauche, celui qui lève le plateau de shots devient Alex (au centre sur l'image 2) : cheveux courts en épis, sans lunettes, petite barbe, tee noir.
Aucun texte.
```
