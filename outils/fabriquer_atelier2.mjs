#!/usr/bin/env node
// Catalogue de l'atelier « pièces PNG au style du jeu » : lit prototype/public/atelier2/pieces.json (écrit par decouper_planches.py)
// et écrit atelier2/base.json (même forme que la base SVG : le moteur atelier-moteur.js sert aux deux).
//   python3 outils/decouper_planches.py && node outils/fabriquer_atelier2.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), '..', 'prototype', 'public', 'atelier2');
const pieces = JSON.parse(readFileSync(join(DOSSIER, 'pieces.json'), 'utf8'));

const STYLES = {
  haut: { tshirt: ['plage', 'quotidien', 'sport'], debardeur: ['plage', 'sport'], chemise: ['quotidien', 'chic', 'plage'], pull: ['quotidien', 'chic'], bikini: ['plage'], robe: ['plage', 'chic', 'quotidien'], sweat: ['quotidien', 'sport'], polo: ['quotidien', 'chic', 'sport'], blouse: ['chic', 'quotidien'] },
  bas: { short: ['plage', 'quotidien', 'sport'], bermuda: ['plage', 'quotidien', 'chic'], pantalon: ['quotidien', 'chic'], jean: ['quotidien'], 'mini-jupe': ['plage', 'quotidien', 'chic'], 'jupe-longue': ['chic', 'plage'], 'short-bain': ['plage', 'sport'], 'bas-maillot': ['plage'], legging: ['sport', 'quotidien'] },
  chaussures: { tongs: ['plage'], sandales: ['plage', 'quotidien'], baskets: ['quotidien', 'sport', 'chic'], bottines: ['quotidien', 'chic'], mocassins: ['chic', 'quotidien'], hautes: ['quotidien', 'sport'], espadrilles: ['plage', 'quotidien'], ballerines: ['chic', 'quotidien'], running: ['sport'] },
  chapeau: { casquette: ['quotidien', 'sport', 'plage'], paille: ['plage'], bob: ['plage', 'quotidien'], bonnet: ['quotidien'], visiere: ['plage', 'sport'], capeline: ['plage', 'chic'], feutre: ['chic', 'quotidien'], bandana: ['plage', 'quotidien'], snapback: ['quotidien', 'sport'] },
  lunettes: { aviateur: ['plage', 'quotidien'], 'rondes-fines': ['quotidien', 'chic'], carrees: ['quotidien'], 'oeil-de-chat': ['chic', 'plage'], sport: ['sport', 'plage'], 'sans-monture': ['chic', 'quotidien'], 'grosses-rondes': ['plage', 'chic'], ovales: ['plage'], rectangulaires: ['quotidien', 'chic'] },
};
const GABARIT = { fine: 'mince', moyenne: 'moyen', courbes: 'moyen', forte: 'rond', 'mince-h': 'mince', 'moyen-h': 'moyen', athletique: 'muscle', 'rond-h': 'rond' };
const GENRE_SOURCILS = { touffus: 'h', fins: 'f' };
const AUCUN = { chapeau: 'Aucun', lunettes: 'Aucune' };

const base = {
  schema: 'atelier/2', mode: 'png',
  note: 'Pièces PNG au style du jeu, découpées de planches du générateur d\'images (outils/decouper_planches.py). Le placement est calculé à l\'affichage (public/js/rendu-png.js) à partir de pieces.json.',
  toile: [520, 900],
  ordre: ['corps', 'bas', 'haut', 'chaussures', 'tete', 'nez', 'bouche', 'yeux', 'sourcils', 'cheveux', 'lunettes', 'chapeau'],
  groupes: { visage: ['tete', 'yeux', 'sourcils', 'nez', 'bouche', 'cheveux'], corps: ['corps'], tenue: ['haut', 'bas', 'chaussures', 'chapeau', 'lunettes'] },
  silhouettes: Object.entries(pieces.corps).map(([id, m]) => ({ id, nom: m.nom, genre: m.genre, gabarit: GABARIT[id] })),
  categories: {},
};
const NOMS = { tete: 'Tête', yeux: 'Yeux', sourcils: 'Sourcils', nez: 'Nez', bouche: 'Bouche', cheveux: 'Cheveux', corps: 'Corps', haut: 'Haut', bas: 'Bas', chaussures: 'Chaussures', chapeau: 'Chapeau', lunettes: 'Lunettes' };
const GROUPE = { tete: 'visage', yeux: 'visage', sourcils: 'visage', nez: 'visage', bouche: 'visage', cheveux: 'visage', corps: 'corps' };

for (const [cat, ps] of Object.entries(pieces)) {
  const variantes = Object.entries(ps).map(([id, m]) => {
    const v = { id, nom: m.nom, genre: m.genre ?? (cat === 'sourcils' ? (GENRE_SOURCILS[id] ?? '*') : '*'), calques: [{ z: cat, fichier: `${cat}/${id}.png` }] };
    if (STYLES[cat]) v.styles = STYLES[cat][id];
    if (cat === 'haut' && id === 'robe') v.masque = ['bas'];
    if (cat === 'corps') v.gabarit = GABARIT[id];
    return v;
  });
  if (AUCUN[cat]) variantes.unshift({ id: 'aucun', nom: AUCUN[cat], genre: '*', styles: ['plage', 'quotidien', 'sport', 'chic'], calques: [] });
  base.categories[cat] = { nom: NOMS[cat], groupe: GROUPE[cat] ?? 'tenue', variantes };
}
base.palettes = {
  peau: ['#fbe0cc', '#f5cba7', '#e8b48a', '#d39a6b', '#b9794a', '#8d5a3b', '#6b4128', '#4a2c1b'],
  cheveux: [['noir', '#1e1a1a'], ['brun', '#4a3020'], ['châtain', '#7a5233'], ['blond', '#d9b36c'], ['platine', '#efe0a8'], ['roux', '#b5502a'], ['gris', '#9a9a9e'], ['blanc', '#e8e8ea'], ['rose', '#e75a9a'], ['bleu', '#3b7fd9']],
  iris: [['marron', '#6b4423']], levres: ['#d9606b'],
  vetements: ['#ff6f61', '#ffd23f', '#1fb5c4', '#1f3a6b', '#f4f4f2', '#26262b', '#3aa05b', '#ff8fb3', '#ff9442', '#7a56c9', '#8a8f5a', '#d9383a'],
};
writeFileSync(join(DOSSIER, 'base.json'), JSON.stringify(base, null, 1) + '\n');
console.log(`atelier2 : ${Object.keys(base.categories).length} catégories, ${Object.values(base.categories).reduce((n, c) => n + c.variantes.length, 0)} variantes`);
