#!/usr/bin/env node
// Fabrique la BASE DE PIÈCES de l'atelier de personnages (prototype/public/atelier/) :
//   - un calque SVG par pièce (toile commune 400×700, aucun repère à calculer : tout est déjà à sa place),
//   - base.json = le « catalogue » : catégories, variantes, ordre d'empilement, palettes.
// Les couleurs sont des jetons {{peau}}, {{cheveux}}, {{c}}… remplacés au rendu : une même pièce sert dans toutes les teintes.
// Pour remplacer une pièce par un vrai dessin (ou une image du générateur) : garder le même nom de fichier et les mêmes repères.
//   node outils/fabriquer_atelier.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', 'prototype', 'public', 'atelier');
const W = 400, H = 640, VY = -30, CX = 200; // toile 400×680 ; viewBox décalée vers le haut pour laisser la place à la tête grossie
const r1 = (n) => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)} ${r1(y)}`;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- géométrie ----------
function lisse(pts, ferme = true) {
  const n = pts.length;
  let d = `M${P(...pts[0])}`;
  const fin = ferme ? n : n - 1;
  for (let i = 0; i < fin; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const p0 = ferme ? pts[(i - 1 + n) % n] : (pts[i - 1] ?? p1);
    const p3 = ferme ? pts[(i + 2) % n] : (pts[i + 2] ?? p2);
    d += `C${P(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)} ${P(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)} ${P(...p2)}`;
  }
  return d + (ferme ? 'Z' : '');
}
// côté droit [dx, y] du haut vers le bas (premier et dernier dx = 0 si fermé) → contour symétrique
function sym(dpts) {
  const droite = dpts.map(([dx, y]) => [CX + dx, y]);
  const gauche = dpts.slice().reverse().map(([dx, y]) => [CX - dx, y]).filter(([x]) => x !== CX);
  return [...droite, ...gauche];
}
const chemin = (pts, ferme = true) => `<path d="${lisse(pts, ferme)}"/>`;
function ech(nodes, u0, u1, n = 6) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const u = lerp(u0, u1, k / (n - 1));
    const i = Math.min(Math.floor(u), nodes.length - 2), t = u - i;
    const a = nodes[i], b = nodes[i + 1];
    out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), r: lerp(a.r, b.r, t) });
  }
  return out;
}
function tube(nodes, { pad = 0, bouts = true, flare = 0 } = {}) {
  const L = [], R = [];
  nodes.forEach((nd, i) => {
    const a = nodes[Math.max(0, i - 1)], b = nodes[Math.min(nodes.length - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const r = nd.r + pad + flare * (i / (nodes.length - 1));
    L.push([nd.x - dy * r, nd.y + dx * r]); R.push([nd.x + dy * r, nd.y - dx * r]);
  });
  let s = chemin([...L, ...R.reverse()]);
  if (bouts) { const a = nodes[0], b = nodes.at(-1); s += `<circle cx="${r1(a.x)}" cy="${r1(a.y)}" r="${r1(a.r + pad)}"/><circle cx="${r1(b.x)}" cy="${r1(b.y)}" r="${r1(b.r + pad + flare)}"/>`; }
  return s;
}

// ---------- rendu « dessin animé brillant » ----------
const degradeSym = (id, a, b, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{{${b}}}"/><stop offset=".3" stop-color="{{${a}}}"/><stop offset=".52" stop-color="{{${c}}}"/><stop offset=".78" stop-color="{{${a}}}"/><stop offset="1" stop-color="{{${b}}}"/></linearGradient>`;
const degradeVert = (id, a, b, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{{${c}}}"/><stop offset=".4" stop-color="{{${a}}}"/><stop offset="1" stop-color="{{${b}}}"/></linearGradient>`;
const degradeRad = (id, a, b, c) => `<radialGradient id="${id}" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="{{${c}}}"/><stop offset=".5" stop-color="{{${a}}}"/><stop offset="1" stop-color="{{${b}}}"/></radialGradient>`;
// contour d'abord (toutes les formes réunies, sans trait interne), remplissage ensuite
const dessin = (formes, remplissage, contour, ep = 5) =>
  `<g fill="{{${contour}}}" stroke="{{${contour}}}" stroke-width="${ep}" stroke-linejoin="round">${formes.join('')}</g><g fill="${remplissage}">${formes.join('')}</g>`;
const svg = (defs, corps) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${VY} ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs>${corps}</svg>\n`;
const trait = (d, c, l = 2, o = 1) => `<path d="${d}" fill="none" stroke="{{${c}}}" stroke-width="${l}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
const cote = (f) => [-1, 1].flatMap((s) => f(s));

// ---------- silhouettes (corps) ----------
const SIL = [
  { id: 'fine', nom: 'Fine', genre: 'f', gabarit: 'mince', ep: 50, ta: 36, ha: 50, br: 12, ja: 21, poit: 0.5 },
  { id: 'moyenne', nom: 'Moyenne', genre: 'f', gabarit: 'moyen', ep: 55, ta: 44, ha: 58, br: 14, ja: 25, poit: 0.7 },
  { id: 'ronde', nom: 'Ronde', genre: 'f', gabarit: 'rond', ep: 64, ta: 64, ha: 74, br: 19, ja: 33, poit: 1 },
  { id: 'mince-h', nom: 'Mince', genre: 'h', gabarit: 'mince', ep: 56, ta: 42, ha: 48, br: 13, ja: 20, poit: 0 },
  { id: 'moyen-h', nom: 'Moyen', genre: 'h', gabarit: 'moyen', ep: 64, ta: 52, ha: 54, br: 16, ja: 24, poit: 0 },
  { id: 'athletique', nom: 'Athlétique', genre: 'h', gabarit: 'muscle', ep: 78, ta: 50, ha: 58, br: 21, ja: 27, poit: 0 },
  { id: 'rond-h', nom: 'Rond', genre: 'h', gabarit: 'rond', ep: 72, ta: 72, ha: 66, br: 19, ja: 31, poit: 0 },
];
function largeur(s, y) {
  const k = [[176, 17], [186, s.ep * 0.72], [196, s.ep], [220, s.ep - 4], [246, (s.ep + s.ta) / 2 + s.poit * 3], [280, s.ta], [312, (s.ta + s.ha) / 2 + 3], [336, s.ha], [350, s.ha - 3]];
  if (y <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (y <= k[i][0]) return lerp(k[i - 1][1], k[i][1], (y - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
  return k.at(-1)[1];
}
const bras = (s, c) => [{ x: CX + c * (s.ep - 9), y: 201, r: s.br * 0.95 }, { x: CX + c * (s.ep + 2), y: 268, r: s.br * 0.85 }, { x: CX + c * (s.ep + 11), y: 335, r: s.br * 0.62 }];
const jambe = (s, c) => [{ x: CX + c * s.ha * 0.5, y: 336, r: s.ja * 1.06 }, { x: CX + c * s.ha * 0.46, y: 470, r: s.ja * 0.8 }, { x: CX + c * s.ha * 0.40, y: 584, r: s.ja * 0.58 }, { x: CX + c * s.ha * 0.40, y: 602, r: s.ja * 0.56 }];
const pied = (s, c) => ({ cx: CX + c * s.ha * 0.40 + c * 5, cy: 614, rx: 15 + s.ja * 0.18, ry: 11 });

function fTorse(s) {
  const dp = [[0, 178]]; for (let y = 178; y <= 350; y += 8) dp.push([largeur(s, y), y]);
  dp.push([s.ha - 6, 356], [s.ha * 0.4, 362], [0, 364]);
  const formes = [chemin(sym(dp)), `<rect x="${CX - 15}" y="134" width="30" height="58" rx="12"/>`];
  let d = degradeSym('g', 'peau', 'peauOmbre', 'peauClair');
  let c = dessin(formes, 'url(#g)', 'peauContour');
  if (s.poit > 0.3) c += cote((k) => [trait(`M${CX + k * 6} ${238 + s.poit * 4} Q${CX + k * s.ep * 0.4} ${252 + s.poit * 6} ${CX + k * s.ep * 0.72} ${238}`, 'peauOmbre', 2, 0.4)]).join('');
  c += `<ellipse cx="${CX - s.ep * 0.3}" cy="226" rx="${r1(s.ep * 0.13)}" ry="16" fill="#fff" opacity=".12"/>`;
  return svg(d, c);
}
function fBras(s) {
  const formes = cote((c) => { const n = bras(s, c); const hand = { x: CX + c * (s.ep + 14), y: 352, r: s.br * 0.8 + 2 }; return [tube(n), `<ellipse cx="${r1(hand.x)}" cy="${r1(hand.y)}" rx="${r1(hand.r * 0.92)}" ry="${r1(hand.r * 1.18)}"/>`]; });
  return svg(degradeSym('g', 'peau', 'peauOmbre', 'peauClair'), dessin(formes, 'url(#g)', 'peauContour'));
}
function fJambes(s) {
  const formes = cote((c) => { const p = pied(s, c); return [tube(jambe(s, c)), `<ellipse cx="${r1(p.cx)}" cy="${p.cy}" rx="${r1(p.rx)}" ry="${p.ry}"/>`]; });
  return svg(degradeSym('g', 'peau', 'peauOmbre', 'peauClair'), dessin(formes, 'url(#g)', 'peauContour'));
}

// ---------- tête et visage ----------
const TETES = [
  { id: 'ovale', nom: 'Ovale', wc: 47, wj: 36, cw: 12, top: 22, chin: 150 },
  { id: 'ronde', nom: 'Ronde', wc: 51, wj: 44, cw: 25, top: 24, chin: 148 },
  { id: 'carree', nom: 'Carrée', wc: 49, wj: 46, cw: 27, top: 23, chin: 148 },
  { id: 'allongee', nom: 'Allongée', wc: 44, wj: 35, cw: 12, top: 18, chin: 154 },
  { id: 'coeur', nom: 'Cœur', wc: 49, wj: 31, cw: 7, top: 22, chin: 152 },
];
function fTete(t) {
  const dp = [[0, t.top], [t.wc * 0.72, t.top + 7], [t.wc, 56], [t.wc, 86], [t.wj, 120], [t.cw, t.chin - 5], [0, t.chin]];
  const formes = [`<ellipse cx="${CX - t.wc}" cy="92" rx="7" ry="11"/>`, `<ellipse cx="${CX + t.wc}" cy="92" rx="7" ry="11"/>`, chemin(sym(dp))];
  let c = dessin(formes, 'url(#g)', 'peauContour');
  c += cote((k) => [`<ellipse cx="${CX + k * 30}" cy="112" rx="10" ry="6" fill="#ff6b6b" opacity=".16"/>`, trait(`M${CX + k * (t.wc + 1)} 86 Q${CX + k * (t.wc - 3)} 92 ${CX + k * (t.wc + 1)} 100`, 'peauOmbre', 1.6, 0.5)]).join('');
  return svg(degradeRad('g', 'peau', 'peauOmbre', 'peauClair'), c);
}
const OEIL_BASE = { y: 88 };
const YEUX = [
  { id: 'ronds', nom: 'Ronds', ex: 21, w: 11, hu: 8, hd: 7, tilt: 0, ir: 7.5, lw: 2.6, cils: 0 },
  { id: 'amande', nom: 'Amande', ex: 21, w: 11.5, hu: 6, hd: 5, tilt: 1.5, ir: 6, lw: 3, cils: 1 },
  { id: 'tombants', nom: 'Tombants', ex: 21, w: 11, hu: 6, hd: 5.5, tilt: -2.5, ir: 6, lw: 2.8, cils: 0 },
  { id: 'chat', nom: 'En chat', ex: 22, w: 12, hu: 5.5, hd: 4, tilt: 3.5, ir: 5.5, lw: 3.2, cils: 2 },
  { id: 'petits', nom: 'Petits', ex: 20, w: 8, hu: 4.5, hd: 4, tilt: 0, ir: 4.6, lw: 2.4, cils: 0 },
  { id: 'grands-cils', nom: 'Grands cils', ex: 21, w: 11.5, hu: 8.5, hd: 6.5, tilt: 1, ir: 7.2, lw: 3.2, cils: 3 },
];
function fYeux(p) {
  let defs = '<radialGradient id="gi" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="{{irisClair}}"/><stop offset=".6" stop-color="{{iris}}"/><stop offset="1" stop-color="{{irisOmbre}}"/></radialGradient>';
  let c = '';
  [-1, 1].forEach((s, k) => {
    const x0 = CX + s * p.ex, y0 = OEIL_BASE.y;
    const ix = [x0 - s * p.w, y0 + p.tilt * 0.4], ox = [x0 + s * p.w, y0 - p.tilt];
    const cu = y0 - 2 * p.hu, cl = y0 + 2 * p.hd;
    const haut = `M${P(...ix)}Q${P(x0, cu)} ${P(...ox)}`;
    const forme = `${haut}Q${P(x0, cl)} ${P(...ix)}Z`;
    defs += `<clipPath id="c${k}"><path d="${forme}"/></clipPath>`;
    c += `<path d="${forme}" fill="#fcfcfc"/>`;
    c += `<g clip-path="url(#c${k})"><circle cx="${r1(x0 + s * 0.5)}" cy="${r1(y0 - 0.5)}" r="${p.ir}" fill="url(#gi)"/><circle cx="${r1(x0 + s * 0.5)}" cy="${r1(y0 - 0.5)}" r="${r1(p.ir * 0.46)}" fill="#1a1210"/><circle cx="${r1(x0 + p.ir * 0.38)}" cy="${r1(y0 - p.ir * 0.4)}" r="${r1(p.ir * 0.27)}" fill="#fff"/><circle cx="${r1(x0 - p.ir * 0.3)}" cy="${r1(y0 + p.ir * 0.35)}" r="${r1(p.ir * 0.12)}" fill="#fff" opacity=".8"/><path d="${haut}L${P(x0, y0 - p.hu * 2)}Z" fill="#000" opacity=".12"/></g>`;
    c += `<path d="${haut}" fill="none" stroke="#2a1a17" stroke-width="${p.lw}" stroke-linecap="round"/>`;
    c += trait(`M${P(...ix)}Q${P(x0, cl)} ${P(...ox)}`, 'peauContour', 1.4, 0.55);
    for (let i = 0; i < p.cils; i++) c += `<path d="M${P(ox[0] - s * i * 2.6, ox[1] + i * 1.2)}l${s * (4 + i)} ${-3 - i * 0.6}" stroke="#2a1a17" stroke-width="2" stroke-linecap="round" fill="none"/>`;
  });
  return svg(defs, c);
}
const SOURCILS = [
  { id: 'arques', nom: 'Arqués', bw: 13, a: 0, arch: 6, c: 2, tw: 3.4 },
  { id: 'droits', nom: 'Droits', bw: 13, a: 0, arch: 1, c: 0, tw: 3.4 },
  { id: 'epais', nom: 'Épais', bw: 14, a: 1, arch: 3, c: 2, tw: 6 },
  { id: 'fins', nom: 'Fins', bw: 13, a: 0, arch: 5, c: 3, tw: 2 },
  { id: 'tombants', nom: 'Tombants', bw: 13, a: -3, arch: 2, c: 4, tw: 3.6 },
];
function fSourcils(p) {
  const y = 71;
  const c = cote((s) => [`<path d="M${P(CX + s * 21 - s * p.bw, y + p.a + 2)}Q${P(CX + s * 21 - s * 2, y - p.arch * 1.5 - 2)} ${P(CX + s * 21 + s * p.bw, y + p.c + 1)}" fill="none" stroke="{{sourcil}}" stroke-width="${p.tw}" stroke-linecap="round"/>`]).join('');
  return svg('', c);
}
const NEZ = [
  { id: 'petit', nom: 'Petit', wing: 5, tip: 110, nos: 1.4 },
  { id: 'pointu', nom: 'Pointu', wing: 4.5, tip: 114, nos: 1.2, long: 1 },
  { id: 'large', nom: 'Large', wing: 8.5, tip: 111, nos: 2.2 },
  { id: 'retrousse', nom: 'Retroussé', wing: 6, tip: 108, nos: 2.4 },
  { id: 'bouton', nom: 'Bouton', wing: 6.5, tip: 109, nos: 1.6, bulb: 1 },
];
function fNez(p) {
  let c = trait(`M${CX - 4} ${p.long ? 90 : 96} Q${CX - 6} ${p.tip - 8} ${CX - p.wing + 1} ${p.tip - 3}`, 'peauOmbre', 1.8, 0.55);
  if (p.bulb) c += `<circle cx="${CX}" cy="${p.tip - 1}" r="6.5" fill="{{peauClair}}" opacity=".7"/>`;
  c += trait(`M${CX - p.wing} ${p.tip - 2} Q${CX} ${p.tip + 4} ${CX + p.wing} ${p.tip - 2}`, 'peauContour', 2, 0.9);
  c += cote((s) => [`<ellipse cx="${CX + s * (p.wing - 1.5)}" cy="${p.tip + 0.5}" rx="${p.nos}" ry="${r1(p.nos * 0.8)}" fill="{{peauContour}}" opacity=".85"/>`]).join('');
  return svg('', c);
}
const BOUCHES = ['sourire', 'sourire-dents', 'neutre', 'fine', 'pulpeuse', 'surprise', 'sourire-en-coin'];
const NOMS_BOUCHE = { sourire: 'Sourire', 'sourire-dents': 'Grand sourire', neutre: 'Neutre', fine: 'Fine', pulpeuse: 'Pulpeuse', surprise: 'Surprise', 'sourire-en-coin': 'En coin' };
function fBouche(id) {
  const lip = (w, cl, cr, u, l) => `M${P(CX - w, cl)}Q${P(CX, u)} ${P(CX + w, cr)}Q${P(CX, l)} ${P(CX - w, cl)}Z`;
  const lev = (d, extra = '') => `<path d="${d}" fill="{{levres}}" stroke="{{levresContour}}" stroke-width="2" stroke-linejoin="round"/>${extra}`;
  const lueur = (y = 133) => `<ellipse cx="${CX}" cy="${y}" rx="4.5" ry="1.4" fill="#fff" opacity=".4"/>`;
  let defs = '', c = '';
  switch (id) {
    case 'sourire': c = lev(lip(13, 125, 125, 134, 143), lueur(133.5)); break;
    case 'sourire-dents': {
      const d = lip(15, 124, 124, 130, 152);
      defs = `<clipPath id="b"><path d="${d}"/></clipPath>`;
      c = `<path d="${d}" fill="#7a2a33"/><g clip-path="url(#b)"><rect x="170" y="118" width="60" height="12" fill="#fff"/><ellipse cx="${CX}" cy="139" rx="8" ry="4" fill="#e8737f"/></g><path d="${d}" fill="none" stroke="{{levresContour}}" stroke-width="2.4" stroke-linejoin="round"/>`;
      break;
    }
    case 'neutre': c = lev(lip(11, 129, 129, 129, 136)); break;
    case 'fine': c = trait(`M${CX - 11} 128 Q${CX} 133 ${CX + 11} 128`, 'levresContour', 2.6); break;
    case 'pulpeuse': c = lev(lip(13, 127, 127, 124, 147), trait(`M${CX - 13} 127 Q${CX} 130 ${CX + 13} 127`, 'levresContour', 1.6) + lueur(136)); break;
    case 'surprise': c = `<ellipse cx="${CX}" cy="130" rx="5.5" ry="7" fill="#7a2a33" stroke="{{levresContour}}" stroke-width="2.6"/>`; break;
    case 'sourire-en-coin': c = lev(lip(12, 128, 121, 132, 140), lueur(132)); break;
  }
  return svg(defs, c);
}

// ---------- cheveux ----------
function casque({ W = 52, top = 10, side = 82, hl = 44, temple = 58, front = null }) {
  const fr = front ?? [[W * 0.55, hl - 3], [W * 0.25, hl - 3.5], [0, hl]];
  return chemin(sym([[0, top], [W * 0.7, top + 4], [W + 2, top + 26], [W + 3, side], [W - 7, side - 6], [W - 11, temple], ...fr]));
}
const meches = (x, hl = 44) => cote((s) => [trait(`M${CX + s * 6} ${x} Q${CX + s * 30} ${x + 14} ${CX + s * 44} ${hl + 22}`, 'cheveuxOmbre', 2, 0.45), trait(`M${CX + s * 20} ${x - 2} Q${CX + s * 42} ${x + 10} ${CX + s * 50} ${hl + 38}`, 'cheveuxOmbre', 1.8, 0.35)]).join('') + trait(`M${CX - 36} ${x + 4} Q${CX - 10} ${x - 4} ${CX + 20} ${x + 2}`, 'cheveuxClair', 4, 0.5);
const gH = degradeVert('g', 'cheveux', 'cheveuxOmbre', 'cheveuxClair');
const cheveux = (formes, extra = '') => dessin(formes, 'url(#g)', 'cheveuxContour') + extra;
const CHEVEUX = [
  { id: 'chauve', nom: 'Chauve', genre: '*', poids: 0.4 },
  { id: 'court', nom: 'Court', genre: 'h', avant: () => cheveux([casque({})], meches(16)) },
  { id: 'frange', nom: 'Frange', genre: '*', avant: () => cheveux([casque({ hl: 60, front: [[52 * 0.55, 54], [52 * 0.28, 66], [0, 62]] })], meches(16, 52)) },
  { id: 'mi-long', nom: 'Mi-long', genre: 'f', arriere: () => cheveux([chemin(sym([[0, 12], [60, 26], [67, 100], [65, 168], [56, 204], [36, 212], [0, 204]]))]), avant: () => cheveux([casque({ hl: 50, front: [[52 * 0.55, 48], [52 * 0.25, 58], [0, 50]] })], meches(16, 48)) },
  { id: 'long', nom: 'Long', genre: 'f', arriere: () => cheveux([chemin(sym([[0, 12], [60, 26], [68, 110], [70, 230], [64, 320], [40, 336], [0, 326]]))]), avant: () => cheveux([casque({ hl: 52, front: [[52 * 0.55, 50], [52 * 0.25, 60], [0, 52]] })], meches(16, 50)) },
  { id: 'carre', nom: 'Carré', genre: 'f', arriere: () => cheveux([chemin(sym([[0, 12], [62, 26], [64, 100], [62, 150], [50, 164], [0, 158]]))]), avant: () => cheveux([casque({ hl: 56, front: [[52 * 0.55, 52], [52 * 0.25, 62], [0, 56]] })], meches(16, 52)) },
  { id: 'queue', nom: 'Queue de côté', genre: 'f', arriere: () => cheveux([chemin([[CX + 40, 44], [CX + 70, 72], [CX + 78, 130], [CX + 70, 196], [CX + 60, 244], [CX + 50, 196], [CX + 52, 120]]), `<circle cx="${CX + 52}" cy="58" r="8"/>`]), avant: () => cheveux([casque({ hl: 46 })], meches(16)) },
  { id: 'chignon', nom: 'Chignon', genre: 'f', avant: () => cheveux([casque({ top: 16, hl: 44 }), `<circle cx="${CX}" cy="14" r="14"/>`], meches(20)) },
  { id: 'boucle', nom: 'Bouclé', genre: '*', arriere: () => cheveux(Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return `<circle cx="${r1(CX + Math.cos(a) * 58)}" cy="${r1(64 + Math.sin(a) * 52)}" r="18"/>`; }).concat([`<ellipse cx="${CX}" cy="64" rx="56" ry="50"/>`])), avant: () => cheveux([casque({ hl: 40 })].concat(Array.from({ length: 7 }, (_, i) => `<circle cx="${r1(CX - 36 + i * 12)}" cy="${r1(40 + Math.abs(i - 3) * 3)}" r="8"/>`)), meches(18, 40)) },
  { id: 'couronne', nom: 'Dégarni', genre: 'h', avant: () => cheveux(cote((s) => [chemin([[CX + s * 49, 64], [CX + s * 58, 82], [CX + s * 56, 116], [CX + s * 42, 124], [CX + s * 44, 92]])])) },
];

// ---------- vêtements ----------
const dVet = degradeSym('g', 'c', 'cOmbre', 'cClair');
const vet = (formes, extra = '') => dessin(formes, 'url(#g)', 'cContour', 4.5) + extra;
function corpsHaut(s, { y1, pad = 3, flare = 0, prof = 22, large = 1 }) {
  const nw = 16, dr = [];
  for (let y = 186; y <= y1; y += 10) dr.push([largeur(s, y) + pad + flare * Math.pow((y - 186) / (y1 - 186), 2), y]);
  const fin = dr.at(-1)[0];
  const pts = [[CX + nw, 184], ...dr.map(([dx, y]) => [CX + dx, y]), [CX + fin * 0.5, y1 + 4], [CX, y1 + 5], [CX - fin * 0.5, y1 + 4], ...dr.slice().reverse().map(([dx, y]) => [CX - dx, y]), [CX - nw, 184], [CX - nw * 0.6 * large, 184 + prof * 0.65], [CX, 184 + prof], [CX + nw * 0.6 * large, 184 + prof * 0.65]];
  return { pts, d: lisse(pts), col: lisse([[CX - nw, 184], [CX - nw * 0.6 * large, 184 + prof * 0.65], [CX, 184 + prof], [CX + nw * 0.6 * large, 184 + prof * 0.65], [CX + nw, 184]], false) };
}
const HAUTS = [
  { id: 'aucun', nom: 'Torse nu', genre: 'h', styles: ['plage'] },
  { id: 'tshirt', nom: 'T-shirt', genre: '*', styles: ['plage', 'quotidien', 'sport'], f: (s) => { const b = corpsHaut(s, { y1: 304, flare: 4 }); return vet([`<path d="${b.d}"/>`, ...cote((c) => [tube(ech(bras(s, c), 0, 0.8), { pad: 3.5, bouts: false })])], trait(b.col, 'cOmbre', 3, 0.7) + trait(`M${CX - 70} 306 Q${CX} 312 ${CX + 70} 306`, 'cOmbre', 0, 0)); } },
  { id: 'debardeur', nom: 'Débardeur', genre: '*', styles: ['plage', 'sport'], f: (s) => { const b = corpsHaut(s, { y1: 300, pad: 2, prof: 40, large: 1.6 }); return vet([`<path d="${b.d}"/>`, ...cote((c) => [tube([{ x: CX + c * s.ep * 0.4, y: 186, r: 6 }, { x: CX + c * s.ep * 0.5, y: 212, r: 6 }], { bouts: true })])], trait(b.col, 'cOmbre', 2.5, 0.6)); } },
  { id: 'chemise', nom: 'Chemise', genre: '*', styles: ['quotidien', 'chic', 'plage'], f: (s) => { const b = corpsHaut(s, { y1: 322, pad: 4, flare: 6, prof: 40, large: 0.5 }); return vet([`<path d="${b.d}"/>`, ...cote((c) => [tube(ech(bras(s, c), 0, 2), { pad: 4, bouts: false })])], trait(`M${CX} 224 L${CX} 322`, 'cOmbre', 2.4, 0.6) + [248, 274, 300].map((y) => `<circle cx="${CX + 5}" cy="${y}" r="2.4" fill="{{cClair}}" stroke="{{cContour}}" stroke-width="1"/>`).join('') + trait(b.col, 'cContour', 3.4, 0.9) + cote((c) => [trait(`M${CX + c * 3} 186 L${CX + c * 20} 206`, 'cContour', 2.6, 0.8)]).join('')); } },
  { id: 'pull', nom: 'Pull', genre: '*', styles: ['quotidien', 'chic'], f: (s) => { const b = corpsHaut(s, { y1: 308, pad: 5, flare: 2, prof: 16 }); return vet([`<path d="${b.d}"/>`, ...cote((c) => [tube(ech(bras(s, c), 0, 2), { pad: 5, bouts: false })])], trait(b.col, 'cOmbre', 5, 0.7) + trait(`M${CX - 64 - s.ep * 0.1} 306 Q${CX} 314 ${CX + 64 + s.ep * 0.1} 306`, 'cOmbre', 4, 0.5)); } },
  { id: 'maillot-haut', nom: 'Haut de maillot', genre: 'f', styles: ['plage'], f: (s) => { const rx = 15 + s.poit * 5, yy = 236 + s.poit * 2; return vet([...cote((c) => [`<ellipse cx="${CX + c * s.ep * 0.34}" cy="${yy}" rx="${r1(rx)}" ry="${r1(13 + s.poit * 3)}"/>`, tube([{ x: CX + c * s.ep * 0.38, y: yy - 8, r: 2.4 }, { x: CX + c * 12, y: 188, r: 2.4 }], { bouts: false })]), `<rect x="${CX - s.ep * 0.34}" y="${yy + 10}" width="${r1(s.ep * 0.68)}" height="5" rx="2.5"/>`]); } },
  { id: 'robe', nom: 'Robe', genre: 'f', styles: ['plage', 'chic', 'quotidien'], masque: ['bas'], f: (s) => { const nw = 16, dr = []; for (let y = 200; y <= 336; y += 12) dr.push([largeur(s, y) + 2, y]); for (let y = 350; y <= 480; y += 26) dr.push([s.ha + 2 + (y - 336) * 0.5, y]); const fin = dr.at(-1)[0]; const pts = [[CX + nw, 184], ...dr.map(([dx, y]) => [CX + dx, y]), [CX + fin * 0.5, 486], [CX, 487], [CX - fin * 0.5, 486], ...dr.slice().reverse().map(([dx, y]) => [CX - dx, y]), [CX - nw, 184], [CX - 10, 214], [CX, 220], [CX + 10, 214]]; return vet([chemin(pts), ...cote((c) => [tube([{ x: CX + c * s.ep * 0.42, y: 186, r: 6 }, { x: CX + c * s.ep * 0.5, y: 214, r: 6 }])])], trait(`M${CX - 20} 220 Q${CX} 232 ${CX + 20} 220`, 'cOmbre', 2.5, 0.6) + trait(`M${CX - s.ta - 4} 296 Q${CX} 304 ${CX + s.ta + 4} 296`, 'cOmbre', 3, 0.5)); } },
];
function jambesVet(s, u1, { pad = 3, flare = 0, haut = 300 } = {}) {
  const w = largeur(s, haut) + pad;
  const taille = chemin([[CX - w, haut], [CX - w * 0.5, haut - 2], [CX + w * 0.5, haut - 2], [CX + w, haut], [CX + s.ha + pad, 338], [CX + s.ha * 0.3, 350], [CX - s.ha * 0.3, 350], [CX - s.ha - pad, 338]]);
  return [taille, ...cote((c) => [tube(ech(jambe(s, c), 0, u1), { pad, bouts: false, flare })])];
}
const BAS = [
  { id: 'maillot', nom: 'Maillot de bain', genre: '*', styles: ['plage'], f: (s) => { const w = largeur(s, 318) + 2; return vet([chemin([[CX - w, 314], [CX + w, 314], [CX + s.ha + 2, 342], [CX + s.ha * 0.45, 374], [CX, 366], [CX - s.ha * 0.45, 374], [CX - s.ha - 2, 342]])], trait(`M${CX - w} 322 Q${CX} 328 ${CX + w} 322`, 'cOmbre', 2.5, 0.5)); } },
  { id: 'short', nom: 'Short', genre: '*', styles: ['plage', 'quotidien', 'sport'], f: (s) => vet(jambesVet(s, 0.42, { pad: 3, flare: 3 })) },
  { id: 'bermuda', nom: 'Bermuda', genre: '*', styles: ['plage', 'quotidien', 'chic'], f: (s) => vet(jambesVet(s, 1.02, { pad: 3, flare: 2 }), trait(`M${CX - 30} 306 L${CX - 30} 332`, 'cOmbre', 0, 0)) },
  { id: 'pantalon', nom: 'Pantalon', genre: '*', styles: ['quotidien', 'chic'], f: (s) => vet(jambesVet(s, 2.03, { pad: 3, flare: 3 }) , trait(`M${CX} 336 L${CX} 352`, 'cOmbre', 2, 0.5)) },
  { id: 'jupe', nom: 'Jupe', genre: 'f', styles: ['plage', 'quotidien', 'chic'], f: (s) => { const w = largeur(s, 302) + 2; return vet([chemin(sym([[w, 300], [s.ha + 3, 336], [s.ha + 14, 392], [s.ha + 24, 438], [0, 446]]).concat([]))].map((x) => x), trait(`M${CX - w} 306 Q${CX} 312 ${CX + w} 306`, 'cOmbre', 2.4, 0.5)); } },
  { id: 'jupe-longue', nom: 'Jupe longue', genre: 'f', styles: ['chic', 'plage'], f: (s) => { const w = largeur(s, 302) + 2; return vet([chemin(sym([[w, 300], [s.ha + 3, 336], [s.ha + 18, 420], [s.ha + 34, 500], [s.ha + 40, 548], [0, 556]]))], trait(`M${CX - w} 306 Q${CX} 312 ${CX + w} 306`, 'cOmbre', 2.4, 0.5)); } },
];
const CHAUSSURES = [
  { id: 'nu', nom: 'Pieds nus', genre: '*', styles: ['plage'] },
  { id: 'tongs', nom: 'Tongs', genre: '*', styles: ['plage'], f: (s) => vet(cote((c) => { const p = pied(s, c); return [`<ellipse cx="${r1(p.cx)}" cy="${p.cy + 4}" rx="${r1(p.rx + 2)}" ry="${p.ry + 1}"/>`]; }), cote((c) => { const p = pied(s, c); return [trait(`M${P(p.cx, p.cy + 2)} L${P(p.cx - 9, p.cy - 8)} M${P(p.cx, p.cy + 2)} L${P(p.cx + 9, p.cy - 8)}`, 'cClair', 3.4)]; }).join('')) },
  { id: 'sandales', nom: 'Sandales', genre: '*', styles: ['plage', 'quotidien'], f: (s) => vet(cote((c) => { const p = pied(s, c); return [`<ellipse cx="${r1(p.cx)}" cy="${p.cy + 4}" rx="${r1(p.rx + 2)}" ry="${p.ry + 1}"/>`]; }), cote((c) => { const p = pied(s, c); return [trait(`M${P(p.cx - 13, p.cy)} Q${P(p.cx, p.cy - 10)} ${P(p.cx + 13, p.cy)}`, 'cClair', 3.4), trait(`M${P(p.cx - 10, p.cy + 8)} Q${P(p.cx, p.cy + 2)} ${P(p.cx + 10, p.cy + 8)}`, 'cClair', 3)]; }).join('')) },
  { id: 'baskets', nom: 'Baskets', genre: '*', styles: ['quotidien', 'sport', 'chic'], f: (s) => vet(cote((c) => { const p = pied(s, c); return [`<ellipse cx="${r1(p.cx)}" cy="${p.cy - 2}" rx="${r1(p.rx + 4)}" ry="${p.ry + 5}"/>`, `<rect x="${r1(p.cx - p.rx - 3)}" y="${p.cy - 2}" width="${r1(2 * p.rx + 6)}" height="14" rx="6"/>`]; }), cote((c) => { const p = pied(s, c); return [`<rect x="${r1(p.cx - p.rx - 3)}" y="${p.cy + 6}" width="${r1(2 * p.rx + 6)}" height="7" rx="3.5" fill="#fff" stroke="{{cContour}}" stroke-width="1.5"/>`, trait(`M${P(p.cx - 7, p.cy - 10)} l14 0 M${P(p.cx - 7, p.cy - 5)} l14 0`, 'cClair', 1.8, 0.9)]; }).join('')) },
];
const CHAPEAUX = [
  { id: 'aucun', nom: 'Aucun', genre: '*', styles: ['plage', 'quotidien', 'sport', 'chic'] },
  { id: 'casquette', nom: 'Casquette', genre: '*', styles: ['quotidien', 'sport', 'plage'], f: () => vet([`<path d="M${CX - 54} 62 C${CX - 58} 18 ${CX - 30} 4 ${CX} 4 C${CX + 30} 4 ${CX + 58} 18 ${CX + 54} 62 Z"/>`, `<path d="M${CX - 56} 60 Q${CX} 74 ${CX + 56} 60 Q${CX} 50 ${CX - 56} 60Z"/>`], `<circle cx="${CX}" cy="6" r="3.6" fill="{{cClair}}"/>`) },
  { id: 'paille', nom: 'Chapeau de paille', genre: '*', styles: ['plage'], f: () => vet([`<ellipse cx="${CX}" cy="50" rx="104" ry="22"/>`, `<path d="M${CX - 46} 52 C${CX - 48} 12 ${CX - 26} 4 ${CX} 4 C${CX + 26} 4 ${CX + 48} 12 ${CX + 46} 52 Z"/>`], trait(`M${CX - 46} 44 Q${CX} 56 ${CX + 46} 44`, 'cOmbre', 7, 0.8)) },
  { id: 'bob', nom: 'Bob', genre: '*', styles: ['plage', 'quotidien'], f: () => vet([`<path d="M${CX - 52} 50 C${CX - 56} 14 ${CX - 28} 4 ${CX} 4 C${CX + 28} 4 ${CX + 56} 14 ${CX + 52} 50 Z"/>`, `<path d="M${CX - 62} 48 Q${CX} 62 ${CX + 62} 48 L${CX + 68} 60 Q${CX} 78 ${CX - 68} 60Z"/>`], trait(`M${CX - 52} 44 Q${CX} 54 ${CX + 52} 44`, 'cOmbre', 3, 0.5)) },
];
const LUNETTES = [
  { id: 'aucune', nom: 'Aucune', genre: '*', styles: ['plage', 'quotidien', 'sport', 'chic'] },
  { id: 'soleil', nom: 'Soleil', genre: '*', styles: ['plage', 'quotidien'], f: () => cote((s) => [`<rect x="${CX + s * 21 - 14}" y="77" width="28" height="21" rx="8" fill="#16161d" stroke="{{c}}" stroke-width="3" opacity=".92"/>`, trait(`M${CX + s * 35} 84 L${CX + s * 50} 88`, 'c', 3), `<path d="M${CX + s * 21 - 8} 82 l8 -2" stroke="#fff" stroke-width="2" opacity=".4" fill="none"/>`]).join('') + trait(`M${CX - 7} 84 Q${CX} 80 ${CX + 7} 84`, 'c', 3) },
  { id: 'rondes', nom: 'Rondes', genre: '*', styles: ['quotidien', 'chic'], f: () => cote((s) => [`<circle cx="${CX + s * 21}" cy="88" r="13" fill="#cfe9ff" fill-opacity=".25" stroke="{{c}}" stroke-width="3"/>`, trait(`M${CX + s * 34} 86 L${CX + s * 49} 88`, 'c', 2.6)]).join('') + trait(`M${CX - 8} 86 Q${CX} 82 ${CX + 8} 86`, 'c', 2.6) },
];

// ---------- écriture ----------
rmSync(RACINE, { recursive: true, force: true });
// Proportions « jeu » : tête grossie, corps plus court et plus large, tous deux ancrés à la base du cou (200, 176).
const GROUPE_TETE = ['tete', 'yeux', 'sourcils', 'nez', 'bouche', 'cheveux', 'chapeau', 'lunettes'];
const TRANSFORMS = { tete: 'translate(200 176) scale(1.15) translate(-200 -176)', corps: 'translate(200 176) scale(1.1 0.92) translate(-200 -176)' };
const ecrire = (rel, texte) => {
  const f = join(RACINE, rel); mkdirSync(dirname(f), { recursive: true });
  if (rel.endsWith('.svg')) { const t = TRANSFORMS[GROUPE_TETE.includes(rel.split('/')[0]) ? 'tete' : 'corps']; texte = texte.replace('</defs>', `</defs><g transform="${t}">`).replace('</svg>', '</g></svg>'); }
  writeFileSync(f, texte);
};
const base = {
  schema: 'atelier/1',
  note: 'Base de pièces de l\'atelier de personnages. Chaque variante = un ou plusieurs calques SVG de la toile commune (400×700). `z` = couche d\'empilement (voir `ordre`). `{sil}` dans un nom de fichier = id de la silhouette (torse pour les hauts, jambes pour les bas et chaussures). Jetons de couleur : peau*, cheveux*, iris*, levres*, sourcil, c* (vêtement). Fabriqué par outils/fabriquer_atelier.mjs ; remplacer un fichier par un vrai dessin de mêmes repères suffit.',
  toile: [W, H],
  ordre: ['cheveux_arriere', 'jambes', 'chaussures', 'torse', 'bas', 'bras', 'haut', 'tete', 'yeux', 'nez', 'bouche', 'sourcils', 'cheveux_avant', 'lunettes', 'chapeau'],
  silhouettes: SIL.map(({ id, nom, genre, gabarit }) => ({ id, nom, genre, gabarit })),
  categories: {},
};
const cat = (id, nom, groupe, variantes) => { base.categories[id] = { nom, groupe, variantes }; };
const V = (id, nom, calques, extra = {}) => ({ id, nom, calques, ...extra });

// corps : un calque par silhouette
const corps = (nomCat, id, f) => SIL.map((s) => { ecrire(`${id}/${s.id}.svg`, f(s)); return V(s.id, s.nom, [{ z: id, fichier: `${id}/${s.id}.svg` }], { genre: s.genre, gabarit: s.gabarit }); });
cat('torse', 'Torse', 'corps', corps('Torse', 'torse', fTorse));
cat('bras', 'Bras et mains', 'corps', corps('Bras', 'bras', fBras));
cat('jambes', 'Jambes et pieds', 'corps', corps('Jambes', 'jambes', fJambes));
cat('tete', 'Tête', 'visage', TETES.map((t) => { ecrire(`tete/${t.id}.svg`, fTete(t)); return V(t.id, t.nom, [{ z: 'tete', fichier: `tete/${t.id}.svg` }], { genre: '*' }); }));
cat('yeux', 'Yeux', 'visage', YEUX.map((p) => { ecrire(`yeux/${p.id}.svg`, fYeux(p)); return V(p.id, p.nom, [{ z: 'yeux', fichier: `yeux/${p.id}.svg` }], { genre: p.cils >= 2 ? 'f' : '*' }); }));
cat('sourcils', 'Sourcils', 'visage', SOURCILS.map((p) => { ecrire(`sourcils/${p.id}.svg`, fSourcils(p)); return V(p.id, p.nom, [{ z: 'sourcils', fichier: `sourcils/${p.id}.svg` }], { genre: p.id === 'epais' ? 'h' : p.id === 'fins' ? 'f' : '*' }); }));
cat('nez', 'Nez', 'visage', NEZ.map((p) => { ecrire(`nez/${p.id}.svg`, fNez(p)); return V(p.id, p.nom, [{ z: 'nez', fichier: `nez/${p.id}.svg` }], { genre: '*' }); }));
cat('bouche', 'Bouche', 'visage', BOUCHES.map((id) => { ecrire(`bouche/${id}.svg`, fBouche(id)); return V(id, NOMS_BOUCHE[id], [{ z: 'bouche', fichier: `bouche/${id}.svg` }], { genre: id === 'pulpeuse' ? 'f' : '*' }); }));
cat('cheveux', 'Cheveux', 'visage', CHEVEUX.map((h) => {
  const calques = [];
  if (h.arriere) { ecrire(`cheveux/${h.id}.arriere.svg`, svg(gH, h.arriere())); calques.push({ z: 'cheveux_arriere', fichier: `cheveux/${h.id}.arriere.svg` }); }
  if (h.avant) { ecrire(`cheveux/${h.id}.avant.svg`, svg(gH, h.avant())); calques.push({ z: 'cheveux_avant', fichier: `cheveux/${h.id}.avant.svg` }); }
  return V(h.id, h.nom, calques, { genre: h.genre, ...(h.poids ? { poids: h.poids } : {}) });
}));
const habits = (id, nom, liste, z, suit) => cat(id, nom, 'tenue', liste.map((p) => {
  const calques = [];
  if (p.f) {
    if (suit) { SIL.forEach((s) => ecrire(`${id}/${p.id}.${s.id}.svg`, svg(dVet, p.f(s)))); calques.push({ z, fichier: `${id}/${p.id}.{sil}.svg` }); }
    else { ecrire(`${id}/${p.id}.svg`, svg(dVet, p.f())); calques.push({ z, fichier: `${id}/${p.id}.svg` }); }
  }
  return V(p.id, p.nom, calques, { genre: p.genre, styles: p.styles, ...(suit ? { suit } : {}), ...(p.masque ? { masque: p.masque } : {}) });
}));
habits('haut', 'Haut', HAUTS, 'haut', 'torse');
habits('bas', 'Bas', BAS, 'bas', 'jambes');
habits('chaussures', 'Chaussures', CHAUSSURES, 'chaussures', 'jambes');
habits('chapeau', 'Chapeau', CHAPEAUX, 'chapeau', null);
habits('lunettes', 'Lunettes', LUNETTES, 'lunettes', null);

base.palettes = {
  peau: ['#fbe0cc', '#f5cba7', '#e8b48a', '#d39a6b', '#b9794a', '#8d5a3b', '#6b4128', '#4a2c1b'],
  cheveux: [['noir', '#1e1a1a'], ['brun', '#4a3020'], ['châtain', '#7a5233'], ['blond', '#d9b36c'], ['platine', '#efe0a8'], ['roux', '#b5502a'], ['gris', '#9a9a9e'], ['blanc', '#e8e8ea'], ['rose', '#e75a9a'], ['bleu', '#3b7fd9']],
  iris: [['marron', '#6b4423'], ['noisette', '#8b6b2f'], ['vert', '#3f8f5a'], ['bleu', '#3c78c8'], ['gris', '#7d8a99'], ['noir', '#2a1c14']],
  vetements: ['#ff6f61', '#ffd23f', '#1fb5c4', '#1f3a6b', '#f4f4f2', '#26262b', '#3aa05b', '#ff8fb3', '#ff9442', '#7a56c9', '#8a8f5a', '#d9383a'],
  levres: ['#d9606b', '#c2455a', '#e88a8f', '#a8323f'],
};
ecrire('base.json', JSON.stringify(base, null, 1) + '\n');
const nb = Object.values(base.categories).reduce((n, c) => n + c.variantes.length, 0);
console.log(`atelier : ${Object.keys(base.categories).length} catégories, ${nb} variantes → ${RACINE}`);
