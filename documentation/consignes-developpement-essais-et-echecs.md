# Consignes de développement — retour d'expérience du compositeur de personnages

Document écrit le 16 nov. 2026 à partir de la session « atelier à pièces ». Il sert à ne pas refaire les mêmes erreurs : comment travailler, ce qui a échoué et pourquoi, ce qui a marché.

## 1. Règles de travail (à appliquer en premier)

1. **Le style demandé n'est pas négociable.** Jeremy a demandé le style Beachlife (rendu 3D cartoon brillant). Livrer des formes dessinées par code « en attendant » est un échec, même annoncé en limite. Si le style n'est pas atteint, le dire d'emblée et ne pas présenter le résultat comme une réponse.
2. **Tester soi-même chaque risque qui décide du résultat, avant de répondre.** Ne jamais écrire « attention, 4 risques sur 5 ne sont pas vérifiés » : les vérifier (génération réelle, mesure, assemblage). Ne pas demander la permission de tester.
3. **Montrer l'image finale, en grand, assemblée.** Les mesures (IoU, dérive) ne remplacent pas le regard : un IoU de 1,000 a coexisté avec des corps doublés. Juger sur l'image, en pleine résolution, pas sur des vignettes.
4. **Une étape = un résultat visible et propre.** Ne pas empiler les chantiers (silhouettes, couleurs, branchement) avant que la base soit propre sur UN personnage.
5. **Ne jamais contourner un filtre de sécurité.** Le générateur a refusé des corps « en sous-vêtements » : adapter la demande (haut et short ordinaires), ne pas reformuler pour passer.
6. **Annoncer les coûts et rester dans le budget.** Tout cet essai a coûté environ 0,5 $ de génération (≈ 0,007 $ la planche, ≈ 0,018 $ une grille de retouches). Chercher avant de refaire (`chercher`), donner une `cle` à chaque appel, `voir_element` après chaque production.
7. **Dire la vérité sur l'état.** Pas de « c'est bon » quand il reste des défauts visibles ; lister les défauts restants.

## 2. Principe qui fonctionne : le gabarit = le squelette

Les pièces générées séparément ne s'alignent jamais (échelle, perspective, éclairage). Ce qui marche : un **gabarit commun** et des **retouches du même gabarit**.

- **Buste** à tête vierge, fond vert → grilles 3×3 où un seul élément est ajouté (yeux, nez, bouche, sourcils, coiffure) → calques alignés par construction.
- **Corps entier** à haut et short **magenta franc**, fond vert, pieds nus → grilles 4×2 où un seul vêtement change (gris uni pour être teint) → calques alignés.
- Le calque = la **différence** avec le gabarit, déjà dans ses coordonnées. Aucun placement à régler.

## 3. Essais et échecs (cause → correction)

| # | Essai | Résultat | Cause | Correction retenue |
|---|---|---|---|---|
| 1 | Pièces SVG dessinées par code | Style « mannequin », refusé | Mauvaise voie : le style vient du générateur | Planches du générateur |
| 2 | Une planche par famille de pièces (têtes, yeux, vêtements…) puis placement calculé | Pièces mal calées, échelles incohérentes | Rien ne relie les échelles de planches générées séparément | Gabarit commun |
| 3 | Grilles sur fond transparent demandé | Fond gris, pas d'alpha | Le mode variantes ne rend pas de transparence | Fond **vert pur #00FF00** + détourage par clé chromatique |
| 4 | Découpage par cases fixes | Fragments de cases voisines, traits de grille dans les corps | Le générateur déborde de ses cases ; lignes noires de grille | Retrait des traits fins (morphologie), rattachement par composante au centre de gravité |
| 5 | Liseré vert/jaune autour des silhouettes | Halo visible | Détourage sans reprise de couleur des bords | Couleur des bords = pixel plein le plus proche |
| 6 | Recalage par IoU de silhouette entière | Corps dédoublés | Les vêtements changent la silhouette | Recalage sur la **tête** + hauteur totale + affinage sur la peau |
| 7 | Agrandissement ×2 des cases pour les poser sur le gabarit | Flou | Rééchantillonnage | Travail à la **résolution native** de la grille |
| 8 | Vêtements gris sur gabarit gris | Gris du gabarit visible sous les calques | Impossible de distinguer vêtement de base et nouveau | Gabarit **magenta** (jamais confondu avec du gris) |
| 9 | Zone du calque remplie en semi-transparent | Gabarit visible à travers | Alpha progressif | Calque **opaque** sur la zone remplacée |
| 10 | Calques contenant peau + magenta | Plaques de peau décalées, mains en double, gants colorés au teintage | La différence prend aussi la dérive de la peau | Un calque ne contient **que du tissu** : on exclut magenta, peau, tout pixel saturé |
| 11 | Coupure haut/short fixée à la main | Bande magenta à la taille | Jointure ambiguë (haut et short se touchent) | Détection automatique : creux de luminance sur la colonne centrale |
| 12 | Une échelle par grille (hauts / bas / chaussures) | Corps fantômes | Les 3 grilles n'étaient pas dans le même repère | **Hauteur de figure fixe** commune à toutes les grilles d'une silhouette |
| 13 | Taille de tête mesurée sur le menton | Têtes de tailles très différentes selon les corps | Détection du menton instable chez les hommes | Taille de tête = **proportion fixe** de la hauteur de la figure |
| 14 | Coiffures extraites avec les épaules du buste | « Ailes » de peau aux épaules | Épaules recadrées par le générateur = contenu neuf | Exclusion de la peau des calques de coiffure |
| 15 | Corps lissé par inpainting biharmonique | Zones noires | Inpainting instable | Convolution normalisée de la peau voisine + ombres du vêtement |
| 16 | Corps de base à bords érodés | Trou à l'entrejambe | Érosion appliquée aussi à l'intérieur | Pas d'érosion sous l'entrejambe |
| 17 | Corps en sous-vêtements demandé | **Refus du filtre de sécurité** | Contenu | Corps à haut et short ordinaires ; ne pas contourner |
| 18 | Génération groupée | `fetch failed` / `terminated` | Serveur de génération instable | Relancer avec **la même clé** (pas de double paiement) |

## 4. Ce qui reste ouvert (au 16 nov. 2026)

- Le corps lissé déborde un peu des vêtements chez la femme forte et l'homme moyen : le générateur redessine le corps de quelques pixels plus étroit dans les cases. Piste : ajuster la largeur de chaque case sur celle du gabarit.
- Bande de peau plate à la taille, filets de dérive sur les bords, pieds sommaires.
- 4 silhouettes encore à produire (mince, fine, ronde, rond), chapeaux et lunettes.
- **Rien n'est branché dans `atelier.html`** : la page utilise encore l'ancien système.
- Voie de repli solide si le calque 2D reste fragile : les corps 3D riggés déjà présents (`outils/blender/`), où l'alignement est garanti par le squelette.

## 5. Checklist avant de montrer un résultat

- [ ] Le style est celui du jeu (pas un substitut).
- [ ] Assemblage réel de plusieurs variantes, vu **en grand**, pas en vignette.
- [ ] Aucun corps doublé, aucun halo, aucune plaque de peau, aucune bande de couleur du gabarit.
- [ ] Les mesures (IoU, dérive) sont notées **et** l'image a été regardée.
- [ ] Les défauts restants sont listés honnêtement.
- [ ] Coût de génération annoncé ; clés des appels conservées.
- [ ] Tests du projet verts (`cd prototype && npm test`), README à jour.

## 6. Commandes utiles

```bash
python3 outils/gabarits_produire.py            # extrait toutes les silhouettes (outils/gabarits.json)
python3 outils/gabarit_composer.py preparer    # corps lissés, tête, placements
python3 outils/gabarit_composer.py demo sortie.png 5   # planche de 8 personnages
cd prototype && npm test
```
