// Générateur de lots par segment de visiteurs : table « segment → ce qui est plausible » + tirage déterministe (graine).
// Pur : aucun DOM ; utilisable par la page /lot-auto.html, les outils en ligne de commande et les tests. Sortie = un lot au format
// de export.js ({segment, items:[…]}), chaque item étant validé comme recette AVANT d'être rendu (invalides listés dans `rejets`).
//
// Un item décrit UNE personne (ou un groupe : `membres`). La recette pilote à la fois le mannequin (2D/3D du compositeur) et le
// prompt du générateur d'images (description.js) : corps, âge, teint, tenue (pièces, couleurs, matières, motifs), traits de visage
// (`traits`) et attitude (`attitude`, phrase de description : l'illustrateur n'est pas limité aux poses du mannequin).
import { KIT, validerRecette, visageCompatible } from './kit.js';
import { recetteDeLot } from './export.js';

// ---- palettes communes ----
const TEINTS = ['#f3d2b3', '#e8bc99', '#d9a07a', '#c68b64', '#a8704a', '#8a5a3c', '#6b422b'];
const PASTELS = ['#f4d6d6', '#d6e4f4', '#e4f4d6', '#f4eed6', '#e4d6f4', '#d6f4ee'];
const KAKI_NEUTRES = ['#cbbf9e', '#a8a07c', '#8a8470', '#6e7a6a', '#d8d0bc', '#b0a890'];
const SOMBRES = ['#26262e', '#2e3550', '#3a3025', '#4a4e69'];
const VIFS = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8338ec', '#ff6b9d', '#06d6a0', '#118ab2'];
const MARINE_BLANC = ['#1d3557', '#f1faee', '#457b9d', '#a8dadc'];
const SPORT = ['#118ab2', '#06d6a0', '#e63946', '#f4a261', '#1d3557', '#2a9d8f'];
const TERRE = ['#8a6a2a', '#6e7a6a', '#a8704a', '#c9a050', '#7a8a9a', '#5b4a3a'];
const CLAIRS = ['#f4f1ea', '#cfe3f0', '#f1ece0', '#d8ecd6', '#f4d6d6'];
const CHAPEAU = { piece: 'tete.chapeau@1', corps: ['#d4c5a0', '#e6d8b0', '#c8b890', '#f4d58d'], ruban: ['#355070', '#b56576', '#2a6f4a', '#e63946'] };

const tshirt = (corps, extra = {}) => ({ piece: 'haut.tshirt@1', corps, col: extra.col ?? [...corps], ...extra });
const chemise = (corps, extra = {}) => ({ piece: 'haut.chemise@1', corps, col: extra.col ?? [...corps], ...extra });
const short = (corps, matieres = [null]) => ({ piece: 'bas.short@1', matieres, corps });
const pantalon = (corps, matieres = [null]) => ({ piece: 'bas.pantalon@1', matieres, corps });
const jupe = (corps, matieres = [null], bordure = ['#ffffff']) => ({ piece: 'bas.jupe@1', matieres, corps, bordure });
const MOTIF = (types, emplacement, couleurs, proba = 0.4) => ({ proba, types, emplacement, couleurs });

// Proportions partagées (mesurées à l'œil sur le jeu) : une seule chaîne par famille pour pouvoir grouper les générations.
const PROP_REAL = 'stylised but realistic everyday proportions, slightly large head, normal legs, natural ordinary body (about 5.5 heads tall)';
const PROP_GROUPE = 'stylised but realistic everyday proportions, slightly large heads, normal legs, natural ordinary bodies, children clearly smaller (about 5.5 heads tall for adults, 4 for children)';

// Chaque segment : `attitudes` = phrases de description (accessoires, geste) ; `proportions` = mesurées à l'œil sur les sprites du jeu.
export const SEGMENTS = {
  senior: {
    libelle: 'Les Seniors', segmentAnglais: 'Senior', look: 'straw hats, light shirts, cameras, canes, relaxed retirees enjoying the beach',
    proportions: 'chibi-like caricatural proportions with a large head and short stocky legs (about 3.5 heads tall)',
    age: [0.85, 1], visages: ['image.ancien@1', 'image.aine@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.4, 0.6], musculature: [-0.7, 0.1], silhouette: [-1, 1], proportions: [-0.3, 0.1] },
    stature: [0.94, 1.02], teints: TEINTS.slice(0, 4),
    attitudes: [
      { poids: 3, texte: 'standing calmly and leaning on a wooden walking cane', pose: 'canne' },
      { poids: 2, texte: 'standing relaxed, friendly, with a small camera hanging from the neck', pose: 'repos' },
      { poids: 2, texte: 'standing relaxed, friendly, holding a folded newspaper', pose: 'repos' },
      { poids: 1, texte: 'waving hello with one raised arm, smiling', pose: 'salut' },
    ],
    chaussures: [null, { matiere: 'cuir.grain@1', couleurs: ['#7a4a28', '#b0875a', '#4a3a2a'] }, { matiere: 'tissu.lin@1', couleurs: ['#d8d0bc', '#e8e0d0'] }],
    tenues: [
      { poids: 3, pieces: [
        { piece: 'haut.pull@1', matieres: [null, 'tissu.maille@1'], corps: PASTELS.concat(['#6d597a', '#9db4a0', '#c9a050']), bordure: ['#b56576', '#8a6a2a', '#7a8a9a'], col: ['#b56576', '#8a6a2a', '#7a8a9a'] },
        pantalon(KAKI_NEUTRES.concat(SOMBRES), [null, 'tissu.lin@1', 'tissu.tweed@1']), CHAPEAU,
      ] },
      { poids: 3, pieces: [
        chemise(['#f1ece0', '#cfe3f0', '#f0d8d8', '#d8ecd6'], { matieres: [null, 'tissu.lin@1', 'tissu.rayures@1'], col: ['#f1ece0'], motif: MOTIF(['soleil', 'rayures'], 'poitrine_gauche', ['#2a6fdb', '#e63946', '#2a9d8f'], 0.35) }),
        short(KAKI_NEUTRES, [null, 'tissu.lin@1']), CHAPEAU,
      ] },
      { poids: 2, silhouetteMax: 0, pieces: [
        chemise(['#f4f1ea', '#d6e4f4'], { matieres: [null, 'tissu.lin@1'], col: ['#f4f1ea'] }),
        jupe(['#6a9a7c', '#a8222a', '#457b9d', '#d8b04a'], [null, 'tissu.vichy@1', 'tissu.tartan@1'], ['#ffffff', '#2a3a6a']), CHAPEAU,
      ] },
    ],
  },

  fetard: {
    libelle: 'Les Fêtards', segmentAnglais: 'Partier', look: 'colourful casual party outfits, fun nightlife energy, a drink in hand',
    proportions: PROP_REAL,
    age: [0.35, 0.6], visages: ['image.roux@1', 'image.mix@1', 'image.homme@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.3, 0.7], musculature: [-0.4, 0.3], silhouette: [-1, 1], proportions: [-0.3, 0.3] },
    stature: [0.96, 1.05], teints: TEINTS,
    attitudes: [
      { poids: 3, texte: 'holding a colourful cocktail glass with a straw in one hand, cheerful', pose: 'verre' },
      { poids: 3, texte: 'dancing joyfully with arms raised, laughing', pose: 'danse' },
      { poids: 2, texte: 'waving hello with one raised arm, smiling', pose: 'salut' },
      { poids: 1, texte: 'standing relaxed with a glow bracelet, grinning', pose: 'repos' },
    ],
    chaussures: [null, { matiere: 'cuir.grain@1', couleurs: ['#f2f2f2', '#1a1a1d', '#e63946'] }],
    tenues: [
      { poids: 3, pieces: [chemise(VIFS, { matieres: [null, 'tissu.rayures@1', 'tissu.vichy@1'], motif: MOTIF(['rayures', 'soleil'], 'centre_poitrine', ['#ffffff', '#f2b01e'], 0.5) }), pantalon(SOMBRES.concat(['#4a6fa8', '#d8d0bc']), [null, 'tissu.denim@1'])] },
      { poids: 3, pieces: [tshirt(VIFS.concat(['#f4f1ea', '#1a1a1d']), { motif: MOTIF(['soleil', 'coeur'], 'poitrine_gauche', ['#f2b01e', '#ffffff', '#ef476f'], 0.7) }), short(VIFS.concat(MARINE_BLANC), [null, 'tissu.denim@1'])] },
      { poids: 2, silhouetteMax: 0, pieces: [tshirt(['#f4f1ea', '#1a1a1d', '#ff6b9d']), jupe(VIFS, [null, 'tissu.vichy@1', 'tissu.tartan@1'], ['#ffffff', '#1a1a1d'])] },
    ],
  },

  couple: {
    libelle: 'Les Couples', segmentAnglais: 'Couple', look: 'relaxed chic-casual outfits, sunset selfies, cocktails, a romantic couple standing close together',
    proportions: PROP_GROUPE,
    groupe: [{ genre: 'f', proche: true }, { genre: 'm', proche: true }], groupeMot: 'a couple',
    age: [0.4, 0.7], visages: ['image.mix@1', 'image.roux@1', 'image.homme@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.3, 0.7], musculature: [-0.4, 0.3], silhouette: [-1, 1], proportions: [-0.2, 0.3] },
    stature: [0.96, 1.04], teints: TEINTS,
    attitudes: [
      { poids: 3, texte: 'standing relaxed, friendly', pose: 'repos' },
      { poids: 1, texte: 'standing relaxed, friendly, one holding a small beach bag', pose: 'repos' },
    ],
    chaussures: [null, { matiere: 'cuir.grain@1', couleurs: ['#d8d0bc', '#7a4a28'] }],
    tenues: [
      { poids: 3, pieces: [tshirt(['#f4f1ea', '#cfe3f0', '#f4d6d6', '#2a9d8f', '#f4a261'], { col: ['#1d3557', '#f4f1ea'], motif: MOTIF(['soleil', 'coeur'], 'poitrine_gauche', ['#f2b01e', '#e63946'], 0.3) }), short(KAKI_NEUTRES.concat(MARINE_BLANC), [null, 'tissu.lin@1', 'tissu.denim@1'])] },
      { poids: 3, pieces: [chemise(['#f1ece0', '#cfe3f0', '#d8ecd6', '#f4a261'], { matieres: [null, 'tissu.lin@1', 'tissu.rayures@1'], col: ['#f1ece0'] }), pantalon(KAKI_NEUTRES, [null, 'tissu.lin@1'])] },
      { poids: 2, silhouetteMax: 0, pieces: [tshirt(['#f4f1ea', '#cfe3f0', '#ff6b9d'], { col: ['#ffffff'] }), jupe(['#e63946', '#2a9d8f', '#f4a261', '#457b9d'], [null, 'tissu.vichy@1', 'tissu.rayures@1'])] },
    ],
  },

  // Familles : 2 parents + 1 ou 2 enfants dans le même sprite.
  famille: {
    libelle: 'Les Familles', segmentAnglais: 'Famille', look: 'parasols, inflatable rings, ice creams, sun hats, a happy family at the beach',
    proportions: PROP_GROUPE,
    groupe: [{ genre: 'f', proche: true }, { genre: 'm', proche: true }, { enfant: true }, { enfant: true, optionnel: 0.5 }], groupeMot: 'a family',
    age: [0.38, 0.6], visages: ['image.mix@1', 'image.roux@1', 'image.homme@1'], visagesEnfant: ['image.enfant@1'], ageEnfant: [0.05, 0.25],
    morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.2, 0.7], musculature: [-0.4, 0.3], silhouette: [-1, 1], proportions: [-0.2, 0.2] },
    stature: [0.96, 1.04], teints: TEINTS,
    attitudes: [{ poids: 3, texte: 'standing close together, happy', pose: 'repos' }, { poids: 1, texte: 'standing close together, happy, one holding an ice cream', pose: 'repos' }],
    chaussures: [null, { matiere: 'tissu.lin@1', couleurs: ['#d8d0bc', '#e8e0d0'] }],
    tenues: [
      { poids: 3, pieces: [tshirt(['#cfe3f0', '#f4f1ea', '#f4a261', '#2a9d8f'], { col: ['#1d3557', '#ffffff'] }), short(KAKI_NEUTRES.concat(MARINE_BLANC), [null, 'tissu.lin@1'])] },
      { poids: 2, pieces: [chemise(CLAIRS, { matieres: [null, 'tissu.lin@1'] }), pantalon(KAKI_NEUTRES, [null, 'tissu.lin@1']), CHAPEAU] },
      { poids: 2, silhouetteMax: 0, pieces: [tshirt(CLAIRS), jupe(['#e63946', '#2a9d8f', '#f4a261'], [null, 'tissu.vichy@1']), CHAPEAU] },
    ],
    tenuesEnfant: [
      { poids: 3, pieces: [tshirt(['#ffd23f', '#4cc9f0', '#ef476f', '#06d6a0'], { col: ['#ffffff'], motif: MOTIF(['soleil', 'coeur'], 'poitrine_gauche', ['#ffffff', '#ef476f'], 0.6) }), short(['#4cc9f0', '#1d3557', '#f4a261'])] },
      { poids: 2, silhouetteMax: 0, pieces: [tshirt(['#ffd23f', '#ff6b9d', '#4cc9f0']), jupe(['#4cc9f0', '#ff6b9d', '#ffd23f']), CHAPEAU] }, // jupe : filles seulement
    ],
  },

  sportif: {
    libelle: 'Les Sportifs', segmentAnglais: 'Sportif', look: 'sporty beach outfits, surfboards, sun-tanned athletes, water bottles',
    proportions: PROP_REAL,
    age: [0.3, 0.55], visages: ['image.roux@1', 'image.mix@1', 'image.homme@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.4, 0.4], musculature: [0, 0.6], silhouette: [-1, 1], proportions: [-0.1, 0.4] },
    stature: [0.98, 1.06], teints: TEINTS,
    attitudes: [
      { poids: 2, texte: 'standing confidently, holding a surfboard upright beside them', pose: 'repos' },
      { poids: 2, texte: 'standing relaxed, holding a reusable water bottle', pose: 'repos' },
      { poids: 2, texte: 'holding a kayak paddle upright, smiling', pose: 'repos' },
      { poids: 1, texte: 'waving hello with one raised arm, energetic', pose: 'salut' },
    ],
    chaussures: [null, { matiere: 'cuir.grain@1', couleurs: ['#f2f2f2', '#1a1a1d', '#118ab2'] }],
    tenues: [
      { poids: 3, pieces: [tshirt(SPORT, { col: ['#ffffff', '#1a1a1d'] }), short(SPORT.concat(SOMBRES))] },
      { poids: 2, pieces: [tshirt(['#f4f1ea', '#cfe3f0'], { col: SPORT }), pantalon(SOMBRES)] },
    ],
  },

  routard: {
    libelle: 'Les Routards', segmentAnglais: 'Routard', look: 'big backpack, flip-flops, worn travel clothes, water bottle and notebook',
    proportions: PROP_REAL,
    age: [0.3, 0.5], visages: ['image.roux@1', 'image.mix@1', 'image.homme@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.4, 0.4], musculature: [-0.4, 0.3], silhouette: [-1, 1], proportions: [-0.2, 0.3] },
    stature: [0.96, 1.05], teints: TEINTS,
    attitudes: [
      { poids: 3, texte: 'standing relaxed with a big worn backpack on the back', pose: 'repos' },
      { poids: 2, texte: 'standing relaxed with a backpack, holding a small notebook', pose: 'repos' },
    ],
    chaussures: [null],
    tenues: [
      { poids: 3, pieces: [tshirt(TERRE.concat(CLAIRS), { matieres: [null, 'tissu.lin@1'] }), short(KAKI_NEUTRES, [null, 'tissu.lin@1', 'tissu.denim@1'])] },
      { poids: 2, pieces: [chemise(TERRE, { matieres: [null, 'tissu.lin@1', 'tissu.vichy@1'] }), pantalon(KAKI_NEUTRES.concat(SOMBRES), [null, 'tissu.lin@1'])] },
    ],
  },

  influenceur: {
    libelle: 'Les Influenceurs', segmentAnglais: 'Influenceur', look: 'selfie stick, trendy colourful outfits, small drone, smartphone always in hand',
    proportions: PROP_REAL,
    age: [0.3, 0.5], visages: ['image.roux@1', 'image.mix@1', 'image.homme@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.3, 0.5], musculature: [-0.4, 0.3], silhouette: [-1, 1], proportions: [-0.2, 0.3] },
    stature: [0.96, 1.05], teints: TEINTS,
    attitudes: [
      { poids: 3, texte: 'taking a selfie with a selfie stick, smiling at the phone', pose: 'salut' },
      { poids: 2, texte: 'holding up a smartphone to film themselves, cheerful', pose: 'salut' },
      { poids: 1, texte: 'standing proudly with a small drone controller in hand', pose: 'repos' },
    ],
    chaussures: [null, { matiere: 'cuir.grain@1', couleurs: ['#f2f2f2', '#ff6b9d', '#118ab2'] }],
    tenues: [
      { poids: 3, pieces: [tshirt(VIFS.concat(['#f4f1ea']), { motif: MOTIF(['soleil', 'coeur', 'rayures'], 'poitrine_gauche', ['#ffffff', '#f2b01e'], 0.5) }), short(VIFS.concat(MARINE_BLANC), [null, 'tissu.denim@1'])] },
      { poids: 2, pieces: [chemise(VIFS, { matieres: [null, 'tissu.rayures@1', 'tissu.vichy@1'] }), pantalon(CLAIRS.concat(SOMBRES), [null, 'tissu.lin@1'])] },
    ],
  },

  vip: {
    libelle: 'Les VIP', segmentAnglais: 'VIP', look: 'stylish designer-looking outfits, sunglasses even at night, champagne bottle, confident attitude',
    proportions: PROP_REAL,
    age: [0.4, 0.7], visages: ['image.mix@1', 'image.homme@1', 'image.roux@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.3, 0.5], musculature: [-0.3, 0.3], silhouette: [-1, 1], proportions: [-0.1, 0.3] },
    stature: [0.98, 1.06], teints: TEINTS,
    attitudes: [
      { poids: 3, texte: 'standing with a confident attitude, wearing sunglasses, holding a champagne bottle', pose: 'verre' },
      { poids: 2, texte: 'standing with a confident attitude, wearing sunglasses, one hand in a pocket', pose: 'repos' },
    ],
    chaussures: [null, { matiere: 'cuir.grain@1', couleurs: ['#1a1a1d', '#f2f2f2', '#7a4a28'] }],
    tenues: [
      { poids: 3, pieces: [chemise(['#f4f1ea', '#1a1a1d', '#1d3557', '#d8b04a'], { matieres: [null, 'tissu.lin@1'] }), pantalon(['#f4f1ea', '#1a1a1d', '#26262e', '#d8d0bc'], [null, 'tissu.lin@1'])] },
      { poids: 2, pieces: [{ piece: 'haut.gilet@1', corps: ['#1a1a1d', '#355c3f', '#7a1f3d'], bordure: ['#c9a24a'] }, chemise(['#f4f1ea'], {}), pantalon(['#26262e', '#3a3025'])] },
      // long manteau de créateur sur chemise et pantalon (rendu 3D : type `manteau` de rendre_modulaire.py)
      { poids: 1, pieces: [{ piece: 'haut.manteau@1', corps: ['#5b1f2a', '#1d3557', '#2e3550', '#3a3025'], revers: ['#8c3040', '#2f4f7f', '#4a4e69'], bordure: ['#c9a24a'], boutons: ['#d8b45a'] }, chemise(['#f4f1ea', '#cfe3f0'], {}), pantalon(['#26262e', '#3a3025'])] },
    ],
  },

  croisiere: {
    libelle: 'Les Croisiéristes', segmentAnglais: 'Croisiériste', look: 'guided groups, souvenir bags, cruise lanyards and badges, cameras, sun hats',
    proportions: 'chibi-like caricatural proportions with a large head and short stocky legs (about 4 heads tall)',
    age: [0.55, 0.9], visages: ['image.mix@1', 'image.roux@1', 'image.homme@1', 'image.aine@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.2, 0.7], musculature: [-0.5, 0.2], silhouette: [-1, 1], proportions: [-0.3, 0.1] },
    stature: [0.95, 1.03], teints: TEINTS,
    attitudes: [
      { poids: 3, texte: 'standing relaxed with a cruise badge on a lanyard and a camera', pose: 'repos' },
      { poids: 2, texte: 'standing relaxed, carrying a souvenir shopping bag', pose: 'repos' },
    ],
    chaussures: [null, { matiere: 'tissu.lin@1', couleurs: ['#d8d0bc', '#ffffff'] }],
    tenues: [
      { poids: 3, pieces: [chemise(['#cfe3f0', '#f4d6d6', '#d8ecd6', '#f1ece0'], { matieres: [null, 'tissu.lin@1'] }), short(KAKI_NEUTRES), CHAPEAU] },
      { poids: 2, pieces: [tshirt(MARINE_BLANC.concat(['#f4a261'])), pantalon(KAKI_NEUTRES.concat(SOMBRES)), CHAPEAU] },
    ],
  },

  ados: {
    // BLOQUÉ (7 nov. 2026) : le filtre de sécurité du générateur d'images a refusé les 2 prompts d'adolescents de 16 ans. Ne pas reformuler ni
    // relancer pour contourner ce refus ; les sprites ados du jeu restent ceux d'origine. prompts_lot.mjs refuse ce segment.
    bloque: 'refusé par le filtre de sécurité du générateur (adolescents) — ne pas contourner',
    libelle: 'Les Ados en bande', segmentAnglais: 'Ado', look: 'streetwear, headphones, skateboard or ball, smartphones held up',
    proportions: 'stylised but realistic youthful proportions, slightly large head, slim teenage body (about 5.5 heads tall)',
    age: [0.19, 0.26], visages: ['image.enfant@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.3, 0.4], musculature: [-0.3, 0.1], silhouette: [-1, 1], proportions: [-0.1, 0.3] },
    stature: [0.92, 1.0], teints: TEINTS,
    attitudes: [
      { poids: 2, texte: 'standing with one foot on a skateboard, relaxed, headphones around the neck', pose: 'repos' },
      { poids: 2, texte: 'holding a beach volleyball under one arm, grinning', pose: 'repos' },
      { poids: 2, texte: 'holding up a smartphone, laughing', pose: 'salut' },
    ],
    chaussures: [null, { matiere: 'cuir.grain@1', couleurs: ['#f2f2f2', '#1a1a1d', '#e63946'] }],
    tenues: [
      { poids: 3, pieces: [tshirt(VIFS.concat(['#1a1a1d', '#f4f1ea']), { motif: MOTIF(['soleil', 'coeur', 'rayures'], 'poitrine_gauche', ['#ffffff', '#f2b01e'], 0.6) }), short(MARINE_BLANC.concat(SOMBRES), [null, 'tissu.denim@1'])] },
      { poids: 2, pieces: [tshirt(['#f4f1ea', '#1a1a1d', '#06d6a0']), pantalon(SOMBRES.concat(['#4a6fa8']), [null, 'tissu.denim@1'])] },
    ],
  },

  bienetre: {
    libelle: 'Les Curistes bien-être', segmentAnglais: 'Bien-être', look: 'yoga mat, linen outfits, water bottle, calm serenity',
    proportions: PROP_REAL,
    age: [0.4, 0.8], visages: ['image.mix@1', 'image.roux@1', 'image.homme@1', 'image.aine@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.3, 0.6], musculature: [-0.4, 0.2], silhouette: [-1, 1], proportions: [-0.2, 0.3] },
    stature: [0.95, 1.04], teints: TEINTS,
    attitudes: [
      { poids: 3, texte: 'standing serenely with a rolled yoga mat under one arm', pose: 'repos' },
      { poids: 2, texte: 'standing serenely, holding a reusable water bottle', pose: 'repos' },
    ],
    chaussures: [null],
    tenues: [
      { poids: 3, pieces: [tshirt(CLAIRS.concat(['#9db4a0', '#c9bca0']), { matieres: ['tissu.lin@1'] }), pantalon(['#d8d0bc', '#cbbf9e', '#9db4a0', '#f1ece0'], ['tissu.lin@1'])] },
      { poids: 2, pieces: [chemise(CLAIRS, { matieres: ['tissu.lin@1'] }), short(['#d8d0bc', '#cbbf9e'], ['tissu.lin@1'])] },
    ],
  },

  evj: {
    libelle: 'EVG / EVJF', segmentAnglais: 'Enterrement de vie de garçon / de jeune fille', look: 'matching fun outfits, printed t-shirts, party accessories, a playful mood',
    proportions: PROP_REAL,
    age: [0.32, 0.5], visages: ['image.roux@1', 'image.mix@1', 'image.homme@1'], morphologies: ['fine', 'ronde', 'trapue'],
    macros: { corpulence: [-0.2, 0.6], musculature: [-0.3, 0.3], silhouette: [-1, 1], proportions: [-0.2, 0.3] },
    stature: [0.96, 1.05], teints: TEINTS,
    attitudes: [
      { poids: 2, texte: 'wearing a playful party sash, holding a small party balloon, cheerful', pose: 'repos' },
      { poids: 2, texte: 'wearing a funny party headband, holding a drink, laughing', pose: 'verre' },
    ],
    chaussures: [null],
    tenues: [
      { poids: 3, pieces: [tshirt(['#ff6b9d', '#f4a261', '#4cc9f0', '#f4f1ea'], { motif: MOTIF(['coeur', 'soleil'], 'centre_poitrine', ['#ffffff', '#1a1a1d'], 0.9) }), short(MARINE_BLANC.concat(KAKI_NEUTRES))] },
      { poids: 2, pieces: [tshirt(['#ff6b9d', '#f4f1ea']), pantalon(['#4a6fa8', '#26262e'], [null, 'tissu.denim@1'])] },
    ],
  },
};

// ---- tirage ----
// Générateur pseudo-aléatoire déterministe (mulberry32) : même graine → même lot.
function prng(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (txt) => { let h = 2166136261; for (const c of txt) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
const pickPoids = (rnd, a) => { let t = rnd() * a.reduce((s, x) => s + x.poids, 0); for (const x of a) { t -= x.poids; if (t < 0) return x; } return a[a.length - 1]; };
const entre = (rnd, [a, b]) => a + (b - a) * rnd();
const arrondi = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

// ---- traits de visage (décidés par la recette, pas laissés au hasard du générateur d'images) ----
const CHEVEUX_COULEURS = ['jet black', 'dark brown', 'chestnut brown', 'light brown', 'dark blond', 'ginger red'];
const CHEVEUX_F = ['short bob', 'long wavy', 'tight curly', 'loose ponytail', 'neat bun', 'shoulder-length straight', 'short cropped', 'braided'];
const CHEVEUX_M = ['short neat', 'curly', 'closely cropped', 'medium wavy', 'slicked back', 'short messy'];
function traitsVisage(rnd, { genre, age }) {
  const gris = age >= 0.75 || (age >= 0.6 && rnd() < 0.4);
  const coul = gris ? pick(rnd, ['silver grey', 'white', 'salt-and-pepper grey']) : pick(rnd, CHEVEUX_COULEURS);
  const chauve = genre === 'm' && age >= 0.65 && rnd() < 0.3;
  const coupe = pick(rnd, genre === 'f' ? CHEVEUX_F : CHEVEUX_M);
  const t = [chauve ? 'a bald head with grey hair on the sides' : `${coul} ${coupe} hair`];
  if (genre === 'm' && age > 0.3 && rnd() < 0.35) t.push(pick(rnd, ['a short stubble beard', 'a full trimmed beard', 'a moustache']));
  if (rnd() < (age >= 0.75 ? 0.5 : 0.25)) t.push(pick(rnd, ['round glasses', 'rectangular glasses', 'sunglasses']));
  return t.join(', ');
}

function tirerPiece(rnd, p) {
  const matiere = p.matieres ? pick(rnd, p.matieres) : null;
  const couleurs = { corps: pick(rnd, p.corps) };
  for (const cle of ['col', 'bordure', 'ruban', 'revers', 'boutons']) if (p[cle]) couleurs[cle] = pick(rnd, p[cle]);
  const e = { piece: p.piece, couleurs };
  if (matiere) e.matiere = matiere;
  if (p.motif && rnd() < p.motif.proba && !matiere) {
    e.motif = { type: pick(rnd, p.motif.types), emplacement: p.motif.emplacement, echelle: 1, couleur: pick(rnd, p.motif.couleurs) };
  }
  return e;
}

/** Tire UN item (une personne) pour le segment, sans le valider. `opts` : genre ('f'|'m'), ageProche, enfant. Exportée pour les tests. */
export function tirerItem(segmentId, rnd, { genre, ageProche, enfant } = {}) {
  const seg = SEGMENTS[segmentId];
  const plageSilhouette = genre === 'f' ? [-1, -0.25] : genre === 'm' ? [0.25, 1] : seg.macros.silhouette;
  const plageAge = enfant ? seg.ageEnfant : seg.age;
  const macros = {
    corpulence: arrondi(entre(rnd, seg.macros.corpulence)), musculature: arrondi(entre(rnd, seg.macros.musculature)),
    silhouette: arrondi(entre(rnd, plageSilhouette)), proportions: arrondi(entre(rnd, seg.macros.proportions)),
    age: arrondi(ageProche === undefined ? entre(rnd, plageAge) : Math.min(plageAge[1], Math.max(plageAge[0], ageProche + entre(rnd, [-0.07, 0.07])))), // groupes : âges proches
  };
  const liste = enfant ? seg.visagesEnfant : seg.visages;
  const candidats = liste.filter((v) => visageCompatible(v, macros.age, KIT));
  const visage = pick(rnd, candidats.length ? candidats : liste);
  const source = enfant ? seg.tenuesEnfant : seg.tenues;
  const tenues = source.filter((t) => t.silhouetteMax === undefined || macros.silhouette <= t.silhouetteMax);
  const tenue = pickPoids(rnd, tenues.length ? tenues : source);
  const ch = pick(rnd, seg.chaussures);
  const attitude = pickPoids(rnd, seg.attitudes);
  return {
    visage, macros,
    morphologie: pick(rnd, seg.morphologies),
    stature: arrondi(entre(rnd, seg.stature), 2), // la taille d'un enfant vient de la macro âge, pas de la stature (bornée 0,92–1,08)
    teint: pick(rnd, seg.teints),
    pose: attitude.pose,
    attitude: enfant ? 'standing happily, smiling' : attitude.texte,
    traits: traitsVisage(rnd, { genre: macros.silhouette < 0 ? 'f' : 'm', age: macros.age }),
    ...(enfant ? { enfant: true } : {}),
    ...(ch ? { chaussures: { matiere: ch.matiere, couleur: pick(rnd, ch.couleurs) } } : {}),
    tenuePieces: tenue.pieces.map((p) => tirerPiece(rnd, p)),
  };
}

/** Signature de diversité : ce qui se VOIT d'un sprite (visage, tenue, couleurs, attitude, traits). */
const signatureUn = (it) => JSON.stringify([it.visage, it.attitude, it.traits, it.morphologie, it.tenuePieces.map((p) => [p.piece, p.matiere ?? '', p.couleurs.corps])]);
export const signature = (it) => (it.membres ? JSON.stringify(it.membres.map(signatureUn)) : signatureUn(it));

function tirerGroupe(segmentId, rnd) {
  const seg = SEGMENTS[segmentId];
  const specs = seg.groupe.filter((s) => s.optionnel === undefined || rnd() < s.optionnel);
  const adultes = specs.filter((s) => !s.enfant);
  if (rnd() < 0.5) adultes.reverse(); // qui est à gauche
  const membres = [];
  for (const s of [...adultes, ...specs.filter((x) => x.enfant)]) {
    membres.push(tirerItem(segmentId, rnd, { genre: s.genre, enfant: s.enfant, ageProche: s.proche ? membres.find((m) => !m.enfant)?.macros.age : undefined }));
  }
  return { ...membres[0], membres };
}

/**
 * Lot de `n` sprites valides pour le segment. `debut` = premier index de sortie (pour prolonger un segment existant).
 * Rejette (et retire du lot) les recettes invalides et les doublons visibles ; réessaie jusqu'à 30×n tirages.
 * Retourne { lot: {segment, items}, rejets: [{motif}] }.
 */
export function genererLot(segmentId, n, graine = 1, { debut = 0, kit = KIT } = {}) {
  if (!SEGMENTS[segmentId]) throw new Error(`segment inconnu : ${segmentId}`);
  const rnd = prng(graine * 2654435761 + hash(segmentId));
  const items = [], rejets = [], vus = new Set();
  for (let essai = 0; items.length < n && essai < n * 30; essai++) {
    const it = SEGMENTS[segmentId].groupe ? tirerGroupe(segmentId, rnd) : tirerItem(segmentId, rnd);
    const problemes = [];
    for (const m of it.membres ?? [it]) {
      const v = validerRecette(recetteDeLot(m), kit);
      if (!v.ok) problemes.push(...v.erreurs, ...v.manquantes.map((x) => `pièce manquante ${x.piece}`));
    }
    if (problemes.length) { rejets.push({ motif: problemes.join(' ; ') }); continue; }
    const sig = signature(it);
    if (vus.has(sig)) { rejets.push({ motif: 'doublon visible' }); continue; }
    vus.add(sig);
    items.push({ index: debut + items.length, ...it });
  }
  return { lot: { segment: segmentId, items }, rejets };
}
