# Spécification — étape 1 : contrat de kit et de recette

Date : 3 novembre 2026. Suite de [compte-rendu-et-revue-critique-2026-11-03.md](compte-rendu-et-revue-critique-2026-11-03.md) (§5, étape 1).
Statut : **v0, validée sur un prototype jetable** (`prototype/`, port 5200). Le prototype utilise des formes procédurales : il valide le contrat et la chaîne, pas le style artistique.

## 1. Périmètre

- Premier kit : `beachlife-v0` (cible 2D : sprite PNG transparent 256×256, personnage affiché à ~40 px de haut dans BeachlifeLike).
- Cible 3D : **non définie** (aucun projet 3D choisi). Le prototype exporte un rendu three.js de test, sans format de fichier 3D arrêté.
- Style : défini **par kit**, donc par projet. Celui-ci est neutre/cartoon simplifié.
- Pièces réelles : à produire avec `generateurImage` (:4319, MCP) ; hors périmètre de cette étape (voir §6).

## 2. Conventions du kit (extrait de `prototype/public/js/kit.js`)

| Élément | Valeur v0 |
|---|---|
| Unités / axes | mètres, Y vers le haut, origine au sol entre les pieds, face vers +Z |
| Cadre de rendu | 2,2 m de haut, 256×256 px, sol à 97 % de la hauteur, personnage centré |
| Stature | facteur 0,92 – 1,08 (taille de base 1,8 m × `hauteur` de la morphologie) |
| Morphologies | `fine`, `ronde`, `trapue` : 7 paramètres (hauteur, épaules, taille, ventre, hanches, jambes, bras) |
| Visages | `v1`, `v2` (taille de tête, écart des yeux, bouche) |
| Emplacements nommés | `poitrine_gauche`, `centre_poitrine`, `ventre` : (u, v) relatifs au torse, donc ils suivent la morphologie |
| Motifs | `coeur`, `soleil` (localisés), `rayures` (répété, rogné à la pièce) |
| Pièces | identifiant `categorie.nom@version`, une **couche**, une liste `couvre` (zones masquées), des **zones** recolorables |

Couches : `cheveux.long`(0, derrière) < sous-vêtements(1) < haut/bas(2) < gilet(3) < manteau(4) < `cheveux.court`(5).
La géométrie (`geometrie()`, `demiLargeur()`) est **commune au 2D et au 3D** : c'est ce qui rend l'ancrage et les silhouettes comparables.

## 3. Recette (`recette/1`)

Trois blocs séparés, comme décidé dans le compte rendu :

```
schema, kit ("beachlife-v0@0.1.0"), graine
identite   : morphologie, stature, visage, teint, cheveux{piece, couleur}
garderobe  : valise{ <tenue>: [ {piece, couleurs{zone:#hex}, motif?{type, emplacement, echelle, couleur}} ] }
apparence  : tenue, sousVetements
```

Règles :
- La **graine propose** une combinaison ; elle ne la reconstruit jamais. La recette contient les identifiants précis (avec version) de chaque pièce (point H).
- Une pièce absente du catalogue est un **refus explicite**, jamais un remplacement silencieux. Le jeu choisit : garder la version figée, ou remplacer par une pièce désignée. Message produit : `haut.tshirt@1 manquante dans valise.plage`.
- Une stature, une morphologie, un visage ou un emplacement hors contrat est rejeté à la validation.
- Les sous-vêtements sont une couche indépendante : affichés seulement si aucune pièce ne couvre `hanches`.

## 4. Définition de « exporté avec succès » (v0)

1. La recette valide contre le kit (`validerRecette`).
2. Le même résultat 2D et 3D est reconstruit à l'identique depuis la recette sérialisée.
3. Les pieds restent au sol (tolérance 3 px) pour toutes les morphologies et les deux statures extrêmes.
4. Les sous-vêtements ne ressortent pas sous une tenue qui couvre les hanches.
5. Le rendu est comparé **à la taille réelle du jeu** (40 px), pas seulement en 256 px.

## 5. Résultats du prototype (mesurés)

- `npm test` : 7 tests verts (validation, pièce manquante, hors plage, masquage, ordre des couches, déterminisme de la géométrie, emplacements).
- Contrôles dans l'interface : ancrage 2D à ±0,7 px, 3D à ±0,3 px (3 morphologies × 2 statures) ; reconstruction déterministe ; masquage correct.
- Un défaut réel trouvé par le contrôle d'ancrage puis corrigé : les jambes dépassaient de ~3 px sous le sol dans les deux rendus.
- Planche 3 morphologies × 3 tenues (dont un habit historique à 4 couches) lisible en 2D comme en 3D.

## 6. Limites constatées et points ouverts

- **Lisibilité à 40 px** : à cette taille, la silhouette, les couleurs et la coiffure se distinguent ; les traits du visage (nez, bouche) ne se lisent pas. Confirme le §2 de la revue : la lisibilité prime sur le détail du visage. À re-vérifier avec de vraies pièces.
- **Manteau historique en 3D** : simplifié (pas d'ouverture ni de revers), alors que le 2D les dessine. Illustre les points C et F : le même vêtement n'a pas la même fidélité dans les deux rendus ; un profil de simplification par sortie est nécessaire.
- **Motifs 3D** : posés comme décalque plan, pas projetés sur la surface ; à remplacer par une vraie texture UV sur le kit réel.
- **Formes procédurales** : aucune conclusion sur la qualité visuelle, le coût de création des vêtements, ni la déformation des vrais maillages (point C).
- **Non traité** : poses et animations, enfants, groupes (point K), mémoire GPU et budgets (point G), couleurs par matière (point I).
- **Ouvert, à trancher** : projet 3D cible et format (glTF probable), moteur d'assemblage final (le prototype tourne dans le navigateur), chaîne de production des pièces avec `generateurImage` (image → mesh → rigging → sprites → atlas existe déjà côté MCP).
- **Côté BeachlifeLike (en parallèle)** : corriger le point H avant branchement (les « habitués » recalculent leur identité depuis une graine et des tables, `prototype/src/sim/profilHabitue.ts`). Le contrat ci-dessus (identifiants versionnés dans la recette) est la cible de cette correction.

## 7. Étape suivante proposée

Étape 2 du compte rendu (vérifier la diversité physique) avec de **vraies pièces** : produire via `generateurImage` un corps de référence et une famille de têtes/coiffures pour une morphologie, les brancher dans le même contrat, et refaire la comparaison portrait / 3D / sprite 40 px.

## 8. Étape 2 (partielle) — corps réels, mesurés le 3 novembre 2026

Produit avec `generateurImage` (MCP) : 3 corps de référence en pied, fond transparent, tenue de base neutre (débardeur et short gris), style « 3D cartoon Pixar-like » repris d'un personnage existant du jeu. Coût réel **0,016 $** (3 images, 1024×1536). Éléments de bibliothèque : `20261103-170511-irf2im` (fine), `20261103-170513-xog5ts` (ronde), `20261103-170514-nyj7zq` (trapue), dossier `compositeur/etape2/corps`. Page de comparaison : `prototype/public/etape2.html` (http://localhost:5200/etape2.html).

| Largeur ÷ hauteur de silhouette | fine | ronde | trapue |
|---|---|---|---|
| Corps réels (IA) | 0,373 | 0,602 (+61 %) | 0,619 (+66 %) |
| Rendu procédural étape 1 | 0,378 | 0,444 (+18 %) | 0,518 (+37 %) |

Constats :
- Les trois morphologies sont **nettement distinctes à 40 px** (écarts de silhouette ≥ 61 %, au-dessus du seuil de travail de 15 %). Le critère « différences perceptibles » de l'étape 2 est tenu **pour les corps seuls**.
- Les paramètres du kit procédural **sous-estiment** l'écart des vraies morphologies (surtout `ronde`) : à recalibrer sur les corps réels avant de s'en servir comme valeurs de référence.
- À 40 px, les traits du visage ne se lisent toujours pas ; l'identité repose sur la silhouette, la couleur de peau, la coiffure et les vêtements.
- Les images « transparentes » gardent une ombre de contact claire sous les pieds (visible à 160 px) : à détourer ou à traiter avant d'en faire des pièces.
- Les corps sont en A-pose avec bras écartés : la largeur mesurée inclut les bras.

### 8 bis — visages, coiffures et passage en 3D (même jour)

- **Visages / coiffures** : `transformer_image` « variantes » sur le corps ronde (`20261103-204425-j8mmwf`, 0,018 $) → feuille 3×3 de 9 visages et coiffures sur un corps inchangé. La diversité **fonctionne**, mais la feuille n'est pas une pièce propre : fond gris avec une tache, accessoires parasites (verre, sac, chaussons), non découpée. Pour fabriquer de vraies pièces de tête, il faut une génération ciblée (`tete`) puis détourage, pas une feuille de variantes.
- **3D** : `image_vers_3d` sur le corps ronde → mesh `20261103-204517-u5ns4y` puis version riggée `20261103-204538-hro7e0` (Meshy, 35 crédits sur 100 de budget, 8 000 polygones, animations marche/course fournies). Rendu Blender gratuit 8 directions (`20261103-204553-37dekl`, pose fixe, 256 px).
- **Morphologie conservée en 3D** : largeur/hauteur de face 0,64 contre 0,60 sur l'image source ; la silhouette ronde se retrouve sous les 8 angles.
- **Écart au contrat du kit** : dans les sprites bruts, le personnage ne fait que **51 %** de la hauteur du cadre et son sol est à **62–64 %** (contrat : 88 % de personnage, sol à 97 %). Le pipeline actuel ne normalise ni échelle ni ancrage. À 40 px de haut, il faut donc recadrer sur la silhouette ; l'outil `Normalisation3DV2D` (:8090, GLB → PNG iso normalisés) est le candidat pour cette normalisation, à tester.
- **Défaut visible** : sur la vue de face à 160 px, un trait fin parasite apparaît à droite des jambes (artefact de maillage probable) ; non investigué.
- **Pas de comparaison de stature** : les corps réels n'ont qu'une seule taille.

### 8 ter — normalisation des sprites 3D (test de `Normalisation3DV2D`)

Essai sur le modèle riggé du corps ronde via `POST :8090/api/render` (API sans état : GLB envoyé, ZIP de captures reçu), résolution 256, mesures sur le canal alpha :

| Réglage | Personnage / cadre | Sol | Largeur ÷ hauteur (face) | Verdict |
|---|---|---|---|---|
| Rendu brut generateurImage (Blender, iso 30°) | 51 % | 62–64 % | 0,64 | hors contrat |
| Normalisation, iso 45°/35°, `framing: sphere` | 65–71 % | 83–88 % | 0,65 | hors contrat |
| Normalisation, iso, `framing: tight` | 91 % | 96–99 % (varie selon l'angle) | 0,66 | cadre bon, mais **efface la stature** (chaque modèle remplit le cadre) |
| Face (`azimuth 0`, `elevation 0`), `tight` | 91 % | 95,7 % | 0,592 | idem |
| Face, **`framing: scale`**, `reference: 2.585` | **88,3 %** | 94,1 % → **96,9 %** après calage | 0,588 | **retenu** |

Constats :
- `framing: scale` garde les tailles relatives (nom de fichier contenant « personnage » → 2,5 m dans `sizes.json`) ; la hauteur à l'écran vaut `taille ÷ reference × 0,91`. Pour viser 88 % : `reference = taille × 0,91 ÷ 0,88`. La stature est donc portable, mais **par nom de fichier ou par `sizes.json`**, pas par paramètre d'appel : l'API ne prend pas de taille par requête.
- Le modèle est centré **verticalement** : le sol dépend de la stature (94,1 % ici). Le script `outils/normaliser_sol.py` recale le sol à 97 % sans changer l'échelle ; vérifié : sol 96,9 %, centre horizontal 0,502.
- Fidélité de morphologie en vue de face à 0° : 0,588 contre 0,602 sur l'image source (écart de 2 %). La vue iso 45°/35° donne un rapport plus large (0,65) car elle montre aussi le côté.
- Chaîne retenue pour BeachlifeLike (à confirmer) : image → `image_vers_3d` → `/api/render` en face, `scale`, → `normaliser_sol.py`. Aucun test sur plusieurs statures ni sur d'autres modèles : une seule mesure.

**Reste à faire pour clore l'étape 2** : tester deux statures (nécessite deux tailles dans `sizes.json`, fichier global du service : à ne pas modifier sans l'accord de Jeremy), produire des têtes et coiffures propres et détourées, tester une pose difficile (animation de marche déjà livrée avec le modèle), corriger le trait parasite du maillage.

**Coût total de l'étape 2 à ce stade** : 0,034 $ d'images + 35 crédits Meshy ; les rendus de normalisation sont gratuits.

### 8 quater — tête détourée (transformation `tete`, 4 novembre 2026)

Essai : `transformer_image` `tete` + `fond_transparent` sur le corps « ronde » (élément 20261103-170513-xog5ts) → élément 20261104-211736-p4yh36, 1024×1024, 0,019 $ (clé `compositeur-tete-ronde-v1`). Fichier : `prototype/public/etape2/tete-ronde.png`.

- **Détourage : bon.** Canal alpha réel, 30 % de pixels transparents, coin (0,0,0,0).
- **Identité : conservée** (même visage, mêmes cheveux noirs mi-longs, même carnation).
- **Mais ce n'est pas une tête isolée** : c'est un portrait tête-et-épaules (cou, épaules, débardeur gris inclus). Le vêtement est donc dans la pièce : à rogner sous le menton avant usage comme pièce `visage`/`coiffure`, sinon il se superpose à la tenue du kit.
- **Pas de séparation visage / coiffure** : cheveux et visage sont dans la même image. Une coiffure interchangeable demande une génération dédiée (cheveux seuls, ou tête chauve + coiffure à part), non testée.
- **Non vérifié** : lisibilité à 40 px, raccord au corps (échelle et position du cou), autres morphologies.

### 8 quinquies — coiffure séparée (5 novembre 2026)

Deux essais sur la tête de §8 quater (0,015 $ + 0,013 $) :

- **Tête chauve** (`reskin`, élément 20261105-065658-oome4z) : visage et expression conservés, crâne lisse, **mais le fond transparent a échoué** : fond sombre dégradé incorporé (aucun pixel pleinement transparent) et épaules/débardeur toujours présents. Inutilisable telle quelle comme pièce ; demande un détourage manuel ou une autre passe. Fichier : `public/etape2/tete-chauve.png`.
- **Extraction** (`extraction`, élément 20261105-065730-ka1g8q) : **bon résultat inattendu**. Planche à fond réellement transparent (80 %) avec pièces séparées : **cheveux seuls** (perruque vue de face, ouverture du visage vide), sourcils, yeux, nez, bouche, oreilles, cou, haut du corps, et tête chauve. Découpe par composantes connexes → `public/etape2/piece-{cheveux,sourcils,yeux,nez,bouche,oreilles,cou}.png` (cheveux 360×316 px, yeux 290×74, nez 114×80…). C'est la voie la plus prometteuse pour un kit de visage interchangeable.
- **Non vérifié** : recomposition (cheveux sur tête chauve détourée), cohérence d'échelle entre pièces (elles sont dessinées sur la planche, pas à l'échelle de la tête), lisibilité à 40 px, autre coiffure que l'originale (une coiffure neuve demande `reskin` sur la pièce cheveux).

### 8 sexies — recomposition tête chauve + cheveux (5 novembre 2026)

Tête chauve prise sur la planche d'extraction (fond transparent propre, 266×282 px, `piece-tete-chauve.png`) + pièce cheveux, sans aucune déformation, seulement mise à l'échelle et alignée (centre horizontal, sommet des cheveux 25 px au-dessus du crâne). Essais à ×1,0 / ×1,25 / ×1,5 :

- ×1,0 : les cheveux mordent sur le visage (ouverture trop étroite).
- **×1,25 : raccord propre**, visage entier, mèches retombant naturellement. Retenu → `recompose-tete.png`.
- ×1,5 : trou blanc visible entre joues et cheveux.

Conclusion : la recomposition fonctionne, mais **l'échelle relative n'est pas fournie par la planche** (les pièces y sont dessinées à des tailles propres). Le kit devra stocker pour chaque pièce un facteur d'échelle et un point d'ancrage (ici ×1,25 et centre/sommet), à calibrer à l'ajout de la pièce. Non testé : autre tête, autre coiffure, yeux/bouche remplacés, lisibilité à 40 px (visible sur etape2.html).

### 8 septies — autre coiffure par reskin (5 novembre 2026)

Essai : `reskin` de la planche d'extraction (élément 20261105-065730-ka1g8q) avec consigne « changer seulement la perruque en coupe pixie rousse » → élément 20261105-070223-nqbf49, 0,015 $. Fichier brut : `public/etape2/planche-roux.png`.

- **Style : réussi.** La coiffure rousse courte est cohérente avec le reste (même rendu, même éclairage).
- **Le reste de la planche n'est pas préservé** : sourcils et bouche sont altérés, la planche entière est noyée dans un bruit gris.
- **Transparence : échec.** Aucun pixel pleinement transparent (alpha ≥ 9 partout) ; fond sombre bruité, ouverture du visage remplie de noir. Un détourage par clé de couleur (teinte rousse) donne une pièce trouée, avec des débris de la case voisine : **non utilisable** (pas conservée).
- Conclusion : `fond_transparent` n'est fiable que sur `extraction` ; le `reskin` d'une planche entière dégrade tout. Pour une nouvelle coiffure, deux pistes non testées : (a) générer la coiffure directement avec `extraction` à partir d'une tête portant déjà cette coiffure (la tête d'origine, regénérée avec une autre coiffure, puis extraction) ; (b) détourage dédié (matting) après reskin.

### 8 octies — nouvelle coiffure par régénération de la tête puis extraction (5 novembre 2026)

Chaîne : `reskin` de la tête de §8 quater (coupe pixie rousse, élément 20261105-070415-bundzn, 0,015 $, fond non transparent, sans importance ici) → `extraction` avec fond transparent (élément 20261105-070440-zyn7q3, 0,013 $). Planche : `public/etape2/planche-roux2.png`.

- **Transparence : réussie** (73 % de pixels transparents). Contrairement à §8 septies, la planche est propre.
- **Pièces séparées** : cheveux roux (ouverture vide), **tête sans visage** (crâne + cou, lisse), 2 yeux, 2 sourcils, nez, lèvres, 2 oreilles, cou. 11 composantes détectées automatiquement.
- **Assemblage de 8 pièces** (`recompose-roux.png`) : tête + oreilles + yeux + sourcils + nez + lèvres + cheveux. Le visage obtenu est cohérent et expressif. **Mais l'échelle des pièces n'est pas celle de la tête** : premier essai à ×1 = nez et bouche énormes ; correct avec yeux et sourcils ×0,6, nez et lèvres ×0,5, oreilles ×0,8, cheveux ×1,05 de la largeur de tête. Positions trouvées à la main (yeux à 62 % de la largeur depuis le haut, écart ±70 px, sourcils −48, nez +62, bouche +120).
- Conséquence pour le kit : chaque pièce de visage doit porter **échelle + point d'ancrage + gabarit de tête** ; les pièces d'une même planche sont cohérentes entre elles mais pas à l'échelle d'origine.
- **Fiable** : `extraction` sur une tête déjà régénérée avec la coiffure voulue. Une coiffure = 2 appels (~0,03 $).
- **Non testé** : mélange de pièces issues de planches différentes (têtes différentes), lisibilité à 40 px, passage au corps entier.

### 8 nonies — mélange de pièces issues de deux têtes (5 novembre 2026)

Sans nouvelle génération (0 $). Crâne, cou et oreilles de la planche rousse (§8 octies) ; yeux, sourcils, nez, lèvres et cheveux noirs de la première planche (§8 quinquies). Résultat : `public/etape2/recompose-mix.png`.

- **Le mélange fonctionne** : le visage reste cohérent, sans raccord franc entre planches (même style, même teinte de peau de base).
- **Échelles à recalibrer par planche** : yeux ×0,86, sourcils ×0,92, nez ×0,61, lèvres ×0,57, cheveux ×1,69 la largeur du crâne (≠ des facteurs de §8 octies, car les pièces de la planche 1 n'ont pas la même taille de dessin que celles de la planche 2, et les yeux/sourcils y sont groupés par paire).
- **Défauts visibles** : cheveux un peu larges au niveau de la mâchoire (petit vide près du cou), joues partiellement masquées par la frange ; l'écart de teinte entre peaux de planches différentes est faible ici, il serait à vérifier avec des teints éloignés (recoloration à prévoir).
- Conclusion : **le principe du kit de pièces interchangeables est validé** en 2D face. Prérequis : échelle + ancrage par pièce et par planche d'origine, et une passe de calibrage à l'import.

## 9. Visages en pièces branchés dans le kit (5 novembre 2026)

Le kit `beachlife-v0` accepte désormais des **visages image** (`kit.visagesImage`, 2 entrées : `image.roux@1`, `image.mix@1`), choisis par `recette.identite.visage` comme les visages procéduraux (`v1`, `v2`).

- **Définition d'un visage image** : liste de calques (`role`, planche source `src`, `rect` dans la planche, échelle `k`, centre `x,y` dans le repère du crâne de largeur `ref`), plus une pièce `cheveux` (largeur relative, décalage vertical) et `menton` (fraction du crâne conservée ; le cou de l'image est coupé, le cou du corps prend le relais). Échelle et ancrage sont donc **portés par la définition de la pièce**, comme préconisé en §8 nonies.
- **Contrat** : `placementsVisage(def, largeurCrane)` (kit.js, fonction pure) calcule tous les placements proportionnellement à la largeur du crâne, qui vaut celle de la tête procédurale (`2 × teteR`) : le visage suit donc la morphologie et la stature comme avant. Validation : un visage image inconnu est refusé explicitement (même message que pour un visage procédural).
- **Rendu 2D** (`rendu2d.js`) : `preparerImages()` charge les planches avant tout dessin (erreur explicite si une image manque, jamais de dessin partiel silencieux) ; le visage image est dessiné **après les vêtements** (le menton passe devant le col, constaté nécessaire : le col se dessinait sur la bouche). Un visage image **porte ses cheveux** : `identite.cheveux` est ignoré dans ce cas.
- **Vérifié** : tests `npm test` 9/9 (2 nouveaux : validation du visage image ; proportionnalité, centrage des cheveux, coupe au menton) ; navigateur sans erreur console ; 6 combinaisons (2 visages × 3 morphologies) rendues, ancrage au sol 2D inchangé (ligne basse 249 pour sol 248) ; rendu à 40 px affiché.
- **Limites** : le **rendu 3D reste procédural** (il lit seulement `tete`, `ecartYeux`) ; l'expression et l'orientation sont figées (face, sourire) ; teint de peau non recoloré (la peau des pièces est cuite dans l'image, alors que le corps utilise `identite.teint` : écart de teinte visible si le teint choisi diffère) ; les définitions ont été calibrées à la main sur deux planches, sans outil de calibrage ; lisibilité du visage à 40 px faible (quelques pixels pour les traits).

### 9 bis — recoloration du teint des visages image (5 novembre 2026)

`identite.teint` s'applique maintenant aux visages image : les pièces dont le rôle est de la peau (`ROLES_PEAU` : crâne, oreilles, nez) sont recolorées, **lèvres comprises** (ajoutées ensuite) ; yeux, sourcils et cheveux ne le sont pas.

- **Méthode** : couleur d'origine de la peau = médiane des pixels opaques d'une zone de référence de la planche (`peauRef`, par planche : un visage mélangeant deux planches a une référence par planche). Chaque canal est multiplié par `cible ÷ référence` (`teinter`, fonction pure testée) : ombres et reflets conservés, résultat borné à 0–255. Résultat mis en cache par pièce et par teint ; déterministe.
- **Vérifié** : tests 10/10 (nouveau test de `teinter` : identité, proportionnalité, bornage) ; rendu de 4 teints (#f3d2b8, #e0ac8a, #a8683f, #5a3622) sur les 2 visages, sans erreur, visages cohérents avec le corps.
- **Lèvres** : même facteur que la peau, donc leur contraste avec la peau est conservé ; sur le teint le plus foncé (#5a3622) elles deviennent brun foncé, discrètes mais naturelles ; vérifié sur 4 teints (tests 10/10).
- **Limites** : la multiplication éclaircit mal les teints très foncés vers du très clair (écrêtage) ; les joues rosées cuites dans l'image ne suivent pas le teint ; une teinte différente demanderait d'agir sur la teinte (HSL), pas seulement le facteur. Lisibilité à 40 px non réexaminée.

### 9 ter — visage image en 3D (5 novembre 2026)

Le rendu 3D (`rendu3d.js`) affiche maintenant les visages image : `visageEnCanvas()` (rendu2d.js) compose oreilles, crâne, traits (recolorés) et cheveux sur un canvas transparent, posé comme **décalque de face** (plan texturé `MeshBasicMaterial`, devant la tête, `toneMapped: false`). Même placement que le 2D : crâne de largeur `2 × teteR`, haut du crâne et menton identiques ; la sphère de tête procédurale est masquée pour un visage image, comme l'ellipse en 2D.

- **Vérifié** : 3 combinaisons (visage × teint × morphologie : mix/#e0ac8a/ronde, roux/#a8683f/fine, mix/#5a3622/trapue) rendues en 2D et en 3D côte à côte, sans erreur ; visage 3D à la même position et à la même taille que le 2D, teint recoloré identique ; tests 10/10 ; console sans erreur.
- **Limite principale** : c'est un **décalque plat, valable seulement pour la caméra de face** du prototype. Il n'y a ni profil, ni trois-quarts, ni dos (le plan disparaît de profil, la tête serait vide). Un vrai visage 3D demanderait un maillage de tête (p. ex. `image_vers_3d` sur la tête) ou une projection sur la sphère, non testés.
- **Autres limites** : l'éclairage 3D ne touche pas le visage (matériau sans ombrage : volume plat) ; pas de contrôle automatique 2D/3D du visage (vérifié à l'œil) ; le col du t-shirt n'existe pas en 3D, donc le menton y recouvre simplement le haut du torse.

### 9 quater — vrai visage 3D : maillage de la tête (5 novembre 2026)

Essai : `image_vers_3d` (Meshy, sans rigging, 30 crédits ; budget 3D total consommé : 65/100) sur le portrait tête-et-épaules de §8 quater → maillage 20261105-100054-27cp2n ; rendu Blender 8 directions, inclinaison 0°, 256 px (gratuit) → sprites 20261105-100111-27l8di. Planche face / trois-quarts / dos / profil : `public/etape2/tete-3d-maillage.png`.

- **Réussi** : vraie tête en volume, **cohérente sous les 8 angles** (face, trois-quarts, profil, dos), cheveux mi-longs avec nuque et arrière de tête, oreille visible de profil. C'est ce qui manquait au décalque de §9 ter (aucun profil ni dos).
- **Défauts / limites** : le maillage contient aussi cou, épaules et débardeur (à découper) ; **cheveux et visage sont cuits dans une seule texture** (coiffure non interchangeable, pas de recoloration du teint par rôle de pièce comme en §9 bis) ; le visage du maillage s'écarte un peu de l'image source (expression, traits) ; la coiffure d'une autre pièce (roux, mélange) demande un nouveau maillage (30 crédits chacun).
- **Non fait** : intégration dans le rendu three.js du prototype (le `vendor/` n'a pas `GLTFLoader` ; il faut aussi mettre le maillage à l'échelle de `teteR` et le raccorder au cou du corps procédural) ; mesure de poids/polygones (8000 par défaut) ; test de plusieurs têtes.
- **Choix à faire pour le kit 3D** : (a) décalque de face (§9 ter) : gratuit, interchangeable, mais de face seulement ; (b) maillage par tête (§9 quater) : toutes directions, mais 30 crédits par visage et plus de pièces séparables. Hybride possible : décalque pour les vues de face, maillage dès que l'angle compte.

### 9 quinquies — maillage de tête intégré au rendu 3D (5 novembre 2026)

Le kit déclare `visagesMaillage` (`maillage.ronde@1` : GLB `public/etape2/tete-ronde.glb`, 3 Mo) ; `identite.visage` peut le désigner comme les autres visages. `preparerModeles()` charge le GLB avant tout rendu (erreur explicite sinon) ; `dessiner3D` met la tête à l'échelle de la tête procédurale (hauteur crâne→menton = `2,16 × teteR`, centrée comme le crâne 2D) et supprime cou, épaules et débardeur du modèle par un **plan de coupe** (`coupe: 0,7` de la hauteur gardée depuis le haut, `hauteurMenton: 0,62` : à régler à la main par modèle). `dessiner3D(canvas, recette, kit, azimut)` accepte désormais un azimut (0 = face, π/2 = profil).

- **Ajout au `vendor/`** : `GLTFLoader.js`, `BufferGeometryUtils.js`, `SkeletonUtils.js` de three 0.185.1 (même version que le cœur), imports relatifs réécrits. Une première version sans `SkeletonUtils` cassait tout l'écran (import en échec) : détectée au navigateur, corrigée.
- **Vérifié** : 3 morphologies avec le maillage (même placement de la tête, cheveux raccordés aux épaules du corps procédural) ; angles 0°, 45°, 90°, 180° : le maillage montre face, trois-quarts, profil et dos, alors que le décalque (§9 ter) disparaît de profil. Tests 10/10 ; la console ne montre qu'un 404 sur `favicon.ico` (le prototype n'a pas d'icône), aucune erreur de script.
- **Limites** : réglage manuel de la coupe (bretelles grises du débardeur visibles de dos) ; **teint non recolorable** (texture cuite) ; **2D** : un visage maillage n'a pas de rendu 2D (repli sur le visage procédural, `identite.cheveux` s'applique) ; poids 3 Mo par tête (à comparer au budget mémoire du jeu) ; l'éclairage du maillage est celui, simple, du prototype ; une seule tête testée ; pas de contrôle automatique d'ancrage ni de comparaison 2D/3D pour ce visage ; le prototype n'a pas d'interface pour tourner (azimut accessible par code).

### 9 sexies — interface de rotation et contrôles des visages (5 novembre 2026)

- **Rotation du rendu 3D** : curseur −180°…180° (pas de 5°) et boutons Face / ¾ / Profil / Dos dans l'aperçu. C'est un paramètre de **vue** (pas dans la recette) ; il ne relance que l'aperçu et les vignettes taille jeu, pas la planche (3×3) ni les contrôles, qui restent de face pour rester comparables.
- **Contrôles automatiques ajoutés** (un par visage image ou maillage du kit) : ancrage au sol 2D et 3D (tolérance 3 px) ; pour un visage image, **sommet de tête 2D/3D** (tolérance 3 px) ; pour un maillage, **profil à 90° non vide**. Résultat constaté : image.roux@1 et image.mix@1 → écart d'ancrage max 0,7 px, sommets de tête à 1 px ; maillage.ronde@1 → ancrage 0,7 px, profil non vide. Tous verts, avec les 5 contrôles existants.
- **Limite** : le contrôle de profil du maillage ne vérifie que « non vide », pas la qualité (un maillage mal découpé passerait) ; le rendu 2D d'un visage maillage reste le repli procédural (donc l'aperçu 2D ne montre pas le même visage que le 3D pour ce choix).

## 10. Kit de visages « complet » v0 (5 novembre 2026)

Le kit compte maintenant **4 visages image et 4 maillages** (2 maillages ajoutés ensuite, voir plus bas) en plus des 2 visages procéduraux, pour 4 personnes distinctes (rousse courte, brune mi-longue, femme âgée aux cheveux gris, homme barbu). Coût de cette étape : environ 0,056 $ d'images (2 `reskin` à 0,015 $ + 2 `extraction` à 0,013 $) et 30 crédits Meshy (budget 3D de session : 95/100 — **il reste 5 crédits, soit plus aucun maillage possible sans relever le plafond**).

| Visage | Source | Rendu 2D | Rendu 3D | Teint recolorable |
|---|---|---|---|---|
| `image.roux@1` | planche rousse (§8 octies) | oui | décalque de face | oui |
| `image.mix@1` | mélange de 2 planches (§8 nonies) | oui | décalque de face | oui (réf. par planche) |
| `image.aine@1` | planche femme âgée (20261105-102734-tjn15g) | oui | décalque de face | oui |
| `image.homme@1` | planche homme (20261105-102719-vrlcjo) | oui | décalque de face | **non** (traits cuits dans le crâne : pas de `peauRef`) |
| `maillage.ronde@1` | Meshy (§9 quater) | repli procédural | maillage, toutes directions | non |
| `maillage.homme@1` | Meshy (20261105-102817-mxnb4a) | repli procédural | maillage, toutes directions | non |
| `maillage.roux@1` | Meshy (20261105-120227-po7dza, depuis 20261105-070415-bundzn) | repli procédural | maillage, toutes directions | non |
| `maillage.aine@1` | Meshy (20261105-120308-v55h8t, depuis 20261105-102650-u3w9a8) | repli procédural | maillage, toutes directions | non |

- **Maillages roux et aîné (ajout, 5 nov. 2026)** : 2 `image_vers_3d` Meshy sans rigging, un essai par personne, **60 crédits réels** (30 + 30 ; budget 3D de session : 60/200). GLB copiés en `public/etape2/tete-roux.glb` (3,0 Mo) et `tete-aine.glb` (3,5 Mo) ; entrées `maillage.roux@1` et `maillage.aine@1` dans `visagesMaillage` avec `hauteurMenton 0,62` ; **coupe réglée à l'œil sur rendu agrandi** (2048 px recadré tête-épaules, face et dos) : `coupe 0,58` pour le roux (plus de bretelles ni d'évasement net), `0,54` pour l'aînée (épaules plus larges dans le GLB ; à 0,58 il restait un liseré de peau au pied du cou). Contrôles au navigateur : ancrage ≤ 0,7 px pour les 8 visages, profil à 90° non vide pour les 4 maillages, tests 10/10. Rendus regardés à 0°, 45°, 90°, 180° (roux) et 0°, 90°, 180° (aîné) : tête présente et orientée correctement, puis revus en grand après réglage : tête centrée, aucune bretelle visible de dos ni de face, menton intact. **Limite** : un très léger liseré de peau peut subsister au pied du cou de l'aînée ; réglage purement visuel.
- **Réglage de la coupe roux/aîné (5 nov. 2026)** : rendus en grand (têtes recadrées 1200×1680, 0°/45°/90°/180°). Avec `coupe 0,7` et `0,64` les bretelles grises du débardeur restent visibles de chaque côté du cou (plus nettement chez l'aînée) ; à `0,58` elles disparaissent de face et de dos, menton et cou entiers. `coupe` passée à **0,58** pour `maillage.roux@1` et `maillage.aine@1` ; `hauteurMenton 0,62` inchangé (menton cohérent à l'œil, non mesuré). Contrôles au navigateur : 13/13 verts, console sans erreur ; tests 10/10. Même réglage ensuite appliqué à `maillage.ronde@1` (0,7 → 0,58) et `maillage.homme@1` (0,64 → 0,58) après comparaison à l'œil de face et de dos : les 4 maillages sont à `coupe 0,58`.
- **Outil de repérage** : `outils/composantes_planche.py planche.png` liste les pièces d'une planche (rect au format du kit, taille, surface). Le rôle, l'échelle `k` et le centre restent décidés à la main, puis affinés à l'œil : la femme âgée a été bonne du premier coup (mêmes facteurs que la rousse, adaptés à la taille des pièces) ; l'homme a demandé 3 itérations (menton, taille et position de la barbe).
- **Nouveauté du contrat** : un calque de rôle `barbe` (surcouche posée sur le crâne, comme un trait) et un `peauRef` facultatif : sans lui, la peau n'est pas recolorée.
- **Contrôles** (11/11 verts au navigateur) : ancrage 2D/3D ≤ 0,7 px pour les 6 visages ; sommets de tête 2D/3D à ≤ 1 px pour les 4 visages image ; profil non vide pour les 2 maillages. Tests unitaires 10/10.
- **Constaté** : la planche homme dessine la tête avec ses traits, la barbe est donc un second volet à poser — le crâne est coupé au menton (0,82 de la hauteur) avec un bord plat visible de près ; sur le maillage de l'homme, les bretelles du débardeur restent visibles malgré la coupe (0,64) ; l'âge et la barbe viennent de la génération d'images, sans contrôle fin (fidélité des reskins au portrait demandé non mesurée : deux essais, deux réussites).
- **Pas fait** : réglage fin de la coupe des maillages roux/aîné, expressions multiples, vieillissement, une calibration automatique des rôles, la diversité de teint/ethnicité (une seule génération par personne), le branchement dans BeachlifeLike.

## 11. Export de sprites depuis une recette (5 nov. 2026)

**Ce qui existe.** `public/js/export.js` (`cheminSortie`, `recetteDeLot`, `mesurer`, `exporterLot`), page `/export.html`, lot d'essai `public/lots/demo.json`, route `POST /api/export/<segment>/<n>.png` du serveur (écrit dans `prototype/sortie/`, hors de `public/`). Un lot = `{segment, items:[{visage, morphologie?, stature?, teint?, tenue?, cheveux?, index?}]}` appliqué comme surcharge de `recetteExemple()`.

**Garde-fous** : recette invalide ou pièce manquante → l'élément est refusé avec le motif, rien n'est écrit ; rendu vide ou personnage touchant un bord du cadre → refusé ; côté serveur, nom `[a-z][a-z0-9-]{0,29}/<0-999>.png` seulement, PNG vérifié par sa signature, ≤ 1 Mo.

**Mesuré** (lot demo, 6 sprites) : 6 fichiers 256×256 RGBA relus sur disque, bas du personnage à y = 250 pour les six (sprites du jeu observés : bas entre 238 et 248, sur 3 fichiers seulement) ; hauteur du personnage 179–211 px selon la morphologie et la stature ; rendu regardé sur planche, console sans erreur. Tests 12/12 (dont 2 nouveaux : `cheminSortie`, `recetteDeLot`). Refus serveur constatés : PNG invalide → 400, nom hors contrat → 404.

**Limites.** 2D seulement ; `cheveux.piece` des visages image est ignoré (le visage porte ses cheveux) ; le lot ne sait surcharger que les champs ci-dessus (pas les couleurs de vêtement ni les motifs) ; aucun lien avec les segments, habitués ou variantes du jeu — les recettes d'un lot sont écrites à la main ; aucune copie vers `BeachlifeLike/.../assets/personnages/` ni mise à jour de son manifeste : cette étape reste à faire et à valider côté jeu ; sprites de groupe (`Vacancier.taille`) non traités ; budget textures du jeu (~92 pour 23 Mo) non évalué.

**Essai dans BeachlifeLike (5 nov. 2026).** Lot `public/lots/fetard-essai.json` : 2 sprites en tenue de soirée (`image.roux@1` fine, `image.homme@1` ronde), exportés en `fetard/7.png` et `fetard/8.png`, copiés dans `BeachlifeLike/prototype/public/assets/personnages/fetard/` et ajoutés à la fin de `public/assets/personnages/manifest.json` (le segment passe de 7 à 9 variantes). Sauvegarde du manifeste d'origine : `/private/tmp/claude-501/manifest-personnages.avant-essai.json`. **Retour arrière** : retirer les deux lignes `fetard/7.png` et `fetard/8.png` du manifeste et supprimer les deux PNG.

*Vérifié* : les 2 PNG et le manifeste (9 entrées pour `fetard`) sont servis en 200 par le jeu (`localhost:5182`) ; nouvelle partie démarrée, aucune erreur dans la console. *Non vérifié* : **l'apparition de ces sprites sur un visiteur dans le jeu** (aucun fêtard n'a été observé ; la requête réseau des PNG n'apparaît pas dans les mesures du navigateur, cause non élucidée). *À savoir* : passer de 7 à 9 variantes change `id % nb` pour les visiteurs anonymes (sans conséquence) et, pour les habitués déjà en sauvegarde mais pas encore affichés depuis le correctif `Habitue.apparence`, change aussi leur visage une fois. Je n'ai pas vérifié que les sprites `fetard` représentent une seule personne (ceux du jeu mesurent 169 px de large au lieu de ~90 pour les nôtres : ce sont peut-être des groupes), ni l'échelle d'affichage (nos personnages ~200 px de haut contre ~219 pour `fetard/0`).

**Examen à l'écran (5 nov. 2026)** : l'île 1 démarre sans bâtiment, donc sans vacancier (0 à 14 h 18 en x4) ; je n'ai **pas** attendu qu'un fêtard apparaisse en partie. À la place, les 9 sprites `fetard/0..8` ont été chargés depuis le serveur du jeu (9/9 se chargent) et dessinés à l'échelle exacte du jeu (cible 40 px de haut), puis ×4, côte à côte. Constats : (1) les fêtards du jeu sont **une personne par sprite** (la largeur de 169 px vient des poses et accessoires : verre en main, bras levés), mon doute sur des groupes était sans fondement ; (2) la **hauteur** est comparable (nos personnages ~31 px contre ~34 px à 40 px de cible) ; (3) le **style diffère nettement** : ceux du jeu sont détaillés, en pose dynamique avec accessoires, les nôtres sont des mannequins symétriques, bras le long du corps, aplats unis ; à taille réelle ils restent lisibles comme des personnes mais se distinguent des autres. Le rendu sur la carte (ombre, anneau d'habitué, teinte de nuit) n'est pas vu.

**Décision (5 nov. 2026)** : Jeremy garde l'essai en place (`fetard/7.png`, `fetard/8.png` + manifeste). Non commité ; l'écart de style avec les fêtards du jeu reste le point faible à traiter.

## 12. Poses et accessoire (2D) (5 nov. 2026)

**Pourquoi.** L'essai de §11 montrait un écart de style avec les fêtards du jeu (mannequins bras le long du corps contre poses dynamiques avec verre en main). Première réponse, limitée aux bras et à un accessoire.

**Contrat.** `kit.poses` : `repos` (rendu historique inchangé), `verre`, `danse`, `salut`. Chaque pose donne, par côté (1 = droite de l'image, -1 = gauche), deux angles en degrés `[bras, avant-bras]` mesurés depuis « pendant » (0) vers l'extérieur (90 = horizontal, 180 = vers le haut), et une liste `objets` tenus à la main (`cocktail` : verre, boisson orange, paille). Recette : `apparence.pose` (optionnel ; absent = `repos`) ; pose inconnue = erreur de validation. Les lots acceptent `pose`. Les manches suivent le bras plié (t-shirt, chemise, manteau passent par la même fonction).

**Vérifié.** Rendu des 4 poses sur 3 personnes, regardé en 256 px : bras pliés, levés, cocktail lisible une fois agrandi (première version trop petite, corrigée). Contrôles de la page : 13/13 verts, console vide (la pose par défaut ne change rien aux rendus existants). Tests 13/13 (1 nouveau). Lot `fetard-essai` ré-exporté (7 : roux, tenue de soirée, `verre` ; 8 : homme, tenue de plage, `danse`) et copié dans `BeachlifeLike/.../fetard/7.png` et `8.png` à la place des deux premières versions ; comparés aux `fetard/0..6` du jeu à 40 px de haut et ×4.

**Constat.** Plus d'énergie qu'avant et un accessoire qui se lit, mais **le style reste plat** (aplats unis, mains sans doigts, pas de profondeur) face aux illustrations détaillées du jeu ; l'écart est réduit, pas supprimé. Non vu : ces sprites sur un visiteur en partie.

**Limites.** Poses 2D seulement : le rendu 3D et les maillages ignorent `apparence.pose` ; angles réglés à l'œil, sans contrôle automatique (collision bras/tête, main hors cadre) hormis le refus de l'export si le personnage touche le bord ; un seul accessoire ; pas de jambes ni de buste inclinés ; la pose n'est pas encore dans l'interface de la page principale (lots et JSON seulement).

**Extension 3D (5 nov. 2026).** `kit.poses` est maintenant lu aussi par `rendu3d.js` : la géométrie du bras posé (épaule → coude → main) est une fonction pure du kit, `pointsBras(g, pose, cote)`, utilisée par les deux rendus (le rendu 2D a été refait pour l'utiliser, sans changement visible). En 3D, bras et manches suivent la pose (mêmes capsules en deux segments) et le `cocktail` est un verre conique translucide, une boisson orange et une paille (cylindres). Fonctionne avec les trois catalogues de visages. *Vérifié* : rendus 3D regardés pour 3 personnes (visage image roux, image mix, maillage homme) × 4 azimuts (0°, 45°, 90°, 180°) ; contrôles de la page 13/13 verts, console vide ; tests 13/13. *Limites 3D* : les bras restent dans le plan frontal (z = 0), donc à 90° un bras levé de côté se voit par la tranche et ne bouge jamais vers l'avant ou l'arrière ; le verre est petit et peu lisible à la taille du jeu ; la pose agit sur les bras seulement, pas sur le buste ni les jambes ; pas de contrôle automatique des poses (collision bras/tête, main hors cadre) ; poses non reliées au squelette des modèles 3D riggés (le compositeur ne les utilise pas) ; non testé dans un projet 3D réel.

**Sélecteur de pose (5 nov. 2026).** Liste « Pose » dans la section Apparence de la page principale ([index.html](../prototype/public/index.html), [app.js](../prototype/public/js/app.js)), alimentée par `kit.poses`. `repos` retire le champ `apparence.pose` de la recette (la recette reste identique à celle d'avant) ; les autres poses l'écrivent. Le sélecteur se resynchronise quand on applique un JSON. *Vérifié au navigateur* : choix de `verre` → aperçu 2D non vide, aperçu 3D rendu, JSON `"pose": "verre"`, planche 3×3 toute en pose `verre` ; retour à `repos` → champ absent du JSON ; JSON avec `pose: "moonwalk"` → « Refusée : pose inconnue : moonwalk » et sélecteur inchangé ; JSON avec `pose: "danse"` → sélecteur sur `danse` ; contrôles 13/13 verts, console vide. Pas de test automatisé de l'interface (la page n'en a pas). Limites inchangées : pas de contrôle automatique des poses ; la planche de contrôle applique la pose courante à toutes ses cases.

## 13. Corps paramétrique (6 nov. 2026)

**Pourquoi.** Trois morphologies fixes (7 coefficients chacune) ne rendent pas la diversité des corps. Référence consultée : curseurs de corps des Sims 4 (poitrine, taille, hanches, jambes, épaules, avant-bras, cuisses, pieds ; sources de fans, non officielles : [snootysims](https://snootysims.com/wiki/sims-4/sims-4-sliders-and-slider-mods/), [gamepressure](https://www.gamepressure.com/thesims4/clothes/zc6859)) et « macros » de MakeHuman (sexe, âge, muscle, poids, taille, proportions : [documentation](https://static.makehumancommunity.org/makehuman/docs/modeling_the_body.html)).

**Contrat.** `identite.morphologie` reste un **préréglage** (`fine`, `ronde`, `trapue`). `identite.corps` (facultatif) surcharge n'importe quel paramètre. 14 paramètres bornés (`kit.corpsBornes`) : les 7 du préréglage (hauteur, epaules, taille, ventre, hanches, jambes, bras) et 7 ajoutés, neutres par défaut (`kit.corpsDefaut`) : `cou` (épaisseur), `cuisses` et `mollets` (rayons haut/bas des jambes, raccord au genou), `jambesLong` (longueur des jambes, buste raccourci d'autant), `poitrine` (−1…1, bosse de largeur au niveau de la poitrine), `profondeur` (épaisseur avant-arrière du torse, 3D seulement), `tete`. Validation : nom inconnu, valeur non numérique ou hors bornes → refus explicite. Fonctions pures : `corpsResolu`, `geometrie` (étendue), `segmentsJambe`, et `corpsAleatoire(graine)` qui dérive les 14 paramètres de 4 facteurs latents corrélés (corpulence, musculature, silhouette masculine↔féminine, proportions des jambes) plutôt que de les tirer indépendamment. **Les coefficients de ce générateur sont choisis à la main : ils ne sont pas calibrés sur des données anthropométriques.** Une recette stocke les valeurs, pas seulement une graine (leçon du point H).

**Compatibilité vérifiée.** Empreinte pixel des rendus 2D et 3D (162 combinaisons : 3 préréglages × 3 tenues × 3 visages de types différents × 3 statures × 2 poses) mesurée AVANT et APRÈS : 162/162 identiques en 2D et en 3D. Une première version (jambe toujours coupée en deux tronçons) changeait des pixels de bord au genou en 2D ; corrigée en gardant un seul tronçon quand cuisses = mollets.

**Interface.** Section « Corps (paramètres fins) » : un curseur par paramètre (14), « Corps aléatoire », « Revenir au préréglage ». Changer de préréglage efface les surcharges.

**Vérifié.** Tests 16/16 (3 nouveaux : neutralité des défauts, surcharge et bornes, silhouette positive et sans saut aux bornes extrêmes pour les 3 préréglages). Au navigateur : 14/14 contrôles verts dont un nouveau (200 corps aléatoires : 0 recette invalide, 0 rendu vide, 0 hors cadre, ancrage 2D 0,7 px, 3D sur 20 corps 0,7 px) ; curseur, tirage, préréglage, réinitialisation et refus d'un JSON hors bornes essayés ; console vide. Balayage regardé à l'œil (épaules, cuisses/mollets, jambes longues/courtes, athlète) et 16 corps aléatoires avec les 4 visages : silhouettes bien distinctes, aucun cas absurde dans cet échantillon.

**Limites.** (1) Ce n'est **pas** encore le « profil de silhouette en spline » envisagé : la silhouette reste 3 ancres (hanches, taille, épaules) lissées + une bosse de poitrine, les membres restent des capsules ; les corps varient en proportions, pas en formes fines (poitrine presque invisible de face, aucun fessier, mollet, ni avant-bras distinct). (2) Macros d'âge et de silhouette non exposées comme curseurs (elles ne servent qu'au tirage aléatoire) et âge sans effet sur la posture ni la tête. (3) Vêtements suivent la silhouette par construction (même fonction de largeur), mais je n'ai regardé que les tenues plage et soirée sur l'échantillon ; manteau et pantalon aux bornes extrêmes non examinés. (4) Maillages 3D de tête : leur taille suit `tete`, sans test aux bornes. (5) Aucun test de corrélations réalistes ni de distribution du tirage ; pas de préréglages nommés supplémentaires. (6) Rien de cela n'est branché dans BeachlifeLike : les sprites exportés jusqu'ici n'utilisent pas `corps`.

**Macros (6 nov. 2026, suite de §13).** `identite.macros` (facultatif) : `corpulence`, `musculature`, `silhouette` (−1 plus féminine … +1 plus masculine), `proportions` (−1 jambes courtes … +1 longues) ∈ [−1, 1], `age` ∈ [0, 1] (0 enfant ≈ 6 ans, 0,5 adulte, 1 senior). `corpsDepuisMacros(macros)` en dérive d'un coup les 15 paramètres de corps (chaque macro agit sur plusieurs, comme dans MakeHuman). Ordre de résolution : préréglage de `morphologie` → macros (elles définissent tout le corps ; tout neutre = « adulte moyen », qui n'est **pas** l'un des préréglages) → surcharges de `identite.corps`. Nouveau paramètre `dos` (0…1, dos voûté : la tête s'abaisse de 0,025 H au maximum). Bornes élargies pour l'enfance : `hauteur` 0,62–1,1, `jambesLong` 0,85–1,1, `tete` 0,9–1,35. `macrosAleatoires(graine, {age})` remplace le tirage de corps (déterministe, dans les bornes) ; le bouton « Corps aléatoire » écrit des macros. Validation : macro inconnue ou hors bornes → refus. Interface : 5 curseurs de macros au-dessus des curseurs fins (15) ; changer de préréglage efface macros et surcharges.

*Vérifié.* Tests 18/18 (2 nouveaux : macros et tirage). Le test des bornes extrêmes a révélé un vrai défaut (dos voûté maximal : tête sous la ligne des épaules), corrigé en réduisant l'effet. Page : 14/14 contrôles verts, dont le tirage de 200 corps étendu à **tous les âges, enfants compris** (0 invalide, 0 vide, 0 hors cadre, ancrage 2D 0,7 px, 3D sur 20 corps 0,7 px). Essais dans la page : curseur d'âge → macros dans le JSON et curseurs fins mis à jour (âge 0,1 : hauteur 0,74, tête 1,21) ; curseur fin → `corps` ; aléatoire → macros seules ; préréglage → tout effacé ; JSON avec `age: 3` refusé. Rendus regardés pour 10 combinaisons (âges 0,02 à 1, mince/fort/corpulent, silhouettes opposées, 4 visages) : l'enfant et l'adolescent se lisent nettement, les corps adultes se distinguent bien.

*Limites.* (1) **Compatibilité des préréglages : la comparaison pixel par pixel faite à l'étape précédente (162/162) n'a pas pu être rejouée ici** (la référence stockée dans le navigateur avait disparu) ; remplacée par un test exact sur la géométrie des 3 préréglages (rayons de jambes, hauteur du cou, tête, `macros` absentes) et par les 14 contrôles de la page, ce qui est plus faible. (2) Le **senior est à peine lisible** : seuls `dos` et de petites baisses de taille et de carrure ; l'âge n'agit ni sur le visage ni sur la couleur des cheveux (ils viennent du catalogue de visages). (3) Les proportions d'enfant sont à l'œil (tête 1,3×, jambes plus courtes), non comparées à des courbes de croissance. (4) L'âge n'agit pas sur les vêtements (pas de tenues d'enfant ; un t-shirt d'adulte rétréci). (5) Les coefficients des macros sont choisis à la main, non calibrés. (6) Rien n'est branché dans BeachlifeLike.

**Tenues enfant et senior (6 nov. 2026).** *Précision sur la limite (4) ci-dessus* : les vêtements s'ajustent déjà à la silhouette (même fonction de largeur), donc un t-shirt s'adapte à un enfant ; ce qui manquait était des **pièces adaptées** aux âges, pas un redimensionnement. Ajouts au catalogue : `bas.jupe@1` (évasée, bordure), `haut.pull@1` (manches longues, bord côtelé, poignets, col), `tete.chapeau@1` (chapeau de paille : bord, calotte, ruban ; catégorie `tete`, couche 6, dessiné au-dessus des cheveux). Pose `canne` (accessoire `canne` tenu en main : tige et poignée). Deux tenues dans la valise d'exemple : `enfant` (t-shirt à cœur, jupe, chapeau) et `senior` (pull, pantalon, chapeau). La planche de contrôle prend maintenant autant de colonnes que de tenues (5, soit 15 cases). Pièces rendues en 2D et en 3D.

*Vérifié.* Tests 19/19 (1 nouveau : pièces présentes, recettes valides, jupe masque le slip, canne). Page : 15/15 contrôles verts dont un nouveau (5 tenues × 5 poses × 3 âges = 75 combinaisons : 0 invalide, 0 vide, 0 hors cadre, ancrage 2D 0,7 px) ; console vide. Rendus regardés : enfants (3 visages image + procéduraux) en jupe/chapeau, seniors en pull/chapeau/canne, en 2D, et en 3D avec têtes maillage de face, ¾, profil, dos. Deux défauts vus et corrigés : poignets du pull qui couvraient les mains (boules roses) → manche raccourcie, main visible ; chapeau trop haut au-dessus du crâne (mesuré : calotte 14 px au-dessus du sommet de tête à 1024 px) → abaissé.

*Limites.* (1) **Visages image en 3D** : seul le décalque de face existe, donc de profil ou de dos la tête disparaît et le **chapeau flotte** au-dessus du cou ; le chapeau ne tient bien qu'avec les têtes maillage (visage procédural non regardé en 3D de côté). (2) Chapeau : vu de face il masque une partie du front et des cheveux ; sa position est réglée à l'œil pour les têtes procédurales et maillage, non ajustée finement pour chaque visage image. (3) Pièces rudimentaires : la jupe est un trapèze évasé sans plis, le pull n'a pas de motif propre (le motif générique s'applique au pull en 2D, au décalque en 3D), la canne est une tige. (4) Pas de tenues d'âge pour les visages : une enfant avec `image.aine@1` garde un visage de personne âgée (les visages viennent du catalogue). (5) Le senior reste peu lisible par le corps seul ; le pull, le chapeau et la canne aident. (6) Rien n'est branché dans BeachlifeLike.

**Visages d'enfant et de senior (6 nov. 2026).** Deux visages image ajoutés, par le même procédé que la femme âgée (variante du portrait de base `20261104-211736-p4yh36`, puis planche d'extraction à fond transparent, puis `outils/composantes_planche.py`, puis définition à la main) :
- `image.enfant@1` : fillette de 7 ans, carré brun à frange (portrait `20261106-134307-h0drhy`, planche `20261106-134350-1c3wua` → `public/etape2/planche-enfant.png`). L'extraction a rendu la tête **avec ses traits** (au lieu d'une tête vierge) : le visage est donc une seule pièce (crâne + traits) plus les cheveux, **sans recoloration du teint** (comme `image.homme@1`).
- `image.ancien@1` : homme de 75 ans, cheveux et moustache blancs (portrait `20261106-134322-asuwws`, planche `20261106-134409-znsjoc` → `planche-senior.png`). Tête vierge + yeux, sourcils, nez, bouche, **moustache** (nouveau rôle de calque, non teinté) et cheveux séparés ; recoloration du teint branchée (`peauRef`).

*Coût réel* : 2 variantes à 0,015 $ + 2 extractions à 0,0128 $ ≈ **0,056 $** ; aucun crédit 3D (pas de maillage pour ces deux visages : leur rendu 3D est le décalque de face).

*Réglage.* Enfant : bon du premier coup (`menton 0,68`, cheveux `largeurRel 1,45`). Ancien : **deux essais** ; première version aux yeux trop grands et trop bas, bouche collée au menton, sourcils cachés par le chapeau → yeux `k 0,6` à y = 215, sourcils y = 180, nez y = 275, bouche `k 0,45` à y = 350, moustache `k 0,4` à y = 328, `menton 0,78`. Les proportions d'une tête réaliste ne sont pas celles des têtes de dessin animé des autres planches : **pas de réglage réutilisable d'une planche à l'autre**.

*Vérifié.* Page : 17/17 contrôles verts (les 2 nouveaux visages passent l'ancrage au sol à 0,7 px et le sommet de tête 2D/3D à 0 px), console vide ; tests 19/19 ; 12 visages dans la liste. Lot `public/lots/ages.json` (6 personnes : enfant, ado, adulte corpulent, homme musclé, ancien, aînée ; format de lot étendu à `macros` et `corps`) exporté en 6 PNG 256×256, relus sur disque, regardés sur planche à côté d'un fêtard du jeu.

*Limites.* (1) L'enfant a des **proportions d'adulte rondelet réduites** (le portrait de base est celui d'une personne corpulente) : joues pleines, cou épais ; elle se lit comme une enfant, mais pas comme un enfant mince. (2) Le visage ne dépend pas de l'âge des macros : choisir `image.enfant@1` avec `age: 0,9` donne un corps de senior à visage d'enfant, et inversement ; rien ne l'empêche. (3) Pas de teint recolorable pour l'enfant (et l'homme barbu). (4) Pas de maillage 3D pour ces visages ; avec le décalque de face, de profil ou de dos la tête disparaît (limite connue). (5) Une seule expression par visage. (6) Style toujours plus plat que les sprites du jeu (planche de contact ci-dessus) ; rien n'est branché dans BeachlifeLike.

**Lien âge ↔ visage (7 nov. 2026).** Chaque visage image ou maillage porte `age: [min, max]` (échelle de la macro `age`), **jugée à l'œil sur son portrait** : `image.enfant@1` 0–0,3 ; `image.roux@1`, `image.mix@1`, `maillage.roux@1` 0,3–0,75 ; `image.homme@1`, `maillage.ronde@1`, `maillage.homme@1` 0,3–0,8 ; `image.aine@1`, `image.ancien@1`, `maillage.aine@1` 0,75–1 ; les visages procéduraux n'ont pas de plage (tous âges). Fonctions pures du kit : `catalogueVisages`, `plageAgeVisage`, `visageCompatible`, `visagesCompatibles`, `visagePourAge` (garde le visage courant s'il convient, sinon la plage dont le centre est le plus proche), `ageAccordeAuVisage` (garde l'âge s'il convient, sinon le **centre** de la plage : le bord donnait un corps à peine d'âge, constaté puis corrigé).

*Comportement.* `validerRecette` renvoie `avertissements` (jamais bloquants) quand la macro `age` **explicite** est hors de la plage du visage ; sans macro `age`, aucun avertissement (les recettes d'avant restent muettes). Le rapport d'export de lot les reprend. Interface : la liste des visages affiche la plage et un ⚠ devant les visages incompatibles avec l'âge courant ; **bouger le curseur d'âge change le visage** s'il ne convient plus ; **choisir un visage** hors plage ramène l'âge au centre de sa plage (le corps passe alors aux macros) ; « Corps aléatoire » accorde aussi le visage ; un JSON incohérent est accepté avec l'avertissement. Un message `msgLien` dit ce qui a changé.

*Vérifié.* Tests 24/24 (2 nouveaux pour ce lien ; les 3 autres tests ajoutés viennent d'`anim.test.mjs`, que je n'ai pas écrit). Page : 18/18 contrôles verts dont un nouveau (couverture : chacun des 21 âges de 0 à 1 par pas de 0,05 a au moins un visage à plage ; `visagePourAge` toujours compatible ; avertissement émis pour un visage d'enfant à l'âge 0,9 et absent à 0,1), console vide. Essais dans la page : choix du visage enfant → âge 0,15 ; curseur d'âge à 0,9 → `image.aine@1` ; retour à 0,5 → `image.roux@1` ; visage adulte à 0,5 → rien ne bouge ; JSON enfant + âge 0,9 → avertissement affiché ; corps aléatoire → visage adulte ; à l'âge 0,95 la liste marque 7 visages sur 12.

*Limites.* (1) Les plages d'âge sont mon jugement sur des portraits générés, non mesurées ; seuls 3 visages couvrent les âges élevés et un seul l'enfance (0–0,3) : à l'âge 0,1 ou 0,25 le choix est unique. (2) L'accord **ne s'applique que dans l'interface** : un JSON ou un lot peut toujours associer un visage et un âge incohérents (avertissement seulement). (3) Choisir un visage d'une autre tranche d'âge **remplace les macros d'âge**, donc fait passer un corps « préréglage » à un corps « macros », qui n'a pas la même silhouette. (4) Les visages procéduraux, qui conviennent à tous les âges, ne sont jamais choisis automatiquement. (5) Pas de visage d'adolescent ni de personne de 50-60 ans : la tranche 0,3–0,75 est couverte par des visages d'adultes jeunes. (6) Rien n'est branché dans BeachlifeLike.


## 14. Lots automatiques par segment (7 nov. 2026)

**Ce qui existe.** `public/js/segments.js` (`SEGMENTS`, `genererLot`, `tirerItem`, `signature`), page `/lot-auto.html`, route de lecture seule `GET /api/jeu/<segment>/<n>.png` (sprites du jeu, pour comparaison), `outils/installer_dans_beachlife.mjs`. Un segment décrit : plage d'âge, visages permis, morphologies, plages de macros, statures, teints, poses pondérées, chaussures, tenues pondérées (pièces avec palettes de couleurs, matières possibles, motifs probabilisés). `genererLot(segment, n, graine, {debut})` tire des items, valide chaque recette (`validerRecette`), écarte les doublons visibles (visage, pose, morphologie, pièces, couleur du haut) et retourne `{lot, rejets}` ; même graine → même lot. `recetteDeLot` accepte maintenant `tenuePieces` (tenue complète) et `chaussures`.

**Mesuré.** Tests 32/32 (dont, par segment : 12 sprites valides, âge et visage cohérents, 12 signatures distinctes ; déterminisme ; décalage d'index). Page : 8 seniors et 8 fêtards générés sans rejet, rendus à côté des sprites du jeu ; export de 8 seniors vers `sortie/senior/7..14` ; essai à blanc d'installation : 8 copies + 8 entrées de manifeste annoncées, rien écrit dans le jeu.

**Limites.** Seuls `senior` et `fetard` sont décrits (le jeu en a 18). Il n'y a que 6 visages image : la diversité vient du corps, du teint, des tenues, des matières, des poses, pas de nouveaux visages. Rendu 2D seulement. Groupes (`couple`, `famille`) non traités. Style : mannequins aux aplats face à des illustrations détaillées en pose dynamique ; lisible à 40 px mais clairement distinct. Budget mémoire du jeu non évalué. Non vérifié : l'apparence en partie (ombre, anneau d'habitué, teinte de nuit).

## 15. Style du jeu par génération d'image pilotée par la recette (7 nov. 2026)

**Décision de méthode.** Le rendu procédural (2D/3D) ne rattrapera pas le style des sprites du jeu (illustrations 3D brillantes, grosse tête, pose dynamique). On garde le compositeur pour ce qu'il fait bien — décider QUI est le visiteur et COMMENT il est habillé, de façon contrôlée, variée et reproductible (graine) — et on délègue le style au générateur d'images, avec le guide de style du jeu (`beachlifeLIke-assets-graphiques.md`).

**Ce qui existe.** `description.js` : `nomCouleur` (hex → nom anglais), `anneesDepuisAge`, `descriptionPersonnage`, `promptPersonnage`, `STYLE_JEU`. `segments.js` : `libelle`, `segmentAnglais`, `look` par segment. `outils/prompts_lot.mjs` (prompts d'un lot), `outils/cadrer_sprites.py` (bibliothèque → 256×256). Tests 36/36 (couleurs, âge, descriptions sans identifiant interne et cohérentes avec la recette).

**Mesuré (pilote, 4 seniors).** Coût réel 0,0224 $ pour 4 images (0,006 $ pièce ; simulation annoncée 0,16 $, donc pessimiste ×7) ; budget de session 2 $, dépensé ~0,045 $ (deux essais). v1 (style seul) : recette respectée (rose pâle / bleu pâle / maille rose / canne / corps rond) mais personnages plus grands et élancés que ceux du jeu. v2 (ajout « chibi-like caricatural proportions with a large head and short stocky legs (about 3.5 heads tall) ») : proportions et rendu alignés sur les 7 seniors du jeu, vérifiés côte à côte à 150 px et à 40 px réels (×3 pour la lecture).

**Limites.** Le visage vient du générateur, pas du compositeur : bonne diversité, mais pas de contrôle fin ni de garantie de cohérence si on régénère. Les matières imprimées (tartan, vichy) et les motifs ne sont que décrits : à vérifier sur un lot qui en contient. Une seule graine, un seul segment, 4 images : pas de statistique sur le taux d'échecs (main en trop, chapeau absent, personnage coupé). Pas de contrôle automatique du résultat (recadrage seulement). Poses limitées aux phrases de `POSES`. Groupes non traités. Non installé dans le jeu, non vu en partie.

## 16. Résolution des limites du §15 (7 nov. 2026)

**Matières imprimées et motifs** : vérifiés sur un lot de 8 fêtards (graine 21) contenant 4 pièces imprimées, 9 matières, 4 motifs : vichy (rendu en carreaux rose/blanc), rayures, jeans, motifs cœur et soleil ressortent dans l'image. Le vichy est rendu avec d'autres couleurs que celles du motif d'origine (la couleur propre à la pièce n'est volontairement pas transmise pour les matières imprimées).

**Proportions** : l'essai v1 (consigne « chibi » pour tous) a mis en évidence une erreur de méthode : dans le jeu, les seniors sont trapus (~3,5 têtes) mais les fêtards et couples plus élancés (~5,5 têtes). Les proportions sont désormais un champ du segment (`proportions`), injecté dans le `style` passé à `generer_images`. Les seniors déjà générés restent reproductibles (style identique à celui enregistré). Régénérés en v2 : fêtards et couples, alignés sur les sprites du jeu à la vue côte à côte.

**Cadrage** : mesuré sur les 85 sprites 256×256 du jeu, le personnage tient dans une boîte de 225 px (0,88 × 256, moins s'il est large), centré, pieds à 247 px (0,965). Le cadrage précédent (205 px, 0,97) était trop petit de ~9 %. `cadrer_sprites.py` suit désormais cette convention.

**Contrôle automatique** (`controler_sprites.py`) : ÉCHEC bloquant (format, vide, bord touché, gabarit hors 0,70–0,90, pieds ±6 px de 247, coins opaques) ; AVERTISSEMENTS (morceau détaché > 3 %, flou > 20 %, couleur ou luminosité du buste éloignée de la recette). Étalonnage : accepte 28 sprites du jeu (4 segments) sans échec ; le seuil de flou a été relevé de 12 % à 20 % parce que le jeu va de 7 à 19,5 % (mesure sur 85). La zone de couleur du buste (30–48 % de la hauteur) a été corrigée après un faux positif lié aux proportions. **Mesuré sur les 16 sprites** : 0 échec ; 1 avertissement résiduel (`fetard/14`, vert émeraude rendu plus sombre que la recette : le générateur assombrit un « emerald green »).

**Groupes** : segment `couple` (groupe de 2, une femme et un homme, âges à ≤ 0,15 d'écart de macro). Un sprite = deux personnes, cadre `carre`, description « on the left … on the right ». 4 couples générés : les deux personnes, leurs tenues et leur proximité sont respectées. `famille` (3 à 5 personnes avec enfants) non traité.

**Fiabilité de la chaîne** : la correspondance image ↔ prompt se fait par le texte du prompt stocké dans la bibliothèque, pas par l'ordre de la liste (un échec relancé par l'outil, observé une fois sur 24 images, décale les identifiants). Coût cumulé de la session : ~0,19 $ pour 24 images générées (16 conservées) ; budget de session 2 $.

**Reste.** Visages contrôlés par le générateur (pas de contrôle fin ni de reproductibilité si on change de modèle) ; poses limitées aux 5 phrases de `POSES` ; `famille` et groupes > 2 ; 14 segments du jeu non décrits ; aucun de ces sprites n'est installé dans le jeu ni vu en partie (ombre, anneau d'habitué, teinte de nuit) ; budget mémoire des textures non évalué (16 sprites de plus ≈ +4 Mo de GPU si le rapport du jeu est de ~0,25 Mo par texture).

## 17. Correction du style « trop sexy », segments restants, installation (7 nov. 2026)

**Retour de Jeremy** : les fêtards et couples du §16 étaient « presque tous sexy ». Constat sur les images : silhouettes de mannequin, hauts courts, shorts très courts, peu de variété de corps.
**Causes (dans NOTRE prompt, pas seulement dans le générateur)** : `proportions` du segment (« lively and slender », « long legs », « graceful ») ; vêtements décrits sans coupe (« t-shirt », « shorts ») que le générateur raccourcit ; macros tirant vers le muscle (musculature jusqu'à 0,8) et le mince ; aucun gabarit dit.
**Correctifs** : `CLAUSE_FAMILIALE` dans `STYLE_BASE` (gens ordinaires de tous gabarits, vêtements décontractés et couvrants, torse couvert, pas de crop top ni de vêtement ajusté) ; coupes imposées dans `description.js` (t-shirt « regular-fit short-sleeved covering the waist », bermuda « knee-length », chemise « loose », pantalon « straight-leg ») ; gabarit toujours dit (`average-build`, `plump`, `stocky sturdy`, `soft round`) ; musculature ≤ 0,3 et corpulence tirée plus haut pour fêtards et couples (test : moyenne > 0). Vérifié sur les MÊMES 8 fêtards (graine 21) avant/après : gabarits variés, tenues couvrantes, style du jeu conservé.

**Limites du §15 traitées**
- *Visages* : traits décidés par la recette (couleur et coupe de cheveux, barbe, lunettes, crâne dégarni à partir d'un certain âge), donc reproductibles ; l'identité du visage reste celle que dessine le générateur.
- *Poses* : `attitude` = phrases par segment (canne, appareil photo, selfie stick, drone, planche de surf, sac à dos, tapis de yoga, bouteille de champagne, badge de croisière…), indépendantes des 5 poses du mannequin.
- *Groupes* : `groupe` générique (membres obligatoires/optionnels, adultes à âge proche, enfants avec `ageEnfant` et tenues propres, pas de jupe pour les garçons) ; `couple` (2) et `famille` (3 ou 4).
- *Segments* : 12 décrits (senior, fetard, couple, famille, sportif, routard, influenceur, vip, croisiere, ados, bienetre, evj), `look` repris du guide d'assets du jeu. `celeb-*` et `barman` (personnages nommés, hors recette) non traités.

**Incidents à connaître (non masqués)**
- *Crédit du compte OpenRouter* : un lot de 9 requêtes simultanées a échoué à 5/9 (« would exceed your available credits given your current in-flight requests ») alors que le budget du générateur (2 $) était à 0,27 $ dépensé ; par paires, ça passe. À surveiller : si les échecs reviennent, le solde OpenRouter est à regarder (hors de ma portée).
- *Filtre de sécurité* : refus des 2 prompts d'adolescents de 16 ans (`safety_violations`), et de 1 prompt de famille sur 2 (avec enfants de 10 ans). Je n'ai ni reformulé ni relancé ces prompts pour passer le filtre. `ados` est marqué `bloque` (prompts_lot refuse) ; les sprites ados du jeu sont inchangés ; `famille` n'a donc qu'un sprite (7) pour l'instant.
- *Mauvaise piste corrigée* : ados à « 18 ans » dans la première version du prompt (âge abaissé à 13–16 ans, puis refusé).

**Installé dans le jeu (31 sprites)** : senior 7–10, fetard 9–16 (7 et 8 : anciens mannequins déjà là), couple 7–8, famille 7, sportif 7–9, routard 7 et 9, influenceur 7–9, vip 7–8, bienetre 7–8, evj 6–7, croisiere 7–8. `installer_dans_beachlife.mjs` : essai à blanc puis écriture, 0 conflit, manifeste original sauvegardé. Vérifié : 126 entrées de manifeste, tous les fichiers présents, servis par le jeu (:5182), chargés par le navigateur (124 en 256², 2 en 512²), 0 erreur de console. **Non vérifié : apparition dans une partie** (la partie démarre sans bâtiment donc sans visiteur).

**Mémoire** : 31 sprites, 1,22 Mo de PNG. GPU : 0,25 Mo/texture selon le rapport du jeu (≈ +7,8 Mo, 92 → 123 textures, 23 → ~31 Mo) ou ~0,35 Mo avec mipmaps (≈ +10,8 Mo).

**Contrôle automatique** : 0 échec ; avertissements : influenceur 7 et 8 (3 % de pixels détachés = perche à selfie / drone, voulu).
**Reste** : les 2 images de `routard` (8), `vip` (9), `bienetre` (9), `evj` (8), `croisiere` (9), `couple` (9, 10), `famille` (8–10) sont décrites mais pas générées ; `ados` bloqué ; `celeb-*` et `barman` hors recette ; non vu en partie.
