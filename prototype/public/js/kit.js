// Contrat du kit « beachlife-v0 » et de la recette — source unique des proportions.
// Les deux rendus (2D canvas, 3D three.js) lisent la MÊME géométrie : c'est ce qui
// garantit l'ancrage au sol et la cohérence silhouette 2D / 3D.
// Unités : mètres, axe Y vers le haut, origine au sol entre les pieds, face vers +Z.

export const KIT = {
  id: 'beachlife-v0',
  version: '0.1.0',
  rendu: {
    taille: 256, // PNG transparent carré, comme les sprites visiteurs du jeu
    hauteurAffichee: 40, // hauteur à l'écran dans BeachlifeLike (px)
    cadre: 2.2, // hauteur du cadre en mètres
    sol: 0.97, // le sol est à 97 % de la hauteur de l'image, quelle que soit la stature
  },
  stature: { min: 0.92, max: 1.08 },
  morphologies: {
    fine: { hauteur: 1.0, epaules: 0.85, taille: 0.8, ventre: 0.0, hanches: 0.85, jambes: 0.85, bras: 0.8 },
    ronde: { hauteur: 0.95, epaules: 1.0, taille: 1.35, ventre: 1.0, hanches: 1.25, jambes: 1.1, bras: 1.15 },
    trapue: { hauteur: 0.86, epaules: 1.25, taille: 1.2, ventre: 0.4, hanches: 1.1, jambes: 1.15, bras: 1.3 },
  },
  // Corps paramétrique : `identite.morphologie` donne un PRÉRÉGLAGE ; `identite.corps` (facultatif) en surcharge n'importe quel
  // paramètre. Paramètres du préréglage : hauteur, epaules, taille, ventre, hanches, jambes, bras. Paramètres ajoutés
  // (neutres par défaut, donc les anciens préréglages se rendent à l'identique) :
  //   cou (épaisseur), cuisses, mollets (rayons des jambes haut/bas), jambesLong (longueur des jambes, buste raccourci d'autant),
  //   poitrine (bosse de largeur au niveau de la poitrine, −1…1), profondeur (épaisseur avant-arrière du torse, 3D), tete (taille de tête),
  //   dos (0…1, dos voûté : la tête s'abaisse).
  corpsDefaut: { cou: 1, cuisses: 1, mollets: 1, jambesLong: 1, poitrine: 0, profondeur: 1, tete: 1, dos: 0 },
  // Macros (facultatives, `identite.macros`) : définissent d'un coup les paramètres de corps (cf. corpsDepuisMacros). 0 = adulte moyen.
  macrosBornes: { corpulence: [-1, 1], musculature: [-1, 1], silhouette: [-1, 1], proportions: [-1, 1], age: [0, 1] },
  corpsBornes: {
    hauteur: [0.62, 1.1], epaules: [0.7, 1.4], taille: [0.7, 1.5], ventre: [0, 1.4], hanches: [0.75, 1.45], jambes: [0.75, 1.3], bras: [0.7, 1.5],
    cou: [0.8, 1.3], cuisses: [0.8, 1.4], mollets: [0.8, 1.3], jambesLong: [0.85, 1.1], poitrine: [-1, 1], profondeur: [0.8, 1.25], tete: [0.9, 1.35], dos: [0, 1],
  },
  visages: {
    v1: { tete: 1.0, ecartYeux: 0.34, bouche: 'sourire' },
    v2: { tete: 1.12, ecartYeux: 0.42, bouche: 'neutre' },
  },
  // Chaque visage image / maillage porte `age: [min, max]` (échelle de la macro `age`) ; les visages procéduraux n'en ont pas (tous âges).
  // Visages « en pièces » (images detourées produites par generateurImage, cf. spec §8 quater–nonies).
  // Un visage image = crâne + traits + cheveux ASSEMBLÉS à partir de planches d'extraction.
  // Coordonnées en pixels de la planche source (rect = [x0, y0, x1, y1[ ) ; k = échelle de la pièce ;
  // (x, y) = centre de la pièce dans le repère du crâne (origine en haut à gauche, largeur `ref`).
  // L'échelle et l'ancrage sont PROPRES À CHAQUE PLANCHE : à calibrer à l'import (spec §8 nonies).
  visagesImage: {
    'image.roux@1': {
      age: [0.3, 0.75], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'sourire', // champs lus par le rendu 3D (qui reste procédural)
      ref: 375, menton: 0.74,
      peauRef: { '/etape2/planche-roux2.png': [570, 80, 900, 420] },
      calques: [
        { role: 'oreille', src: '/etape2/planche-roux2.png', rect: [830, 620, 925, 781], k: 0.8, x: 8, y: 232.5 },
        { role: 'oreille', src: '/etape2/planche-roux2.png', rect: [990, 620, 1087, 781], k: 0.8, x: 367, y: 232.5 },
        { role: 'crane', src: '/etape2/planche-roux2.png', rect: [548, 44, 923, 589], k: 1, x: 187.5, y: 272.5 },
        { role: 'oeil', src: '/etape2/planche-roux2.png', rect: [1014, 154, 1193, 273], k: 0.6, x: 117.5, y: 232.5 },
        { role: 'oeil', src: '/etape2/planche-roux2.png', rect: [1286, 148, 1471, 273], k: 0.6, x: 257.5, y: 232.5 },
        { role: 'sourcil', src: '/etape2/planche-roux2.png', rect: [1014, 368, 1197, 425], k: 0.6, x: 117.5, y: 184.5 },
        { role: 'sourcil', src: '/etape2/planche-roux2.png', rect: [1280, 366, 1467, 425], k: 0.6, x: 257.5, y: 184.5 },
        { role: 'nez', src: '/etape2/planche-roux2.png', rect: [144, 620, 285, 735], k: 0.5, x: 187.5, y: 294.5 },
        { role: 'bouche', src: '/etape2/planche-roux2.png', rect: [434, 668, 677, 763], k: 0.5, x: 187.5, y: 352.5 },
      ],
      cheveux: { src: '/etape2/planche-roux2.png', rect: [40, 50, 471, 397], largeurRel: 1.05, hautRel: 0.1 },
    },
    // Mélange de deux planches : crâne et oreilles de la rousse, traits et cheveux de la première planche.
    'image.mix@1': {
      age: [0.3, 0.75], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'sourire',
      ref: 375, menton: 0.74,
      // zone de peau de chaque planche (médiane des pixels opaques) = couleur d'origine à remplacer par le teint
      peauRef: { '/etape2/planche-roux2.png': [570, 80, 900, 420], '/etape2/planche-elements.png': [100, 60, 320, 290] },
      calques: [
        { role: 'oreille', src: '/etape2/planche-roux2.png', rect: [830, 620, 925, 781], k: 0.8, x: 8, y: 232.5 },
        { role: 'oreille', src: '/etape2/planche-roux2.png', rect: [990, 620, 1087, 781], k: 0.8, x: 367, y: 232.5 },
        { role: 'crane', src: '/etape2/planche-roux2.png', rect: [548, 44, 923, 589], k: 1, x: 187.5, y: 272.5 },
        { role: 'oeil', src: '/etape2/planche-elements.png', rect: [1182, 148, 1473, 223], k: 0.86, x: 187.5, y: 232.5 },
        { role: 'sourcil', src: '/etape2/planche-elements.png', rect: [838, 158, 1105, 199], k: 0.92, x: 187.5, y: 184.5 },
        { role: 'nez', src: '/etape2/planche-elements.png', rect: [154, 422, 269, 503], k: 0.61, x: 187.5, y: 294.5 },
        { role: 'bouche', src: '/etape2/planche-elements.png', rect: [472, 440, 685, 511], k: 0.57, x: 187.5, y: 352.5 },
      ],
      cheveux: { src: '/etape2/planche-elements.png', rect: [404, 38, 765, 355], largeurRel: 1.69, hautRel: 0.12 },
    },
    // Femme âgée (cheveux gris) : même schéma que la rousse, planche d'extraction dédiée.
    'image.aine@1': {
      age: [0.75, 1], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'sourire',
      ref: 375, menton: 0.74,
      peauRef: { '/etape2/planche-aine.png': [600, 140, 930, 420] },
      calques: [
        { role: 'oreille', src: '/etape2/planche-aine.png', rect: [436, 608, 533, 765], k: 0.8, x: 8, y: 232.5 },
        { role: 'oreille', src: '/etape2/planche-aine.png', rect: [930, 608, 1025, 765], k: 0.8, x: 367, y: 232.5 },
        { role: 'crane', src: '/etape2/planche-aine.png', rect: [576, 80, 951, 621], k: 1, x: 187.5, y: 270.5 },
        { role: 'oeil', src: '/etape2/planche-aine.png', rect: [1058, 128, 1221, 247], k: 0.66, x: 117.5, y: 232.5 },
        { role: 'oeil', src: '/etape2/planche-aine.png', rect: [1302, 128, 1461, 247], k: 0.66, x: 257.5, y: 232.5 },
        { role: 'sourcil', src: '/etape2/planche-aine.png', rect: [1030, 324, 1217, 387], k: 0.6, x: 117.5, y: 184.5 },
        { role: 'sourcil', src: '/etape2/planche-aine.png', rect: [1298, 326, 1479, 387], k: 0.6, x: 257.5, y: 184.5 },
        { role: 'nez', src: '/etape2/planche-aine.png', rect: [1178, 476, 1327, 601], k: 0.5, x: 187.5, y: 294.5 },
        { role: 'bouche', src: '/etape2/planche-aine.png', rect: [1112, 662, 1389, 749], k: 0.45, x: 187.5, y: 352.5 },
      ],
      cheveux: { src: '/etape2/planche-aine.png', rect: [26, 76, 547, 517], largeurRel: 1.3, hautRel: 0.1 },
    },
    // Fillette (7 ans) : la tête extraite porte ses traits (pas de pièces séparées exploitables) → pas de recoloration du teint.
    'image.enfant@1': {
      age: [0, 0.3], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'sourire',
      ref: 417, menton: 0.68,
      calques: [
        { role: 'crane', src: '/etape2/planche-enfant.png', rect: [892, 38, 1309, 601], k: 1, x: 208.5, y: 281.5 },
      ],
      cheveux: { src: '/etape2/planche-enfant.png', rect: [120, 48, 733, 537], largeurRel: 1.45, hautRel: 0.1 },
    },
    // Homme âgé (cheveux et moustache blancs) : tête vierge + traits séparés, comme la femme âgée.
    'image.ancien@1': {
      age: [0.75, 1], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'neutre',
      ref: 407, menton: 0.78,
      peauRef: { '/etape2/planche-senior.png': [600, 90, 920, 420] },
      calques: [
        { role: 'crane', src: '/etape2/planche-senior.png', rect: [554, 32, 961, 579], k: 1, x: 203.5, y: 273.5 },
        { role: 'oeil', src: '/etape2/planche-senior.png', rect: [84, 624, 221, 749], k: 0.6, x: 127.5, y: 215 },
        { role: 'oeil', src: '/etape2/planche-senior.png', rect: [280, 624, 415, 747], k: 0.6, x: 279.5, y: 215 },
        { role: 'sourcil', src: '/etape2/planche-senior.png', rect: [1046, 250, 1233, 331], k: 0.6, x: 127.5, y: 180 },
        { role: 'sourcil', src: '/etape2/planche-senior.png', rect: [1290, 248, 1481, 331], k: 0.6, x: 279.5, y: 180 },
        { role: 'nez', src: '/etape2/planche-senior.png', rect: [530, 618, 703, 783], k: 0.47, x: 203.5, y: 275 },
        { role: 'bouche', src: '/etape2/planche-senior.png', rect: [790, 672, 1017, 741], k: 0.45, x: 203.5, y: 350 },
        { role: 'moustache', src: '/etape2/planche-senior.png', rect: [1094, 644, 1477, 751], k: 0.4, x: 203.5, y: 328 },
      ],
      cheveux: { src: '/etape2/planche-senior.png', rect: [34, 82, 495, 427], largeurRel: 1.1, hautRel: 0.1 },
    },
    // Homme barbu : visage dessiné dans le crâne (traits cuits) → pas de recoloration du teint (pas de peauRef).
    'image.homme@1': {
      age: [0.3, 0.8], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'neutre',
      ref: 371, menton: 0.82,
      calques: [
        { role: 'crane', src: '/etape2/planche-homme.png', rect: [84, 362, 455, 835], k: 1, x: 185.5, y: 236.5 },
        { role: 'barbe', src: '/etape2/planche-homme.png', rect: [882, 106, 1227, 359], k: 0.78, x: 185.5, y: 292 },
      ],
      cheveux: { src: '/etape2/planche-homme.png', rect: [304, 18, 673, 311], largeurRel: 1.0, hautRel: 0.1 },
    },
  },
  // Visages « maillage » : vraie tête 3D (GLB Meshy, spec §9 quater). Rendu 3D seulement ; en 2D, repli sur le visage procédural.
  // Poses (2D) : angles des bras en degrés, mesurés depuis « pendant vers le bas » (0) vers l'extérieur (90 = à l'horizontale,
  // 180 = vers le haut), par côté (1 = droite de l'image, -1 = gauche) : [bras, avant-bras]. `repos` = rendu historique inchangé.
  // `objets` : accessoires tenus à la main (fin de l'avant-bras) du côté indiqué.
  poses: {
    repos: { bras: null, objets: [] },
    verre: { bras: { 1: [28, 168], '-1': [8, 8] }, objets: [{ cote: 1, type: 'cocktail' }] },
    danse: { bras: { 1: [112, 168], '-1': [66, 108] }, objets: [] },
    salut: { bras: { 1: [128, 172], '-1': [8, 8] }, objets: [] },
    canne: { bras: { 1: [12, 10], '-1': [8, 8] }, objets: [{ cote: 1, type: 'canne' }] },
  },
  // Matières (textures tileables fabriquées par outils/matieres_depuis_materials.mjs à partir du projet `materials`).
  // `teintable` : albedo gris clair multiplié par la couleur `corps` de la pièce ; sinon motif imprimé gardé tel quel.
  // `tuile` : côté d'une tuile de texture en mètres. Une pièce de la valise l'utilise avec `matiere: '<id>'`.
  matieres: {
    'tissu.denim@1': { src: '/matieres/tissu-denim.png', normale: '/matieres/tissu-denim-n.png', teintable: true, tuile: 0.25 },
    'tissu.lin@1': { src: '/matieres/tissu-lin.png', normale: '/matieres/tissu-lin-n.png', teintable: true, tuile: 0.25 },
    'tissu.maille@1': { src: '/matieres/tissu-maille.png', normale: '/matieres/tissu-maille-n.png', teintable: true, tuile: 0.2 },
    'tissu.tweed@1': { src: '/matieres/tissu-tweed.png', normale: '/matieres/tissu-tweed-n.png', teintable: true, tuile: 0.25 },
    'cuir.grain@1': { src: '/matieres/cuir-grain.png', normale: '/matieres/cuir-grain-n.png', teintable: true, tuile: 0.25 },
    'tissu.vichy@1': { src: '/matieres/tissu-vichy.png', normale: '/matieres/tissu-vichy-n.png', teintable: false, tuile: 0.5 },
    'tissu.rayures@1': { src: '/matieres/tissu-rayures.png', normale: '/matieres/tissu-rayures-n.png', teintable: false, tuile: 0.5 },
    'tissu.tartan@1': { src: '/matieres/tissu-tartan.png', normale: '/matieres/tissu-tartan-n.png', teintable: false, tuile: 0.4 },
  },
  // hauteurMenton = fraction de la hauteur du modèle entre le haut du crâne et le menton ; coupe = fraction gardée depuis le haut
  // (le reste — épaules, débardeur — est supprimé par un plan de coupe).
  visagesMaillage: {
    'maillage.ronde@1': {
      age: [0.3, 0.8], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'sourire',
      src: '/etape2/tete-ronde.glb', hauteurMenton: 0.62, coupe: 0.58,
    },
    'maillage.roux@1': {
      age: [0.3, 0.75], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'sourire',
      src: '/etape2/tete-roux.glb', hauteurMenton: 0.62, coupe: 0.58,
    },
    'maillage.aine@1': {
      age: [0.75, 1], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'neutre',
      src: '/etape2/tete-aine.glb', hauteurMenton: 0.62, coupe: 0.54,
    },
    'maillage.homme@1': {
      age: [0.3, 0.8], // plage d'âge (macro `age`) dont ce visage a l'air : jugée à l'œil sur le portrait
      tete: 1.0, ecartYeux: 0.34, bouche: 'neutre',
      src: '/etape2/tete-homme.glb', hauteurMenton: 0.62, coupe: 0.58,
    },
  },
  // Emplacements nommés : (u, v) relatifs au torse du porteur (u −1..1 gauche→droite
  // à l'écran, v 0 = épaules .. 1 = ourlet). Ils suivent la morphologie.
  emplacements: {
    poitrine_gauche: { u: 0.45, v: 0.2 }, // « gauche » du porteur = droite à l'écran
    centre_poitrine: { u: 0, v: 0.3 },
    ventre: { u: 0, v: 0.65 },
  },
  // Zones du corps masquables (le corps de base est une couche, pas une texture).
  pieces: {
    'sous.slip@1': { categorie: 'sous', couche: 1, couvre: [], zones: ['corps'] },
    'haut.tshirt@1': { categorie: 'haut', couche: 2, couvre: ['torse', 'bras_haut'], zones: ['corps', 'col'] },
    'haut.chemise@1': { categorie: 'haut', couche: 2, couvre: ['torse', 'bras_haut', 'bras_bas'], zones: ['corps', 'col'] },
    'haut.gilet@1': { categorie: 'gilet', couche: 3, couvre: ['torse'], zones: ['corps', 'bordure'] },
    'haut.manteau@1': {
      categorie: 'manteau', couche: 4,
      couvre: ['torse', 'bras_haut', 'bras_bas', 'hanches', 'cuisses'],
      zones: ['corps', 'revers', 'bordure', 'boutons'],
    },
    'bas.short@1': { categorie: 'bas', couche: 2, couvre: ['hanches', 'cuisses_haut'], zones: ['corps'] },
    'bas.pantalon@1': { categorie: 'bas', couche: 2, couvre: ['hanches', 'cuisses', 'mollets'], zones: ['corps'] },
    'bas.jupe@1': { categorie: 'bas', couche: 2, couvre: ['hanches', 'cuisses_haut'], zones: ['corps', 'bordure'] },
    'haut.pull@1': { categorie: 'haut', couche: 2, couvre: ['torse', 'bras_haut', 'bras_bas'], zones: ['corps', 'bordure', 'col'] },
    'tete.chapeau@1': { categorie: 'tete', couche: 6, couvre: [], zones: ['corps', 'ruban'] },
    'cheveux.court@1': { categorie: 'cheveux', couche: 5, couvre: [], zones: ['corps'] },
    'cheveux.long@1': { categorie: 'cheveux', couche: 0, couvre: [], zones: ['corps'] },
  },
  motifs: ['coeur', 'soleil', 'rayures'],
};

/** Recette d'exemple : identité / garde-robe / apparence séparées. */
export function recetteExemple() {
  return {
    schema: 'recette/1',
    kit: `${KIT.id}@${KIT.version}`,
    graine: 1234, // sert à PROPOSER une combinaison, jamais à la reconstruire
    identite: {
      morphologie: 'ronde',
      stature: 1.0,
      visage: 'v1',
      teint: '#e0ac8a',
      cheveux: { piece: 'cheveux.court@1', couleur: '#4a2c17' },
    },
    garderobe: {
      valise: {
        plage: [
          { piece: 'haut.tshirt@1', couleurs: { corps: '#f4f1ea', col: '#2a6fdb' }, motif: { type: 'soleil', emplacement: 'poitrine_gauche', echelle: 1, couleur: '#f2b01e' } },
          { piece: 'bas.short@1', couleurs: { corps: '#1f9d8b' } },
        ],
        soiree: [
          { piece: 'haut.chemise@1', couleurs: { corps: '#7a1f3d', col: '#7a1f3d' }, motif: { type: 'rayures', emplacement: 'centre_poitrine', echelle: 1, couleur: '#a53a5e' } },
          { piece: 'bas.pantalon@1', couleurs: { corps: '#26262e' } },
        ],
        enfant: [
          { piece: 'haut.tshirt@1', couleurs: { corps: '#ffd23f', col: '#ef476f' }, motif: { type: 'coeur', emplacement: 'poitrine_gauche', echelle: 1, couleur: '#ef476f' } },
          { piece: 'bas.jupe@1', couleurs: { corps: '#4cc9f0', bordure: '#ffffff' } },
          { piece: 'tete.chapeau@1', couleurs: { corps: '#f4d58d', ruban: '#ef476f' } },
        ],
        senior: [
          { piece: 'haut.pull@1', couleurs: { corps: '#6d597a', bordure: '#b56576', col: '#b56576' } },
          { piece: 'bas.pantalon@1', couleurs: { corps: '#4a4e69' } },
          { piece: 'tete.chapeau@1', couleurs: { corps: '#d4c5a0', ruban: '#355070' } },
        ],
        jean: [
          { piece: 'haut.pull@1', matiere: 'tissu.maille@1', couleurs: { corps: '#c9a050', bordure: '#8a6a2a', col: '#8a6a2a' } },
          { piece: 'bas.pantalon@1', matiere: 'tissu.denim@1', couleurs: { corps: '#4a6fa8' } },
          { piece: 'tete.chapeau@1', matiere: 'tissu.tweed@1', couleurs: { corps: '#9a8a68', ruban: '#355070' } },
        ],
        ecossais: [
          { piece: 'haut.chemise@1', matiere: 'tissu.vichy@1', couleurs: { corps: '#ecebe6', col: '#2e4f8f' } },
          { piece: 'bas.jupe@1', matiere: 'tissu.tartan@1', couleurs: { corps: '#a8222a', bordure: '#2a3a6a' } },
        ],
        historique: [
          { piece: 'haut.chemise@1', couleurs: { corps: '#f1ece0', col: '#f1ece0' } },
          { piece: 'haut.gilet@1', couleurs: { corps: '#355c3f', bordure: '#c9a24a' } },
          { piece: 'haut.manteau@1', couleurs: { corps: '#5b1f2a', revers: '#8c3040', bordure: '#c9a24a', boutons: '#d8b45a' } },
          { piece: 'bas.pantalon@1', couleurs: { corps: '#3a3025' } },
        ],
      },
    },
    apparence: { tenue: 'plage', sousVetements: true },
  };
}

/**
 * Validation : sépare erreurs bloquantes et pièces manquantes. Politique du kit
 * pour une pièce absente du catalogue : REFUS EXPLICITE (jamais de remplacement
 * silencieux) — le jeu choisit alors de garder l'ancienne version ou de remplacer.
 */
export function validerRecette(recette, kit = KIT, catalogue = kit.pieces) {
  const erreurs = [];
  const manquantes = [];
  const id = recette.identite ?? {};
  if (recette.schema !== 'recette/1') erreurs.push(`schéma inconnu : ${recette.schema}`);
  if (!kit.morphologies[id.morphologie]) erreurs.push(`morphologie inconnue : ${id.morphologie}`);
  if (!kit.visages[id.visage] && !kit.visagesImage?.[id.visage] && !kit.visagesMaillage?.[id.visage]) erreurs.push(`visage inconnu : ${id.visage}`);
  if (id.corps !== undefined) {
    if (typeof id.corps !== 'object' || id.corps === null || Array.isArray(id.corps)) erreurs.push('corps : objet attendu');
    else for (const [nom, val] of Object.entries(id.corps)) {
      const b = kit.corpsBornes?.[nom];
      if (!b) erreurs.push(`paramètre de corps inconnu : ${nom}`);
      else if (typeof val !== 'number' || !Number.isFinite(val) || val < b[0] || val > b[1]) erreurs.push(`corps.${nom} hors plage ${b[0]}–${b[1]} : ${val}`);
    }
  }
  if (id.macros !== undefined) {
    if (typeof id.macros !== 'object' || id.macros === null || Array.isArray(id.macros)) erreurs.push('macros : objet attendu');
    else for (const [nom, val] of Object.entries(id.macros)) {
      const b = kit.macrosBornes?.[nom];
      if (!b) erreurs.push(`macro inconnue : ${nom}`);
      else if (typeof val !== 'number' || !Number.isFinite(val) || val < b[0] || val > b[1]) erreurs.push(`macros.${nom} hors plage ${b[0]}–${b[1]} : ${val}`);
    }
  }
  if (typeof id.stature !== 'number' || id.stature < kit.stature.min || id.stature > kit.stature.max) {
    erreurs.push(`stature hors plage ${kit.stature.min}–${kit.stature.max} : ${id.stature}`);
  }
  const verifPiece = (p, ou) => {
    if (!catalogue[p]) manquantes.push({ piece: p, ou });
  };
  if (id.cheveux) verifPiece(id.cheveux.piece, 'identite.cheveux');
  const valise = recette.garderobe?.valise ?? {};
  const tenue = recette.apparence?.tenue;
  const pose = recette.apparence?.pose;
  if (pose !== undefined && !kit.poses?.[pose]) erreurs.push(`pose inconnue : ${pose}`);
  if (!valise[tenue]) erreurs.push(`tenue absente de la valise : ${tenue}`);
  const chaussures = recette.apparence?.chaussures;
  if (chaussures !== undefined) {
    if (typeof chaussures !== 'object' || chaussures === null || Array.isArray(chaussures)) erreurs.push('chaussures : objet attendu');
    else {
      if (chaussures.matiere !== undefined && !kit.matieres?.[chaussures.matiere]) erreurs.push(`matière de chaussures inconnue : ${chaussures.matiere}`);
      if (chaussures.couleur !== undefined && !/^#[0-9a-fA-F]{6}$/.test(chaussures.couleur)) erreurs.push(`couleur de chaussures invalide : ${chaussures.couleur}`);
    }
  }
  for (const [nom, pieces] of Object.entries(valise)) {
    for (const e of pieces) {
      verifPiece(e.piece, `valise.${nom}`);
      if (e.matiere !== undefined && !kit.matieres?.[e.matiere]) erreurs.push(`matière inconnue : ${e.matiere}`);
      if (e.motif) {
        if (!kit.motifs.includes(e.motif.type)) erreurs.push(`motif inconnu : ${e.motif.type}`);
        if (!kit.emplacements[e.motif.emplacement]) erreurs.push(`emplacement inconnu : ${e.motif.emplacement}`);
      }
    }
  }
  // Avertissement (non bloquant) : visage dont l'air d'âge ne correspond pas à la macro `age` EXPLICITE de la recette
  const avertissements = [];
  const ageRecette = id.macros?.age;
  if (typeof ageRecette === 'number' && !visageCompatible(id.visage, ageRecette, kit)) {
    const p = plageAgeVisage(id.visage, kit);
    avertissements.push(`visage ${id.visage} prévu pour l'âge ${p[0]}–${p[1]}, recette : ${ageRecette}`);
  }
  return { ok: erreurs.length === 0 && manquantes.length === 0, erreurs, manquantes, avertissements };
}

/** Pièces portées, triées par couche, avec le masquage des sous-vêtements résolu. */
export function tenueResolue(recette, kit = KIT) {
  const pieces = (recette.garderobe.valise[recette.apparence.tenue] ?? [])
    .map((e) => ({ ...e, def: kit.pieces[e.piece] }))
    .filter((e) => e.def);
  const couvert = new Set(pieces.flatMap((p) => p.def.couvre));
  if (recette.apparence.sousVetements && !couvert.has('hanches')) {
    pieces.push({ piece: 'sous.slip@1', couleurs: { corps: '#e8e8ee' }, def: kit.pieces['sous.slip@1'] });
  }
  pieces.sort((a, b) => a.def.couche - b.def.couche);
  return { pieces, couvert };
}

/** Géométrie partagée 2D/3D, en mètres. */
/** Tous les visages du kit (procéduraux, image, maillage) par identifiant. */
export function catalogueVisages(kit = KIT) {
  return { ...kit.visages, ...kit.visagesImage, ...kit.visagesMaillage };
}
/** Plage d'âge [min, max] d'un visage, ou null (tous âges). */
export function plageAgeVisage(id, kit = KIT) {
  return catalogueVisages(kit)[id]?.age ?? null;
}
export function visageCompatible(id, age, kit = KIT) {
  const p = plageAgeVisage(id, kit);
  return !p || (age >= p[0] && age <= p[1]);
}
/** Visages dont la plage contient `age` (les visages sans plage conviennent à tous les âges). */
export function visagesCompatibles(age, kit = KIT) {
  return Object.keys(catalogueVisages(kit)).filter((id) => visageCompatible(id, age, kit));
}
/** Visage à garder pour cet âge : `courant` s'il convient, sinon le visage à plage dont le centre est le plus proche de `age`. */
export function visagePourAge(age, courant, kit = KIT) {
  if (courant && visageCompatible(courant, age, kit)) return courant;
  const avecPlage = visagesCompatibles(age, kit).filter((id) => plageAgeVisage(id, kit));
  const pool = avecPlage.length ? avecPlage : visagesCompatibles(age, kit);
  const centre = (id) => { const p = plageAgeVisage(id, kit); return p ? (p[0] + p[1]) / 2 : age; };
  return pool.sort((a, b) => Math.abs(centre(a) - age) - Math.abs(centre(b) - age))[0] ?? courant;
}
/** Âge pour ce visage : inchangé s'il convient (ou sans plage), sinon le CENTRE de sa plage (le bord donnerait un corps à peine d'âge). */
export function ageAccordeAuVisage(id, age, kit = KIT) {
  const p = plageAgeVisage(id, kit);
  return !p || (age >= p[0] && age <= p[1]) ? age : Math.round(((p[0] + p[1]) / 2) * 1000) / 1000;
}

/** Paramètres de corps résolus : préréglage de `morphologie`, défauts des paramètres ajoutés, macros (si présentes : elles définissent tout le corps), puis surcharges de `identite.corps`. */
export function corpsResolu(recette, kit = KIT) {
  const id = recette.identite;
  return { ...kit.morphologies[id.morphologie], ...kit.corpsDefaut, ...(id.macros ? corpsDepuisMacros(id.macros, kit) : {}), ...(id.corps ?? {}) };
}

export function geometrie(recette, kit = KIT) {
  const id = recette.identite;
  const m = corpsResolu(recette, kit);
  const v = kit.visages[id.visage] ?? kit.visagesImage?.[id.visage] ?? kit.visagesMaillage[id.visage];
  const H = 1.8 * m.hauteur * id.stature;
  const hanchesY = m.jambesLong === 1 ? H * 0.44 : H * 0.44 * m.jambesLong;
  const epaulesY = H * 0.77;
  const g = {
    H,
    hanchesY,
    tailleY: m.jambesLong === 1 ? H * 0.54 : hanchesY + (epaulesY - hanchesY) * 0.30303, // même fraction du buste qu'au repos
    epaulesY,
    teteR: H * 0.085 * v.tete * m.tete,
    demiEpaules: H * 0.13 * m.epaules,
    demiTaille: H * 0.095 * m.taille + H * 0.05 * m.ventre,
    demiHanches: H * 0.11 * m.hanches,
    jambeR: H * 0.045 * m.jambes,
    cuisseR: H * 0.045 * m.jambes * m.cuisses,
    molletR: H * 0.045 * m.jambes * m.mollets,
    brasR: H * 0.032 * m.bras,
    brasLong: H * 0.34,
    couR: m.cou, // multiplicateur de l'épaisseur du cou
    poitrine: m.poitrine,
    profondeur: 0.72 * m.profondeur, // épaisseur avant-arrière du torse (3D)
    visage: v,
  };
  g.genouY = g.hanchesY * 0.5;
  g.cou = g.epaulesY + H * 0.03 - H * 0.025 * m.dos; // dos voûté : la tête s'abaisse
  g.teteY = g.cou + g.teteR * 0.9;
  g.ecartJambes = g.demiHanches * 0.5;
  return g;
}

/**
 * Macros → paramètres de corps (les 14 + `dos`), à la MakeHuman : chaque macro agit sur plusieurs paramètres à la fois, ce qui garde
 * les corps cohérents. corpulence, musculature, silhouette (−1 plus féminine … +1 plus masculine), proportions (−1 jambes courtes … +1
 * jambes longues) ∈ [−1, 1] ; age ∈ [0, 1] (0 enfant ≈ 6 ans, 0,5 adulte, 1 senior). Tout à 0 / age 0,5 = adulte moyen (≠ préréglages).
 * Coefficients choisis à la main, NON calibrés sur des mesures anthropométriques.
 */
export function corpsDepuisMacros(macros, kit = KIT) {
  const c = macros.corpulence ?? 0, mu = macros.musculature ?? 0, s = macros.silhouette ?? 0, l = macros.proportions ?? 0, a = macros.age ?? 0.5;
  const ch = Math.max(0, (0.35 - a) / 0.35); // 0…1 : de l'adulte (0) à l'enfant (1)
  const ol = Math.max(0, (a - 0.6) / 0.4); // 0…1 : de l'adulte (0) au senior (1)
  const brut = {
    hauteur: 1.0 + 0.04 * s + 0.03 * l - 0.03 * c - 0.36 * ch - 0.03 * ol,
    epaules: 1.0 + 0.15 * s + 0.10 * mu + 0.05 * c - 0.25 * ch - 0.06 * ol,
    taille: 1.0 + 0.30 * c + 0.05 * mu + 0.05 * s,
    ventre: 0.3 + 0.55 * c + 0.15 * s + 0.15 * ch + 0.12 * ol,
    hanches: 1.05 - 0.12 * s + 0.20 * c - 0.15 * ch,
    jambes: 1.0 + 0.12 * c + 0.08 * mu - 0.1 * ch,
    bras: 1.0 + 0.20 * c + 0.25 * mu - 0.15 * ch - 0.06 * ol,
    cou: 1.0 + 0.08 * s + 0.10 * mu + 0.05 * c - 0.1 * ch - 0.04 * ol,
    cuisses: 1.0 + 0.12 * c + 0.12 * mu - 0.04 * s - 0.06 * ol,
    mollets: 1.0 + 0.06 * c + 0.10 * mu - 0.08 * ol,
    jambesLong: 1.0 + 0.05 * l - 0.14 * ch,
    poitrine: -0.55 * s + 0.2 * c,
    profondeur: 1.0 + 0.08 * c + 0.04 * mu,
    tete: 1.0 - 0.02 * l + 0.3 * ch,
    dos: 0.8 * ol,
  };
  const corps = {};
  for (const [k, b] of Object.entries(kit.corpsBornes)) corps[k] = Math.round(Math.min(b[1], Math.max(b[0], brut[k])) * 1000) / 1000;
  return corps;
}

/** Macros plausibles depuis une graine (4 facteurs −1…1 plus denses au centre ; âge adulte par défaut, ou `age` imposé). */
export function macrosAleatoires(graine, { age } = {}) {
  let a = graine >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f = () => Math.round((rnd() + rnd() - 1) * 1000) / 1000;
  const m = { corpulence: f(), musculature: f(), silhouette: f(), proportions: f() };
  m.age = age ?? 0.5;
  return m;
}

/** Corps adulte plausible depuis une graine : les macros tirées, convertis en paramètres (comportement de la v. précédente conservé). */
export function corpsAleatoire(graine, kit = KIT) {
  return corpsDepuisMacros(macrosAleatoires(graine), kit);
}

/** Tronçons d'une jambe entre `yHaut` et `yBas` : cuisse au-dessus du genou, mollet en dessous (rayons du corps, sans marge). */
export function segmentsJambe(g, yHaut, yBas) {
  if (g.cuisseR === g.molletR) return [{ y1: yHaut, y2: yBas, r: g.cuisseR }]; // jambe droite : un seul tronçon (pas de raccord)
  const segs = [];
  if (yHaut > g.genouY && yBas < g.genouY) {
    segs.push({ y1: yHaut, y2: g.genouY, r: g.cuisseR }, { y1: g.genouY, y2: yBas, r: g.molletR });
  } else {
    segs.push({ y1: yHaut, y2: yBas, r: yHaut > g.genouY ? g.cuisseR : g.molletR });
  }
  return segs;
}

/** Rôles dont la couleur est de la peau : recolorés selon `identite.teint` (traits, cheveux : non). */
export const ROLES_PEAU = ['crane', 'oreille', 'nez', 'bouche'];

/**
 * Recoloration de la peau : multiplie chaque canal par cible/référence (les ombres et reflets
 * sont conservés), borné à 0–255. `ref` = couleur d'origine de la peau de la planche, `cible` = teint voulu.
 */
export function teinter(rgb, ref, cible) {
  return rgb.map((v, i) => Math.max(0, Math.min(255, Math.round((v * cible[i]) / Math.max(1, ref[i])))));
}
export const hexVersRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * Placement des pièces d'un visage image, en pixels, pour un crâne de `largeurCrane` px de large.
 * Origine : coin haut-gauche du crâne. Fonction pure (testable sans canvas).
 * Retourne { calques: [{role, src, rect, dx, dy, dw, dh, coupeBas?}], cheveux: {src, rect, dx, dy, dw, dh}, hauteurMenton }.
 */
export function placementsVisage(def, largeurCrane) {
  const s = largeurCrane / def.ref;
  const taille = (rect, k) => ({ dw: (rect[2] - rect[0]) * k * s, dh: (rect[3] - rect[1]) * k * s });
  const calques = def.calques.map((c) => {
    const { dw, dh } = taille(c.rect, c.k);
    return { role: c.role, src: c.src, rect: c.rect, dx: c.x * s - dw / 2, dy: c.y * s - dh / 2, dw, dh };
  });
  const crane = calques.find((c) => c.role === 'crane');
  crane.coupeBas = def.menton; // le cou du crâne est coupé au menton : le cou du corps prend le relais
  const ch = def.cheveux;
  const dw = largeurCrane * ch.largeurRel;
  const dh = dw * ((ch.rect[3] - ch.rect[1]) / (ch.rect[2] - ch.rect[0]));
  return {
    calques,
    cheveux: { src: ch.src, rect: ch.rect, dw, dh, dx: largeurCrane / 2 - dw / 2, dy: -dh * ch.hautRel },
    hauteurMenton: crane.dh * def.menton,
  };
}

/** Demi-largeur du torse à la hauteur y (m) : le même profil sert au 2D et au lathe 3D. */
/**
 * Points d'un bras posé (coordonnées monde du kit, y vers le haut) : épaule, coude, main — ou null pour `repos`
 * (bras droit historique). `pose` = entrée de kit.poses ; `cote` = 1 (droite de l'image) ou -1. Pure : partagée 2D/3D.
 */
export function pointsBras(g, pose, cote) {
  const a = pose?.bras?.[cote];
  if (!a) return null;
  const ax = cote * g.demiEpaules * 0.98, ay = g.epaulesY - g.H * 0.02;
  const dir = (deg) => [cote * Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
  const L = g.brasLong / 2;
  const d1 = dir(a[0]), d2 = dir(a[1]);
  const coude = [ax + d1[0] * L, ay + d1[1] * L];
  return { epaule: [ax, ay], coude, main: [coude[0] + d2[0] * L, coude[1] + d2[1] * L] };
}

export function demiLargeur(g, y) {
  const { hanchesY: yh, tailleY: yt, epaulesY: ys } = g;
  const lisse = (t) => t * t * (3 - 2 * t);
  let w;
  if (y <= yh) w = g.demiHanches;
  else if (y <= yt) w = g.demiHanches + (g.demiTaille - g.demiHanches) * lisse((y - yh) / (yt - yh));
  else if (y <= ys) w = g.demiTaille + (g.demiEpaules - g.demiTaille) * lisse((y - yt) / (ys - yt));
  else return g.demiEpaules * Math.max(0.35, 1 - (y - ys) / (g.H * 0.06));
  if (g.poitrine && y > yt) w += g.poitrine * g.H * 0.015 * Math.exp(-(((y - (yt + (ys - yt) * 0.62)) / (g.H * 0.06)) ** 2));
  return w;
}

/** Position d'un emplacement nommé sur le torse, en mètres (x vers la droite de l'écran). */
export function pointEmplacement(g, emplacement, kit = KIT, ourletY = g.hanchesY - g.H * 0.02) {
  const e = kit.emplacements[emplacement];
  const y = g.epaulesY - (g.epaulesY - ourletY) * e.v;
  return { x: e.u * demiLargeur(g, y), y };
}
