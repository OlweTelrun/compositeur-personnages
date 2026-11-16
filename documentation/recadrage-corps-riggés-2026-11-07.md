# Recadrage : retour à l'idée du compositeur (7 novembre 2026)

## Pourquoi
Les dernières séries produisaient chaque visiteur par génération d'image finie (le compositeur ne faisait que choisir et décrire). C'était contraire à l'idée de départ : **des silhouettes identiques, riggées et animées, auxquelles on ajoute n'importe quelle coloration, n'importe quel vêtement, n'importe quels yeux, bouche, nez** (point J de la revue du 3 novembre : « la génération d'assets par IA et l'assemblage ont été trop rapprochés »). Cette note rapporte les essais faits pour vérifier que l'idée tient avec de vrais corps riggés (Meshy, crédits autorisés : 1000 ; dépensé : 35), et propose l'architecture.

Images des essais : `recadrage-2026-11-07/`. Outils : `outils/blender/` (Blender 5.2 local, gratuit).

## Ce qui a été vérifié (mesuré, regardé à l'écran)

| Point | Résultat |
|---|---|
| Squelette commun | Les corps Meshy riggés ont le même squelette de 24 os (Hips, Spine, Spine01, Spine02, neck, Head, Left/RightShoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase…). Vérifié sur 2 corps très différents (femme ronde, homme mince). |
| Animation partagée | L'action « walking » d'un corps s'applique à l'autre sans retouche (image 3, rangée du bas). Une animation = n'importe quel corps. Blender ≥ 4.4 : il faut aussi assigner le *slot* de l'action (sinon rien ne bouge : piège rencontré). |
| Coloration | La texture Meshy est un atlas chaotique de petites îles (impossible à peindre à la main) mais ses trois couleurs (peau, sous-vêtement gris, sombre = cheveux/traits) se séparent par seuils HSV (corps 1 : 75 / 11 / 14 %, corps 2 : 71 / 11 / 17 %). `recolorer_texture.py` change peau, cheveux et couleur du haut en gardant l'ombrage (image 1). |
| Vêtements ajustés | Marche : le matériau d'un vêtement est posé sur les faces du corps concernées (limites définies par les os et des hauteurs RELATIVES : ourlet = fraction hanche→genou, etc.), UV cylindrique en mètres calculée au repos, donc la matière (denim, maille, vichy, tartan, lin issus de `materials`) suit la déformation. Zéro espace entre vêtement et peau. 3 types : t-shirt, short, pantalon. Les mêmes définitions s'appliquent aux deux corps (images 2, 3, 4). |
| Visage par pièces | Un décalque (plaque de peau + yeux + sourcils + nez + bouche, chaque pièce un paramètre) est projeté sur l'avant de la tête avec une UV calculée au repos et un masque par sommet : 3 visages différents sur la même tête (image 5). |
| Rendu | Blender local : 8 directions, fond transparent, cadrage commun, fidèle à l'animation. Gratuit. |

## Essais abandonnés (et pourquoi)
- **Vêtements en coques décalées** (copie des faces du corps, poussée le long des normales) : espaces et fissures de peau dans les plis (ventre), le lissage des positions déchire la coque. Gardé seulement pour les vêtements amples, non validé.
- **Peindre dans l'UV de Meshy** : atlas chaotique, impossible.

## Ce qui n'est PAS résolu (à dire clairement)
1. **Écart de style** : à côté des sprites du jeu (image 6), ces rendus 3D sont plus plats : pas d'illustration détaillée, visage minuscule, vêtements « peints » sur le corps. Les sprites générés par IA (série précédente) gardent l'avantage de style.
2. **Vêtements amples ou hors silhouette** (jupe, robe, manteau, chapeau, sac) : non testés ; ils demandent des maillages séparés ajustés au corps (transfert de poids) ou une simulation, donc plus de travail.
3. **Défauts de l'ajustement** : ventre/taille d'un corps rond où le sous-vêtement d'origine reste visible (la règle « corps du haut » ne couvre pas tous les plis), manches trop longues sur le corps mince (frontière d'os), petites pointes aux chevilles.
4. **Visage** : décalque schématique, bords imparfaits, traces de l'ancien visage peint ; à 40 px les traits ne se lisent de toute façon pas (§6 de la spec) ; une vraie bibliothèque de pièces au style du jeu reste à produire.
5. **Bibliothèque de corps** : 2 corps seulement (ronde, mince). Enfants, seniors, trapus, silhouettes féminines et masculines à produire (35 crédits Meshy chacun, soit ≈ 350 pour 10, dans les 1000 autorisés).
6. **Cheveux** : ils font partie du corps (texture + forme) ; changer de coiffure = changer de forme, non testé.

## Proposition (architecture recadrée)
1. **Corps de base** (silhouettes riggées) : une dizaine de corps neutres en sous-vêtements, A-pose, générés une fois (image → Meshy riggé).
2. **Animations** : bibliothèque de clips (marche, course fournis par Meshy ; autres clips compatibles Mixamo) appliquée à n'importe quel corps.
3. **Pièces** : *couleurs* (peau, cheveux, haut/bas) par classes ; *vêtements* en deux familles (ajustés = matériau sur les faces, validé ; amples = maillages séparés, à valider) ; *visages* en pièces (yeux, sourcils, nez, bouche), à produire dans le style du jeu avec l'IA UNE fois, puis réutilisées.
4. **Recette** : inchangée dans son principe (`segments.js` choisit corps, couleurs, vêtements, matières, pièces de visage, animation) ; elle pilote le rendu Blender au lieu d'un prompt.
5. **Rendu** : Blender → sprites 8 directions × animation + atlas (déjà en place, gratuit).
6. **IA d'image** : réservée à la fabrication des pièces, et optionnellement aux personnages « vedettes » (les sprites génératifs actuels restent possibles pour eux).

## Ordre proposé
1. Fermer l'écart de style du rendu (éclairage, contour, saturation, visage) sur les 2 corps actuels, en comparant à 40 px et à taille réelle avec les sprites du jeu.
2. Corriger l'ajustement (ventre, manches, chevilles) et ajouter les vêtements ajustés manquants (chemise, pull, manches longues).
3. Produire 8 corps de plus (≈ 280 crédits) puis valider la même tenue sur tous.
4. Tester UN vêtement ample (jupe) pour savoir si la voie « maillage séparé » est viable.
5. Bibliothèque de pièces de visage au style du jeu.
6. Brancher la recette de `segments.js` sur ce rendu et produire un lot comparé au lot génératif.

## Suite : bibliothèque de corps (8 nov. 2026)

**Fait.** 8 images de corps neutres (A-pose, tenue grise, fond blanc) générées et contrôlées (0,04 $) ; **4 converties en corps riggés** (140 crédits Meshy : homme trapu, femme moyenne, femme senior, garçon de 8 ans). Au total 6 corps utilisables (+ la femme ronde et l'homme mince des essais précédents), registre dans `prototype/public/corps/registre.json`. Dépense Meshy cumulée : 175 crédits sur les 1000 autorisés.

**Validé.** Les trois mêmes tenues (jean + maille, vichy + lin/short, rouge + tartan/short) sont posées SANS retouche sur les 6 corps, avec la marche propre à chaque corps : 18 combinaisons, 0 erreur (`outils/blender/composer_matrice.py`, planche `recadrage-2026-11-07/7-six-corps-trois-tenues.png`). La règle « vêtement = faces du corps limitées par os et hauteurs relatives » est donc bien indépendante de la silhouette.

**Défauts trouvés.**
1. *Taille* : Meshy normalise tous les corps à ~1,70 m (le garçon sort aussi grand qu'un adulte). Corrigé par un champ `echelle` (taille de conception / 1,70) du registre et l'option `--echelle` du rendu ; les tailles sont des valeurs de conception choisies à l'œil, pas des mesures.
2. *Cheveux blancs ou gris* : la recoloration par couleurs de texture les confond avec le sous-vêtement gris (la femme senior a des taches turquoise ou rouges dans les cheveux). Il faut des masques calculés sur la géométrie (groupe d'os Head au-dessus du front = cheveux ; torse et hanches = sous-vêtement) plutôt que sur la couleur.
3. Les défauts d'ajustement déjà notés persistent (ventre du corps rond, manches, chevilles) ; sur l'enfant les shorts deviennent des 3/4 (règles réglées pour des proportions d'adulte).

**Pas fait.** 4 corps restent à convertir (femme mince, homme rond, homme senior, femme athlétique) : leurs images de base sont prêtes (`en_attente` du registre) mais le plafond de crédits 3D du générateur pour cette session (200) est atteint (25 restants, un corps = 35). Relever `GIM_BUDGET_CREDITS_3D` du serveur MCP (relance de la session) débloque la suite.

## Fin de la bibliothèque de 10 corps (8 nov. 2026)

**Fait.** Les 4 corps restants (femme mince, homme rond, homme senior, femme athlétique) sont convertis et riggés (140 crédits, avec l'autorisation explicite de Jeremy de dépasser le plafond de 200 de la session MCP : conversion lancée par l'API du générateur avec `budget_credits_3d` = 1000 sur la même session, la comptabilité continue). **Dépense Meshy cumulée : 315 crédits sur les 1000 autorisés.** Registre : 10 corps dans `prototype/public/corps/registre.json` (le champ `en_attente` est supprimé).

**Validé.** Matrice 10 corps × 3 tenues = 30 rendus animés, 0 erreur (`recadrage-2026-11-07/8-dix-corps-trois-tenues.png`, `outils/blender/composer_matrice.py`).

**Défauts corrigés dans la foulée**
- *Cheveux blancs ou gris* : un masque calculé sur la géométrie (`masque_cheveux.py` : faces de la tête au-dessus de 52 % de sa hauteur) remplace le seuil de couleur. Les cheveux des seniors se recolorent (roux, blond…) sans taches turquoise sur le corps ; seuil choisi par essai sur la femme senior (0,62 laissait des mèches aux tempes).
- *Os de tête* : sur certains corps Meshy (femme mince) la peau de la tête est rattachée à `head_end` et non à `Head` ; les règles géométriques (masque de cheveux, projection du visage) acceptent maintenant `Head`, `head_end` et `headfront`.

**Reste visible sur la planche**
1. Ventre des corps ronds (femme ronde, homme rond) : le sous-vêtement d'origine apparaît entre le t-shirt et le short (taches blanches ou turquoise).
2. Cheveux de seniors : motif en « résille » (les boucles blanches d'origine restent visibles sous la teinte).
3. Enfant : shorts en 3/4, manches trop longues sur les corps minces (règles réglées pour des proportions d'adulte).
4. Écart de style avec les sprites du jeu (image 6), vêtements amples, visages par pièces à produire au style du jeu : inchangés.

## Correction de l'ajustement (8 nov. 2026)

**Méthode.** Un diagnostic (`DIAG_TROUS=1` avec `rendre_modulaire.py`) liste les faces du buste restées sans vêtement, par os dominant. Il a montré que le torse était couvert et que le sous-vêtement visible venait de deux zones rattachées à des os « voisins » : les **plis du ventre** (os de cuisse `UpLeg`, 0,94 à 1,07 m, au-dessus des hanches) et le **haut du torse / décolleté** (os `headfront`, 1,19 à 1,30 m) sur les corps ronds. Les mains et avant-bras restants sont normaux (bras nus).

**Corrigé** (planche `recadrage-2026-11-07/9-dix-corps-apres-ajustement.png`, 30 rendus, 0 erreur)
- Ventre des corps ronds : le t-shirt couvre les faces de cuisse situées au-dessus des hanches ; plus de taches blanches ou turquoise entre le haut et le short.
- Manches : la longueur est mesurée le long du bras (fraction épaule → coude, paramètre `manches`, 0,55 par défaut) au lieu de suivre les limites d'os, qui varient selon le corps. Les manches sont courtes et homogènes sur les 10 corps ; `manches` à ~2 donnerait des manches longues.
- Décolleté des corps ronds : les faces pesées sur un os de tête sous la base du cou sont couvertes.
- Réglage par corps : champ `ajustement` du registre (garçon : `shorts.longueur` 0,32).
- Cheveux clairs : ombrage aplati avec le masque géométrique.

**Amélioré seulement légèrement**
- Shorts du garçon : un peu plus courts, restent proches du genou.
- Cheveux des seniors : le motif en « résille » n'a pas disparu visiblement ; l'origine est probablement la géométrie des boucles du maillage plus que la texture. À traiter avec une teinte unie sur la zone de cheveux.

**Non corrigé**
- Petite tache turquoise au centre du décolleté de la femme ronde (quelques faces dont l'os dominant reste hors des groupes testés).
- Pointes de peau aux chevilles (frontière pantalon / pied).

## Test d'une jupe : vêtement ample (8 nov. 2026)

**Question.** Les vêtements « ajustés » (matériau sur les faces du corps) ne peuvent pas représenter une jupe : elle doit flotter autour des jambes. La voie « maillage séparé » est-elle viable avec le même squelette ?

**Réalisé** (`creer_jupe` dans `outils/blender/rendre_modulaire.py`). La jupe est un maillage séparé : une cloche elliptique autour du bassin, dont le rayon à chaque hauteur est pris sur la coupe réelle du corps (donc adaptée à chaque silhouette), plus une marge et un évasement croissant vers l'ourlet. Poids de peau : `Hips` en haut, de plus en plus répartis vers `LeftUpLeg` / `RightUpLeg` sur les côtés, poids nul devant et derrière ; elle suit les cuisses sans se déchirer. Paramètres : `longueur` (fraction hanches → genou, 0,9 = genou, 1,25 = sous le genou), `evasement` (fraction de la taille, défaut 0,12), `exposant` (forme de la cloche, défaut 0,8), `poids_jambe` (défaut 0,30 jusqu'au genou, 0,15 au-delà), matière et couleur comme les autres vêtements.

**Verdict.** Viable. 3 jupes (tartan au genou, courte en lin, longue en denim) × 10 corps = 30 rendus animés, 0 erreur, aucun trou visible à la fin (`recadrage-2026-11-07/10-dix-corps-trois-jupes.png`). Le motif (tartan, denim) suit les plis de la jupe pendant la marche. Les règles s'adaptent seules à toutes les silhouettes, enfant compris.

**Ce qui a failli mal tourner (et ce que j'en retiens)**
- Les genoux perçaient la jupe longue sur certains corps (un ovale de peau au milieu du tissu). Cause trouvée au zoom : une **erreur d'unité de ma part** (`evasement` lu en mètres dans le code alors que mes fichiers de tenue le donnaient en fraction de la taille : 0,16 m au lieu de 0,27 m). Corrigé : toutes les dimensions de la jupe sont en fraction de la taille.
- La mesure automatique de traversée (`--mesure-jupe` : rayon horizontal depuis chaque sommet de jambe ; s'il ne touche pas la jupe, la jambe est sortie) distingue la partie haute (où une traversée est un vrai défaut) du reste ; mais elle a **raté** le défaut ci-dessus (genou dans la partie basse d'une jupe longue) et donne des valeurs non monotones avec l'évasement. À utiliser comme indicateur, pas comme verdict : le contrôle visuel image par image a été décisif.
- Réglage mesuré : un poids de jambe plus bas est plus sûr (0,55 → jusqu'à 28 % de sommets hors jupe au genou, 0,30 → 9 à 22 %, 0,15 → moins).

**Limites**
- Jupe rigide autour du bassin (cloche qui suit les cuisses) : pas de simulation de tissu, pas de mouvement propre ; acceptable pour des sprites à 40 px, pas pour un gros plan. Une vraie simulation (Cloth Blender avec collision et épingle à la taille) n'a pas été essayée.
- Corps ronds : la jupe épouse le ventre puis les hanches et forme une double ondulation (« deux étages »).
- Garçon avec la jupe courte : le bas du t-shirt dépasse en bandeau rouge sous le tissu.
- Autres vêtements amples (robe d'une pièce, manteau, short large, chapeau, sac) : non testés ; la robe et le manteau demandent en plus des manches et des épaules ajustées au haut du corps.

## Écart de style : mesure et réglage (8 nov. 2026)

**Mesure** (`outils/stats_style.py` : sprites recadrés et ramenés à 225 px de haut, mesures sur les pixels opaques ; médiane de 92 sprites du jeu).

| Mesure | Jeu | Rendus avant | Rendus après |
|---|---|---|---|
| Saturation des pixels vifs (90e centile) | 0,81 | 0,58–0,62 | **0,83** |
| Contraste (écart-type de luminance) | 0,20 | 0,13–0,18 | **0,20** |
| Détail fin (gradient moyen) | 0,060 | 0,024–0,027 | **0,065** |
| Ombres (V < 0,2) | 2,4 % | 0 % | 1,0 % |
| Reflets clairs (V > 0,93) | 16 % | 5–8 % | 34 % (trop) |
| Luminance moyenne | 0,51 | 0,45–0,47 | 0,59 (un peu trop claire) |

**Ce qui a été changé** (`rendre_modulaire.py --style jeu`, `finition_style.py`, `composer_matrice.py` avec `STYLE=jeu`)
1. **Vue de face, caméra presque à hauteur d'yeux (10°)** : les sprites du jeu sont vus de face ; mon rendu était incliné à 30° (isométrique). C'était l'écart le plus visible.
2. **Éclairage à trois sources** (clé chaude, remplissage froid, contre-jour), ambiance modérée ; des lumières trop fortes brûlaient les peaux claires (clé 4,2 → 2,8).
3. **Matériaux** : brillance modérée (rugosité ≤ 0,6, reflet 0,45) ; à 0,42 / 0,7 les peaux avaient l'air en plastique, voire « chocolat » sur les teints foncés.
4. **Rendu suréchantillonné** (768 px réduit à 256, anti-crénelage EEVEE 96 échantillons) : détail fin ×2,4.
5. **Limites de vêtement lisses** : un masque par sommet interpolé et seuillé dans le shader remplace la sélection de triangles entiers ; fin des ourlets, cols et manches en dents de scie (visibles de face).
6. **Finition d'image** : saturation 1,0, contraste 1,4, gamma 1,1, exposition automatique par sprite (90e centile de luminance à 0,78, gain plafonné à ×1,35 : sans plafond les peaux foncées viraient à l'orange).

**Enseignements**
- Une recherche automatique de paramètres (108 combinaisons) a trouvé un optimum « statistique » (saturation 0,85, contraste 1,3, gamma 1,2) que l'œil a rejeté : peaux claires grises et ternes. Les statistiques servent à situer l'écart, pas à choisir le réglage (planche 11, gardée comme contre-exemple).
- Le décalque de visage par pièces (essai précédent) donne de GROS yeux ronds comiques et masque un visage peint par Meshy qui se lit mieux que lui : abandonné pour ce rendu.
- Un bug de ma part : un second `to_mesh` effaçait les attributs de masque et faisait disparaître les vêtements ; trouvé en comparant les images.

**Ce qui reste de l'écart (et pourquoi la lumière n'y change rien).** Planche 13 : les 10 corps sont maintenant proches des sprites du jeu pour la couleur, le contraste et le niveau de détail, mais restent d'autres personnages :
- Les sprites du jeu sont illustrés un par un : visages expressifs et souriants, coiffures détaillées, tenues dessinées (chemises à imprimés, bikinis, sacs), accessoires et poses. Nos corps sont neutres, debout, bras le long du corps, avec des vêtements unis ou des matières simples.
- Visage : la texture Meshy est suffisante à 40 px mais sans expression.
- Cheveux : volumes lisses, peu de détail.
- Les vêtements sont des aplats de matière sans plis, coutures ni accessoires.
La suite logique n'est donc plus le rendu mais le **contenu** : une bibliothèque de pièces (hauts, bas, coiffures, accessoires, expressions) dessinée dans le style du jeu, et des poses.

## Bibliothèque de pièces (8 nov. 2026)

**Livré** : `prototype/public/pieces/catalogue.json` (16 pièces + 8 imprimés + renvoi aux 8 matières de `materials`), planche de contrôle `outils/blender/catalogue_planche.py` (`recadrage-2026-11-07/14-catalogue-16-pieces-2-corps.png` : chaque pièce rendue ISOLÉE sur deux corps, de face et de profil).

| Famille | Pièces | Technique |
|---|---|---|
| Hauts (ajustés) | t-shirt, débardeur, chemise, pull | matériau sur les faces du corps, limites lisses ; variantes = paramètres (`manches`, `ourlet`, `encolure`) |
| Bas | short, bermuda, pantalon (ajustés) ; jupe, jupe longue (maillage séparé) | idem ; jupe = cloche aux poids de peau |
| Couvre-chefs | chapeau de paille, casquette | primitives rigides fixées à l'os `Head`, dimensionnées sur la tête réelle |
| Visage | lunettes de soleil | idem |
| Sacs et accessoires | sac à dos (`Spine02`), sac fourre-tout (main gauche), appareil photo (cou), ballon (main droite) | idem |
| Imprimés | hibiscus, monstera, petites fleurs, marguerites, ananas, coquillages (IA, 0,05 $ au total), rayures marines, pois rouges (construits par code) | textures répétables ; utilisables sur tout vêtement ajusté ou la jupe |

Toutes les pièces suivent la marche du corps (accessoires : poids 1,0 sur l'os ; `16-accessoires-marche-femme-moyenne.png`).

**Défauts rencontrés et corrigés**
- Accessoires gigantesques : les « mesures de tête » prenaient le groupe d'os `Head`, qui descend jusqu'au cou (hauteur 36 cm au lieu de ~24). La hauteur de tête est maintenant 0,14 × la taille du corps, largeur et profondeur mesurées dans cette hauteur.
- Imprimés IA : la génération par lots de 8 est refusée à moitié par le plafond de requêtes simultanées du fournisseur (4/8) ; relancés par paires. Un fondu croisé avec la copie décalée supprime la couture, mais laisse un fantôme sur les motifs réguliers (moiré sur les pois, bande floue sur les rayures) : ces deux-là sont construits exactement par code ; les motifs libres gardent un léger fantôme visible seulement en agrandissement.

**Limites (à ne pas masquer)**
- **Coiffures** : les cheveux font partie du maillage du corps ; on peut les recolorer (masque géométrique), pas les changer. Remplacer une coiffure demande des maillages de cheveux séparés (image → 3D de la seule coiffure, ou cartes de cheveux) : non tenté.
- **Expressions** : le visage est une texture fixe ; le décalque par pièces essayé plus tôt donne des yeux comiques. Pas de formes de visage animables.
- **Qualité des accessoires** : formes simples (boîtes, cylindres, ellipsoïdes), lisibles à 40 px mais loin des objets illustrés du jeu (selfie stick, planche de surf, parasol…).
- **Chemise et pull** ne se distinguent que par l'ourlet : ni col, ni boutons, ni côtes. Le débardeur montre des plaques claires aux épaules sur le corps trapu.
- **Pas de maillot** (bikini, short de bain), de robe d'une pièce, de manteau, de chaussures ni de lunettes variées.
- Le catalogue n'est pas encore relié à la recette : le champ `kit` donne la correspondance avec les identifiants de `kit.js`, mais `segments.js` ne produit pas encore de tenue Blender.

## Coiffures (9 nov. 2026)

**Livré.** 7 coiffures interchangeables (`cheveux.chauve|court|bob|long|queue|chignon|afro@1` dans `prototype/public/pieces/catalogue.json`, option `--coiffure` de `rendre_modulaire.py`), planche `recadrage-2026-11-07/17-sept-coiffures-3-corps.png` et essai réel sur les 10 corps avec leurs tenues et la marche (`18-dix-corps-dix-coiffures-3-tenues.png`, 30 rendus, 0 erreur).

**Méthode.** Les cheveux font partie du maillage du corps : changer de coiffure suppose d'abord de les faire disparaître.
1. *Masque des cheveux d'origine* par sommet, calculé AVANT tout remplacement de texture : dessus de la tête (géométrie : os de tête, au-dessus des yeux) + côtés et nuque (texels sombres ou clairs hors du visage, lus dans la texture d'origine) + cheveux ou queue qui retombent sur les épaules et le dos (texels sombres sous la tête). Le masque est interpolé et seuillé dans le shader : le matériau devient transparent là où il y avait des cheveux (rendu « dithered »).
2. *Calotte de crâne* à la couleur de la peau (sinon on voit l'intérieur creux de la tête), puis la coiffure : calottes elliptiques dont la ligne de coupe (front devant, nuque derrière) donne la frange et la nuque, plus des volumes (nappe, queue, chignon). Toutes les parties sont rigides sur l'os `Head`.

**Défauts rencontrés**
- Le bloc de coiffures n'avait pas été inséré (ancre de remplacement périmée après un ajout de diagnostic) : NameError à l'exécution ; corrigé.
- Calotte de crâne en ellipsoïde entier : elle recouvrait le visage peint ; découpée selon la même ligne de coupe que les cheveux.
- Frange en marches d'escalier (maillage trop grossier) : 40 → 96 segments.
- Queue de cheval et chignon flottant détachés de la tête : recouvrement avec la calotte et inclinaison.
- Afro en « champignon » trop large : rayons ramenés de 0,98 à 0,80.
- Les pièces sombres aux épaules de la femme ronde ressemblaient à des restes de cheveux ; c'est le liseré du sous-vêtement d'origine.

**Ce que ça donne.** Les 10 corps, y compris les cheveux longs ondulés d'origine (femme moyenne, femme ronde), la queue de cheval (femme mince, femme athlétique) et les boucles blanches des seniors, sont débarrassés de leurs cheveux d'origine sans restes visibles ; changer de coiffure ne coûte plus rien (pas de crédit, pas d'image générée).

**Limites (à ne pas masquer)**
- **Formes primitives** : calottes lisses, pas de mèches, pas de raie, pas de frange en mèches, pas de boucles. Les coupes « bob » et « court » ressemblent à des casques ou des bols vus de face ; à 40 px on lit une silhouette de cheveux, pas une coiffure dessinée comme dans le jeu.
- **Cheveux rigides** : ils bougent avec la tête seulement ; les cheveux longs ne se balancent pas et peuvent traverser les épaules si la tête tourne.
- **Masque réglé sur ces 10 corps** : sur un nouveau corps (autre longueur de cheveux, autre couleur de texture), il faudra le revérifier (seuils de couleur et de hauteur).
- **Teint du crâne** : il doit être passé explicitement (`peau`) ; une différence avec la peau réelle se voit sur le crâne chauve.
- **Transparence « dithered »** : léger grain au bord des zones masquées, atténué par le suréchantillonnage.
- Pas de barbe, moustache ni sourcils (la barbe d'origine, quand il y en a une, reste, car elle est dans la texture du visage).

## Expressions (9 nov. 2026)

**Livré.** 8 expressions (`neutre, sourire, grand_sourire, rire, surpris, colere, triste, clin_d_oeil`), option `--expression` de `rendre_modulaire.py`, planche `recadrage-2026-11-07/19-expressions-7-sur-6-corps.png` (7 expressions × 6 corps : homme trapu, femme moyenne, garçon, femme senior, homme senior, femme athlétique). Gratuit (rendu local).

**Méthode.** Le visage est une texture peinte sur un maillage sans formes d'expression : on déforme donc le MAILLAGE et la texture suit. Paramètres : `sourire` (−1 moue … +1), `ouverture` de la bouche, `sourcils_int` et `sourcils_ext`, `oeil_g` et `oeil_d` (fermeture). Sourire : coins de la bouche relevés et écartés, pommettes remontées ; bouche ouverte : mâchoire abaissée par une transition douce ; sourcils : bosses gaussiennes. Puis des superpositions de couleur par sommet : intérieur de bouche sombre, dents du haut, paupière à la couleur de peau et trait de cils.

**Ce qui a failli échouer, et la correction.** Le placement de la bouche et des yeux décidait de tout : des proportions fixes ou une détection par la couleur de la texture (lèvres, sclères) mettaient la bouche ouverte sur le nez ou les sourcils sur 4 corps sur 10 (nez ou cils pris pour la bouche). Les hauteurs ont donc été **lues à l'œil sur une règle graduée** superposée à un gros plan de face (`20-` et `21-regle-reperes-visage`), puis inscrites dans le registre (`visage.z_bouche`, `visage.z_oeil`, mètres absolus) ; elles priment sur la détection. Autres erreurs corrigées : décalage d'appel avant la définition de la fonction de mesure de la tête ; conversion couleur inutile qui donnait des paupières blanches ; sourire trop discret (amplitude ×1,7).

**Limites (à ne pas masquer)**
- Les expressions sont une **déformation lissée** : bouche ouverte = tache sombre à bords flous, pas une vraie bouche (pas de langue, de lèvres qui s'ouvrent ni de dents du bas) ; les dents n'apparaissent que sur certaines expressions et corps. À 40 px ça se lit comme une bouche ouverte ; en gros plan non.
- **Yeux fermés** : paupière peinte (couleur de peau + trait), pas de maillage de paupière ; le rire donne parfois un œil plus fermé que l'autre.
- Le sourire déforme aussi un peu le nez et le menton ; les sourcils fins de la femme senior se déplacent peu.
- Les repères du visage sont lus à la main pour ces 10 corps ; **un nouveau corps demande sa propre lecture** (ou une détection automatique plus robuste : faux sur 4 corps sur 10).
- Aucune animation d'expression (pas de transitions ni de clignement) ; testé seulement de face, en gros plan, sans coiffure ni marche.
- Pas encore branché sur la recette : `segments.js` ne choisit pas d'expression.

## Recette branchée sur le rendu 3D (9 nov. 2026)

**Livré** : `outils/blender/produire_lot.py <segment> <n> <graine> <index>` → `prototype/sortie/rendu3d/<segment>/<index>.png` (256×256, mêmes mesures que les sprites du jeu : boîte 225 px, pieds à 247 px) + `lot-3d.json` (corps, coiffure, expression et pièces de chaque personne). Il lit les recettes de `segments.js` (via `outils/prompts_lot.mjs`) et, pour chaque personne :
- **corps** : choisi d'après l'âge, le genre (macro `silhouette`), la corpulence, la musculature et la morphologie parmi les 10 corps du registre (enfant → garçon ; senior → femme ou homme senior ; etc.) ;
- **couleurs** : teint et couleur des cheveux appliqués à la texture du corps (masque géométrique) ;
- **tenue** : `tenuePieces` → pièces du catalogue (t-shirt, chemise, pull, short, pantalon, jupe, chapeau) avec couleur et matière de `materials` ;
- **coiffure** : déduite des traits de la recette (`ponytail` → queue, `bun` → chignon, `bob`, `tight curly` → afro, cheveux longs féminins → long, crâne dégarni → chauve, sinon court) ; **expression** : rire / grand sourire / sourire selon l'attitude ; **accessoires** : lunettes, appareil photo, sac à dos, sac fourre-tout, ballon d'après l'attitude ;
- **groupes** (couple, famille) : un rendu par personne, assemblés côte à côte à la même échelle.

**Mesuré** : 4 seniors, 4 fêtards, 3 couples, 2 familles (3 et 4 personnes), 3 sportifs = 16 sprites, 0 échec du contrôle automatique (`controler_sprites.py rendu3d/<segment>`). Une personne ≈ 15 s de rendu. Planches `22-` (seniors à côté des sprites du jeu) et `23-` (autres segments).

**Ce que ça démontre** : un lot varié (corps, âge, teint, tenue, matière, coiffure, accessoire, groupe) se fabrique **sans aucune image générée, sans crédit**, de façon reproductible (même graine → même lot), et dans un style cohérent. C'est le but de l'idée de départ.

**Ce que ça ne règle pas (constats sur les planches)**
1. **Style** : les personnages restent plus petits, plus réalistes et sans « tête de dessin animé » que les sprites du jeu (grosses têtes, poses, accessoires illustrés). L'écart de contenu annoncé plus haut est entier.
2. **Pas de pose** : tous debout, bras le long du corps (les poses canne, verre, danse, selfie ne sont pas rendues) ; accessoires simples.
3. **Vêtements ajustés trop collants** : pantalons et chemises à manches longues serrés comme des leggings ou une seconde peau (très visible sur les corps minces et musclés). Vu votre retour sur le style « sexy », c'est le **point à corriger en premier** : il faut un décalage ou une ampleur des vêtements ajustés, ou des formes amples par maillage.
4. **Informations de la recette ignorées** : motifs imprimés (soleil, cœur, rayures sur t-shirt), barbes et moustaches, chaussures, couleur de cheveux limitée à 9 teintes ; le chapeau flotte parfois au-dessus de la tête.
5. **Choix de corps grossier** : un seul corps d'enfant (garçon, y compris pour une fille) ; les filles en groupe de famille portent la jupe du garçon-corps.
6. Pas de variation d'expression ni de pose entre membres d'un groupe ; groupes sans contact ni attitude commune.
7. Rien n'est installé dans le jeu : ces sprites n'ont pas été comparés en partie.

## Poses (9 nov. 2026)

**Livré.** 6 poses de bras (`repos, hanches, salut, danse, verre, selfie`), option `--pose` de `rendre_modulaire.py`, planche `recadrage-2026-11-07/24-six-poses-3-corps.png` (3 corps) ; accessoires `verre` (cocktail avec paille) et `telephone` tenus dans la main droite ; branchées sur les attitudes de la recette dans `produire_lot.py` (cocktail, champagne ou verre → verre ; selfie ou smartphone → selfie ; dancing → danse ; waving → salut ; sinon repos ou mains sur les hanches). Lot pilote de 11 sprites (6 fêtards, 2 influenceurs, 3 seniors), 0 échec au contrôle automatique (`25-lot-avec-poses-vs-jeu.png`). Gratuit.

**Méthode.** Chaque os de bras (`LeftArm`, `LeftForeArm`, `RightArm`, `RightForeArm`, le même squelette pour les 10 corps) est tourné pour que son segment (tête de l'os → tête de son enfant) pointe vers une direction cible, parents d'abord ; mains et vêtements suivent par les poids de peau. Une pose = 4 directions.

**Piège trouvé.** Les poses ne changeaient d'abord presque rien alors que les rotations étaient numériquement exactes (direction atteinte à 10⁻⁷) : l'action « baselayer » d'une image intégrée au fichier du corps réécrit les os à chaque image. Il faut la détacher. Corrigé ; trouvé en vérifiant les valeurs avant de modifier la méthode.

**Limites (à ne pas masquer)**
- **Bras seulement** : jambes, tronc et tête restent droits ; pas de pose assise, penchée, d'appui sur une jambe, ni de canne, selfie stick, planche, parasol, sac tenu à la main gauche.
- **Déformation aux épaules** : bras levés, les t-shirts se plissent mal, les manches s'étirent (chemises à manches longues rayées ou unies : très visible), le tissu remonte sur le ventre ; des plaques du sous-vêtement apparaissent sous les aisselles (atténuées en peignant le sous-vêtement à la couleur de peau, pas supprimées).
- Les poses n'ont aucune variation : même salut pour tout le monde ; pas de poses de groupe coordonnées (un couple ne se tient pas la main).
- Le téléphone est un petit rectangle noir sans perche ; le verre est lisible à 40 px mais sommaire.
- Vêtements collants (cf. section précédente) toujours non corrigés.

## Vêtements amples : essai de coque (9 nov. 2026) — NON ABOUTI

**Objectif** : des hauts et bas qui ne moulent pas le corps (réponse au retour « trop collants »). **Seule la jupe** (maillage séparé, section précédente) est un vrai vêtement ample validé.

**Essai** : `mode: "coque"` dans `rendre_modulaire.py` (`creer_coque`) : copie des faces du corps (mêmes poids de peau, donc poses et animations), décalée radialement depuis l'axe du tronc, de chaque jambe ou de chaque bras, d'une valeur `ampleur` près de l'attache (épaules, hanches) qui grandit de `evasement` jusqu'à l'ourlet (le tissu tombe de l'attache). Limite lisse par masque de sommets dans le matériau (comme les vêtements ajustés), masque refermé par moyenne sur les voisins.

**Ce qui marche** (`recadrage-2026-11-07/26-` et `27-`) : la silhouette ample (t-shirt qui flotte, jambes de pantalon larges), avec matière, suivant la marche ; gratuit.

**Pourquoi non retenu**
- Trois versions successives n'ont pas supprimé : des **fentes et trous** dans le tissu (col et épaules, ovales sur les cuisses, bas de jambe), des plaques du sous-vêtement visibles.
- **Cause identifiée** : un décalage « radial » ne suit pas la géométrie là où la surface du corps change de direction (épaules et col, tournés vers le haut ; entre les cuisses, où les deux jambes se poussent l'une contre l'autre) ; le tissu rentre alors dans le corps. L'ajout d'une composante vers le haut et d'un affaiblissement entre les cuisses a atténué, pas corrigé.
- Deux fausses pistes écartées en route : sélection par triangles entiers (bords déchiquetés) et indices de sommets périmés après suppression de faces (masque aléatoire) ; corrigées.

**Piste sérieuse (non faite)** : fabriquer l'ample comme la jupe, en **maillage propre** (tube par jambe, tunique en cloche aux poids interpolés) au lieu de dériver du corps ; ou une vraie simulation de tissu (Cloth de Blender avec collision et épinglage). Alternative immédiate : **hauts et bas ajustés plus épais** (paramètre `ampleur` modeste) et tenues avec jupe, bermuda large et manches courtes pour limiter l'effet « seconde peau ».
- Rien n'a été branché sur `segments.js` / `produire_lot.py` : les lots continuent d'utiliser les vêtements ajustés (et leur défaut de moulage).

## Vêtements amples en maillage propre (9 nov. 2026) — PARTIEL

**Méthode** (`creer_tubes` dans `rendre_modulaire.py`, types `tunique`, `pantalon_large`, `short_large`) : au lieu de dériver du corps, des tubes d'anneaux elliptiques construits à part, comme la jupe. Le rayon de chaque anneau vient de la coupe réelle du corps à cette hauteur (sommets du groupe d'os concerné) + marge + évasement vers l'ourlet ; poids de peau interpolés entre os (hanches → cuisse → mollet → pied ; épine du bas vers le haut) ; centres et rayons lissés le long du tube. Pantalon = un anneau de bassin + un tube par jambe.

**Résultat par pièce**
- **Pantalon large / short large** : OUI sur les corps minces ou moyens, l'enfant et l'homme trapu (planches `28-` sur les 10 corps avec marche, `29-` après lissage) : jambes amples, sans trou, avec matière, qui suivent la marche. Fini le « legging ».
- **Corps ronds** (femme ronde, homme rond, partiellement femme senior) : le haut du pantalon et du short forme de gros bourrelets qui se chevauchent à la taille ; la coupe du bassin y est trop irrégulière. **Non résolu.**
- **Tunique** (tronc + manches courtes) : **RATÉE** (`30-tunique-ratee.png`) : volants aux épaules (les bras en A-pose s'écartent du tronc), bande saillante à la taille, coupes du tronc trop bruitées. Écartée.

**Erreurs de ma part en route** : bras inclus dans la coupe du haut (volants) corrigé en les excluant, sans suffire ; premier lancement avec un chemin relatif depuis le mauvais dossier.

**À faire pour terminer** : tunique = revoir le tube du tronc avec un lissage et un cadrage des épaules propres (ou une cloche comme la jupe, accrochée aux épaules par poids) ; bassin des corps ronds = anneaux plus nombreux et rayon imposé par le ventre. **Non branché** sur `segments.js` ni `produire_lot.py` : les lots continuent d'utiliser les vêtements ajustés ; les bas amples ne sont utilisables à la main que pour des corps non ronds.

## Vêtements amples : fin et branchement (9 nov. 2026)

**Tunique réparée** (`31-tunique-pantalon-large-5-corps.png`) : largeur d'épaules imposée par les os (le col ne s'effondre plus), rayons qui ne décroissent pas vers la taille (le tissu tombe des épaules), coupe du tronc sans les bras (fin des volants), évasement modéré, manches courtes ou longues (`manches`, fraction de la longueur du bras). Bassin : lissage renforcé (10 passes). Résultat : tunique + pantalon large cohérents sur les corps minces, moyens, l'enfant, l'homme trapu ; acceptables sur les corps ronds (le tissu tombe sur le ventre au lieu de former des bourrelets).

**Branché sur la recette** : `produire_lot.py` transforme désormais t-shirt, chemise et pull en `tunique`, pantalon en `pantalon_large`, short en `short_large` ; la jupe reste la jupe. `AJUSTE=1` rétablit les vêtements moulants. Lot pilote (4 fêtards, 2 couples) rendu sans erreur : plus aucun « legging » (`32-lot-vetements-amples-vs-jeu.png`). Contrôle automatique : 0 échec ; un seul avertissement, `couple/7` (« 46 % hors du plus grand morceau » = les deux personnes du couple ne se touchent pas : voulu).

**Défauts restants**
- **Bras levés** (salut, danse) : les tubes de manche ne suivent pas bien le mouvement : manche évasée qui flotte ou se détache de l'épaule.
- **Épaules nues** : un petit vide entre la manche et l'encolure laisse voir la peau et le sous-vêtement.
- **Petits triangles du bassin** qui dépassent sous l'ourlet de la tunique, sur les flancs ; ourlet de tunique rectiligne et un peu raide.
- Pas de col, boutons, poches, plis : aplat de matière ; l'écart de style avec les sprites du jeu est inchangé.
- Poche de pantalon ou de jupe, ceintures, chaussures : absents.

## Manches : correction (9 nov. 2026)

**Cause** : le tube de manche n'était lié qu'à l'os du bras ; bras levé, il ne suivait ni l'avant-bras ni le tronc : manche évasée qui flotte, détachée de l'épaule.

**Correction** (`creer_tubes`) : poids par anneau — près de l'épaule un mélange tronc (`Spine02`) / épaule / bras (la manche reste accrochée à la tunique), bras seul jusqu'au coude, puis fondu vers l'avant-bras (la manche longue plie avec le coude) ; la manche commence 10 % avant l'épaule, sous la tunique.

**Résultat** (`33-manches-poses-3-corps.png`, 3 corps × 5 poses : repos, salut, danse, verre, selfie) : les manches courtes et évasées suivent le bras en salut, danse, verre et selfie, sans se détacher ni flotter.

**Reste visible (essais d'ajustement : `34-…`)**
- **Dessus des épaules** : un peu de peau (ou de sous-vêtement) reste visible à l'épaule malgré un anneau d'épaule plus haut et plus large ; non résolu.
- **Petits triangles beiges aux flancs** : le bassin du short large dépasse sous l'ourlet de la tunique, malgré un bassin plus court et plus étroit ; atténué, pas supprimé.
- **Femme ronde** : la tunique forme un haut étroit sur la poitrine puis un évasement bas, et laisse le ventre à découvert au milieu ; même défaut déjà vu sur l'homme rond. Les coupes du tronc des corps ronds échouent par endroits (anneaux écartés), il faudrait imposer le rayon du ventre.
- Les hauts à manches longues (chemise, pull) n'ont pas été revérifiés en pose après ce changement.

## Tunique des corps ronds (9 nov. 2026)

**Causes trouvées** (diagnostic des rayons de coupe, `DIAG_TUNIQUE=1`) :
1. Les **plis du ventre** des corps ronds sont rattachés à l'os de la cuisse ; la coupe du tronc ne les comptait pas, donc le tissu était plus étroit que le ventre (ventre à découvert). Corrigé : les os `UpLeg` entrent dans la coupe, ce qui fixe aussi la largeur des hanches.
2. Des **plaques beiges** à travers la tunique : bas de la tunique et haut du short avaient presque le même rayon (z-fighting). Corrigé : la marge de la tunique (2,6) est nettement plus grande que celle du bassin (0,3), qui commence aussi plus bas (sous les hanches).

**Résultat** : tunique + pantalon large cohérents sur les 10 corps avec la marche (`35-tunique-pantalon-large-10-corps-marche.png`, 10 rendus, 0 erreur) et en pose sur 4 corps dont les deux ronds (`36-tunique-corps-ronds-poses.png`) : le tissu tombe des épaules en cloche sur le ventre, les manches suivent le bras.

**Défauts restants**
- Un petit morceau de pantalon perce sur le flanc de l'homme rond (deux fentes sur la planche en pose), et l'ourlet est légèrement asymétrique pendant la foulée.
- Peau visible sur le dessus des épaules (non résolu).
- Femme ronde : la tunique est large (silhouette en cloche) ; à 40 px elle se lit comme une robe-tunique ample.
- Les rings à z = 1,28 à 1,32 (poitrine) sont vides sur ce corps (coupe sans sommets), le haut est donc tendu entre deux anneaux plus espacés.

## Épaules de la tunique (9 nov. 2026)

**Diagnostic** (gros plans de face, de trois quarts et de profil, `38-epaules-diagnostic-avant.png`) : deux trous, pas un. (1) L'embouchure de la manche, côté cou, restait ouverte : on voyait l'épaule à travers. (2) La ligne d'épaule de la tunique était trop plate et trop basse par rapport à la pente convexe du trapèze : un triangle de peau entre le col et la manche.

**Corrections** (`creer_tubes`) : un **dôme** ferme l'embouchure de la manche (4 anneaux qui rétrécissent, rattachés comme le reste de la manche) ; la ligne d'épaule de la tunique passe de 2 à 3 anneaux plus hauts et plus larges (z = épaule + 0,075 H, 0,06 H et 0,04 H ; largeurs 0,85 et 1,08 de la demi-largeur d'épaules mesurée sur les os).

**Résultat** (`37-tunique-epaules-10-corps.png`, 10 corps avec marche, 0 erreur) : épaules couvertes sur 9 corps sur 10 à la taille du sprite. Le gros plan (`39-`) montre le gain surtout sur les corps fins (femme moyenne : épaules entièrement couvertes).

**Reste** : un petit triangle de peau au sommet du deltoïde sur les corps très musclés ou larges (homme trapu en gros plan, homme rond à l'épaule gauche) ; un morceau de pantalon qui perce encore sur le flanc de l'homme rond ; les épaules n'ont pas été revérifiées dans toutes les poses après cette correction.

## Autres corrections (9 nov. 2026)

**Vérifié (nouveau)** : les **manches longues** (`manches` 0,95) suivent le bras et plient au coude dans 4 poses (repos, salut, danse, verre) sur l'homme rond, la femme ronde et l'homme mince (`40-manches-longues-poses.png`). Le défaut annoncé plus haut (« manches longues non revérifiées ») est levé.

**Tenté, sans effet visible** : plafond du rayon du haut de la jambe (1,35 × le rayon médian) et bassin rétréci de 6 % contre les deux fentes en croissant sur le devant de la tunique de l'**homme rond** (poses repos et salut). Les fentes restent : leur origine n'est donc ni le tube de jambe ni le bassin, elle est probablement dans les anneaux du ventre de la tunique elle-même (anneaux de coupe incohérents sur ce corps). **Défaut non résolu**, à traiter en imposant le rayon du ventre. Les deux changements sont conservés (sans conséquence négative visible sur les corps ronds et trapu).

## Confinement de la tunique (11 nov. 2026)

**Diagnostic** (rendus par pièce, `tunique seule / short seul / les deux`) : les deux croissants beiges de l'homme rond n'étaient NI le bassin NI la tunique, mais le **haut des tubes de jambe** du short, qui affleurait la tunique (jeu minimal mesuré : 1 mm à z = 0,854 ; le bassin en avait 40). Les deux essais du 9 nov. (plafond du rayon de jambe, bassin à −6 %) touchaient donc les mauvaises pièces. Sans les jambes, les croissants disparaissent.

**Mesure** : `rendre_modulaire.py --mesure-percee` (sans rendu) donne, par image, la part des échantillons (sommets + centres de faces) de peau du tronc, de bassin et de jambes qui sortent de la tunique, le plus petit jeu et les bandes de hauteur touchées. Départ, homme rond en marche : jambes 12,6 % au pire, 6,2 % en moyenne.

**Correction** : `confiner_tunique()` repousse chaque sommet d'anneau de la tunique au rayon du point le plus lointain situé dessous (secteur angulaire de la tranche) + un jeu de 0,8 % de la taille ; jamais de rétrécissement, encolure intacte. Une première passe au repos, puis une passe sur toutes les images de l'animation : le pire écart par sommet est appliqué dans l'espace de repos (tunique et jambes suivent des os différents, les jambes qui se balancent la percent). Interrupteur de comparaison : variable `SANS_CONFINEMENT=1`.

**Résultat** : croissants disparus au repos, en salut/danse/verre et sur la marche des 10 corps (planches regardées, 0 erreur). Mesure : jambes en marche, moyenne 6,2 % → 1,8 % (pire image 12,8 %, localisée près de l'ourlet) ; jeu minimal au repos 7 mm. Effet de bord utile : les épaules sont mieux couvertes (le débardeur gris de la peau ne ressort plus sur l'homme rond).

**Reste**
- Le tissu de l'homme rond est un peu bosselé en marche (poussées par sommet sans lissage angulaire).
- Quelques éclats beiges minuscules à l'ourlet de la femme ronde ; un liseré gris (sous-vêtement du corps) sous l'ourlet du garçon.
- ~~Peau du flanc bras levés~~ : traité, voir la section suivante.
- Pas encore vérifié : chemise/pull à manches longues et jupe avec ce confinement ; les poses `selfie` et `hanches`.

## Peau du flanc, bras levés (11 nov. 2026)

**Deux causes distinctes** :
1. Le confinement lisait les maillages au repos ; en pose statique, le squelette déforme la peau (bras levé) alors que la tunique est bâtie sur les coordonnées de repos. Correction : en pose statique, `confiner_tunique` passe aussi sur l'état évalué. Mesure : peau qui sort de la tunique, femme ronde salut/danse 8,7 % / 12,6 % → 0,9 % / 0,5 % ; homme rond 2,5 % / 3,2 % → 1,0 % / 0,8 %.
2. Ce qui restait visible à côté du bras levé n'était pas de la peau du flanc mais une **toile** : des triangles du corps étirés entre le bras et le ventre (jusqu'à x6 de leur longueur au repos), qui pendent le long du bras. Diagnostic par groupe d'os (`DIAG_TOILES=1`) : la toile relie des sommets de bras/avant-bras à des sommets de cuisse (plis du ventre) et de tronc ; le creux du coude s'étire aussi mais reste entre os du bras. Correction : `retirer_toiles()` supprime, en pose statique et avant de bâtir les vêtements, les faces dont une arête a plus que doublé (x2,2) et qui ne sont pas entièrement dans le bras. Sans ce tri, le coude de la pose « verre » se trouait (premier essai, vu et corrigé). Désactivable : `SANS_TOILES=1`.

Après les deux corrections : femme ronde 0,2 % / 0,2 %, homme rond 0,4 % / 0,6 % (salut / danse).

**Vérifié** : salut, danse, verre, selfie sur homme rond, femme ronde, femme moyenne, homme trapu : plus de toile, pas de trou au coude. **Limites** : `retirer_toiles` ne vaut que pour les poses statiques (la marche n'en montre pas) ; supprimer des faces peut laisser voir l'intérieur du corps si le vêtement ne couvre pas la zone (non rencontré) ; le seuil x2,2 est réglé à l'œil sur 4 corps. Reste un liseré gris minuscule sous l'aisselle de l'homme trapu en salut.

## Rejeu des 10 corps après confinement et retrait des toiles (11 nov. 2026)

**Rejoué** : 5 poses (repos, salut, danse, verre, selfie) × 10 corps = 50 rendus, et la marche (5 images) × 10 corps, tunique + short large, 0 erreur de rendu. Planches regardées.

**Résultat** : plus aucun croissant de jambe à travers la tunique, plus de toile de peau le long du bras levé, pas de trou au coude, épaules couvertes sur les 10 corps (poses et marche). Mesure `--mesure-percee` en marche, moyenne sur les images : peau 0,1–1,6 %, jambes 0,4–3,0 % ; pire image 16,2 % (femme ronde, jambes près de l'ourlet) et 12,8 % (homme rond), 3–8 % ailleurs.

**Défauts visibles restants** (aucun ne bloque) :
- **Homme rond** : la tunique est bosselée en marche, et en pose repos l'ourlet fait un rebord épais (effet du confinement : l'anneau du bas est repoussé de façon inégale). Un lissage angulaire des poussées est la piste suivante.
- **Femme ronde** : petits éclats clairs à l'ourlet et sur la cuisse, quelques éclats beiges sur la tunique à certaines images de marche.
- **Garçon** : liseré gris (sous-vêtement du corps) sous l'ourlet du short à deux images de marche.
- Les manches restent anguleuses en repos sur les corps ronds et le garçon (non traité).
- Chiffres de mesure relevés sur l'état de départ puis l'état final de l'homme rond seulement ; les autres corps n'ont pas de mesure « avant ».

## Lissage des poussées du confinement (12 nov. 2026)

**Défaut** : le confinement repousse chaque sommet indépendamment ; un sommet poussé à côté d'un voisin non poussé faisait une bosse (tunique de l'homme rond bosselée en marche).

**Correction** : dans `confiner_tunique`, les poussées sont étalées sur les voisins (angle périodique, anneaux voisins, moyenne 1-2-1), 4 passes, en reprenant à chaque passe le MAX avec l'original : la garantie « la tunique englobe ce qui est dessous » est conservée. Réglable : `LISSAGE_CONFINEMENT=n` (0 = ancien comportement).

**Résultat** (homme rond, marche, 0 contre 4 passes, même images) : la surface est nettement plus lisse, plus de bosses. Mesure de perçage en marche inchangée à ±1 point (homme rond jambes 1,8 → 1,9 % en moyenne, pire 12,8 → 13,5 % ; femme ronde, garçon, homme trapu identiques ou à 0,1 point près). Poses repos, salut, danse, selfie sur homme rond, femme ronde, garçon : rien de cassé.

**Correction de ma note précédente** : le « rebord épais » de l'ourlet de l'homme rond au repos n'en est pas un ; à pleine résolution c'est l'ombrage du bas de la tunique. Rien à corriger là.

**Nouveau détail** : en marche, la tunique lissée de l'homme rond recouvre un peu plus la main qui balance devant (main coupée par endroits) ; c'est le même croisement bras/tunique qu'avant, juste plus visible.

## Robe et manteau amples (12 nov. 2026)

**Approche** : pas de nouvelle géométrie. `creer_tubes` bâtit déjà la tunique (anneaux de coupe du corps + marge + évasement, `ourlet` réglable) ; une robe est une tunique longue sans pantalon, un manteau une tunique longue à manches longues dont on ne crée pas les faces du devant. Deux types ajoutés dans `TUBES` et `DEFAUTS_TYPE` (`rendre_modulaire.py`) :
- `robe` : ourlet 0,95 (genou), évasement 0,10, **sans manches** (de courtes manches évasées ressortaient en « cornes » : vu et corrigé).
- `manteau` : ourlet 1,05 (sous le genou), évasement 0,05, manches 0,95, `ouverture` 26° (angle total du devant ouvert, à partir de la poitrine ; le col reste fermé). Se porte sur un pantalon.
L'objet reste nommé `tunique` : le confinement et `--mesure-percee` le trouvent par ce nom. Le confinement accepte maintenant l'absence de bassin et de jambes de pantalon et compte alors les jambes nues (`LeftLeg`, `RightLeg`) comme intérieur : les jambes qui se balancent écartent l'ourlet de la robe au lieu de la percer.

**Vérifié** (rendus regardés) : robe sur femme ronde, femme moyenne, homme trapu, garçon en repos, salut, danse, marche ; manteau + pantalon large sur femme ronde, homme rond, homme mince, garçon en repos, salut, verre, marche. Aucune jambe ne perce la robe en marche. Non-régression : tunique + short large sur homme rond et femme moyenne (repos, salut, marche) identique.

**Limites** :
- Les deux sont des cloches : pas de taille marquée, la robe du garçon est un cône. Un vrai ajustement à la taille demanderait de laisser l'anneau se resserrer (aujourd'hui le tissu « tombe des épaules » et ne rentre pas).
- Poids de peau : tout le tube reste attaché au tronc ; c'est le confinement qui écarte l'ourlet quand les jambes bougent (ourlet large en marche), pas un vrai suivi des cuisses comme `creer_jupe`.
- Manteau : le bord de l'ouverture est une arête vive sans épaisseur ni revers ; le haut de l'ouverture montre un rectangle sombre (intérieur/peau du torse ombré) ; le débardeur gris du corps se voit dedans.
- Robe sans manches : le débardeur gris du corps ressort aux emmanchures (garçon, femme ronde en salut).
- Pas de mesure chiffrée de perçage pour ces types (`--mesure-percee` ne mesure que contre la peau et le pantalon) ; pas encore dans `catalogue.json` ni dans `produire_lot.py`/`segments.js`.

## Lien avec `segments.js` (12 nov. 2026)

**État réel avant** : `segments.js` alimentait déjà `produire_lot.py` (recette → corps + tenue + coiffure + expression → sprite), mais la correspondance « pièce du kit → type Blender » était codée en dur dans `produire_lot.py` (dict `PIECES`, `manches` par type) avec deux bricolages : le gilet rendu comme une chemise et le manteau comme un pull. Les 16 pièces du catalogue n'étaient pas lues.

**Fait**
- `prototype/public/pieces/catalogue.json` devient la source unique : chaque pièce liée au kit (`kit`) porte son type Blender (`blender`), sa version **ample** (`ample` : type de tube + paramètres, ex. t-shirt → tunique manches 0,45) et son ordre d'habillage (`couche`). Ajoutés : `haut.gilet@1` (tunique sans manches, marge 0,022), `haut.manteau@1` (type `manteau`), `robe.robe@1` (3D seulement, `kit: null` : le kit 2D/3D du prototype ne sait pas la dessiner, donc `segments.js` ne peut pas la tirer).
- `produire_lot.py` lit le catalogue (plus de dict en dur) et habille dans l'ordre des couches : l'intérieur d'abord.
- `rendre_modulaire.py` : `confiner_tunique` confine maintenant CHAQUE tunique (tunique, robe, manteau, gilet) autour de ce qui est dessous, y compris les tuniques précédentes ; le manteau a une marge plus forte (0,03) pour ne pas se disputer les pixels avec la chemise.
- `segments.js` : le segment `vip` gagne une tenue « long manteau de créateur » (poids 1 sur 6) et `tirerPiece` tire aussi les couleurs `revers` et `boutons`.
- Tests : 56 (2 nouveaux) : chaque pièce utilisée par un segment existe dans le catalogue avec type Blender et couche ; le manteau est tirable dans `vip`.

**Pilote** (`prototype/sortie/rendu3d/vip/`, graine 2, indices 0, 3, 9 ; pas installé dans le jeu) : de bout en bout sans erreur. Indice 0 : gilet vert sur chemise blanche (manches visibles sous le gilet) et pantalon large ; indices 3 et 9 : manteau ouvert sur chemise et pantalon, sur femme ronde et homme rond.

**Limites / à savoir**
- **Les tirages du segment `vip` changent** : une tenue de plus modifie la suite de tirages pour une même graine ; les 2 sprites VIP déjà installés dans le jeu (7–8) ne sont pas concernés (déjà rendus), mais régénérer le lot avec la même graine ne redonnera pas les mêmes tenues.
- Le manteau sur les corps ronds fait une cloche très large (aspect cape) à 256 px ; non retouché.
- Le gilet change de rendu par rapport à avant (sans manches au lieu de manches de chemise).
- `robe` n'est atteignable ni depuis `segments.js` ni depuis le kit (2D) ; pour la tirer il faudrait ajouter une pièce `bas.robe@1` au kit (rendu 2D/3D du prototype, description du prompt, validation).
- Les autres pièces du catalogue (casquette, bermuda, débardeur, jupe longue, lunettes, sacs) existent côté Blender mais `segments.js` ne les tire pas encore (lunettes et sacs passent par les mots de l'attitude).
- Seuls les corps `homme-trapu`, `femme-ronde`, `homme-rond` ont été rendus avec le manteau ; pas de mesure de perçage chiffrée.

## Lot 3D complet « pour le jeu » : rendu, contrôle, verdict (14 nov. 2026)

**Fait** : 4 sprites × 11 segments (ados exclu, bloqué) rendus par `produire_lot.py` (graine 20, indices à la suite de ceux du jeu : fetard 21, couple 12, famille 8, sportif 13, evj 8, vip 9, croisière 9, bien-être 9, routard 9, senior 14, influenceur 10), dans `prototype/sortie/rendu3d/<segment>/`. Planche comparée aux sprites du jeu : hors dépôt (dossier temporaire de la session). **Rien n'est installé dans BeachlifeLike.**

**Bug trouvé et corrigé en route** : `retirer_toiles` supprimait des sommets (puis, avec le contexte `FACES`, encore des sommets libres) ; la coiffure et les masques de cheveux étant indexés par sommet, le rendu plantait (`IndexError`) sur les corps de femme en pose statique, et le script abandonnait tout le segment. Désormais `FACES_ONLY` : seules les faces sont retirées, les sommets restent, et le confinement ignore ceux qui n'ont plus de face. Ce bug n'avait pas été vu avant car les poses de test n'avaient pas de coiffure.

**Contrôle automatique** (`controler_sprites.py`, adapté au dossier `rendu3d`) : 44 sprites au gabarit du jeu (256×256, pieds, bords, fond transparent). Seuls avertissements : morceau détaché sur 3 groupes (couple 12, famille 8 et 11), attendu pour des personnes côte à côte.

**Verdict à l'œil, honnête : ces sprites ne sont pas présentables dans le jeu.** Le contrôle technique passe, mais le style est très loin des sprites du jeu :
- ils restent des **mannequins** : sacs informes (tuniques amples sur tous les corps, surtout les ronds et chez les sportifs), couleurs unies, pas de motifs lisibles à cette taille, pas de détail de visage ni d'accessoire (verre, selfie, planche, chapeau à ruban) ;
- le **sens des segments se perd** : « sportif » et « influenceur » ressemblent à des gens en pyjama, pas à des surfeurs ou à des vloggers ; les couples et familles sont des figurants alignés ;
- seuls vip (manteau, gilet) et quelques seniors à chapeau se lisent.
Le jeu, lui, a des personnages dessinés, expressifs, avec tenues et accessoires identifiables. C'est l'« écart de CONTENU » déjà nommé dans le recadrage : le rendu 3D réglé en couleur/contraste ne le comble pas. À 40 px les tailles de silhouette passent, mais pas l'identité des segments.

**Recommandation** : ne pas installer ce lot. Pour les segments, la voie générative (`description.js` + générateur d'images, 31 sprites déjà dans le jeu) reste meilleure en style ; la voie 3D n'est utile que pour la cohérence (mêmes corps, animations partagées) si le style du rendu est repris autrement (tenues dessinées, textures peintes, accessoires, visages), pas en alourdissant le mannequin.
