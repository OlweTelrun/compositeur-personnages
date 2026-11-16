// Export de sprites : recettes → PNG transparents au format des visiteurs du jeu
// (carré kit.rendu.taille, personnage posé au sol). Sortie rangée comme dans le jeu :
// <segment>/<index>.png. Aucune dépendance au DOM à l'import (le serveur réutilise cheminSortie).
import { KIT, recetteExemple, validerRecette } from './kit.js';

/** Chemin relatif de sortie, ou null si le nom sort du contrat (le serveur refuse alors d'écrire). */
export function cheminSortie(segment, index) {
  if (typeof segment !== 'string' || !/^[a-z][a-z0-9-]{0,29}$/.test(segment)) return null;
  const n = typeof index === 'number' ? String(index) : index;
  if (typeof n !== 'string' || !/^\d{1,3}$/.test(n)) return null;
  return `${segment}/${Number(n)}.png`;
}

/** Recette complète d'un élément de lot : l'exemple du kit, surchargé par les champs connus. */
export function recetteDeLot(item, base = recetteExemple()) {
  const r = JSON.parse(JSON.stringify(base));
  if (item.visage) r.identite.visage = item.visage;
  if (item.morphologie) r.identite.morphologie = item.morphologie;
  if (item.stature !== undefined) r.identite.stature = item.stature;
  if (item.teint) r.identite.teint = item.teint;
  if (item.tenue) r.apparence.tenue = item.tenue;
  if (item.pose) r.apparence.pose = item.pose;
  if (item.chaussures) r.apparence.chaussures = { ...item.chaussures };
  // Tenue complète tirée par le générateur de lots (segments.js) : remplace la valise par une tenue unique « lot ».
  if (item.tenuePieces) { r.garderobe.valise = { lot: JSON.parse(JSON.stringify(item.tenuePieces)) }; r.apparence.tenue = 'lot'; }
  if (item.macros) r.identite.macros = { ...item.macros };
  if (item.corps) r.identite.corps = { ...item.corps };
  if (item.cheveux) r.identite.cheveux = { ...r.identite.cheveux, ...item.cheveux };
  return r;
}

/** Mesures d'un sprite rendu : boîte des pixels non transparents (px) et part d'opacité. */
export function mesurer(canvas) {
  const { width: w, height: h } = canvas;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, opaques = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 8) { opaques++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return opaques ? { boite: [x0, y0, x1 + 1, y1 + 1], opaques } : { boite: null, opaques: 0 };
}

/**
 * Rend un lot {segment, items:[{visage,…}]} et l'envoie à `envoyer(chemin, blob)`.
 * Refuse (erreur explicite, rien d'écrit pour l'élément) si la recette est invalide,
 * si le rendu est vide ou si le personnage touche un bord du cadre.
 */
export async function exporterLot(lot, { dessiner2D, envoyer, kit = KIT }) {
  const rapport = [];
  let i = 0;
  for (const item of lot.items) {
    const index = item.index ?? i;
    i++;
    const chemin = cheminSortie(lot.segment, index);
    const ligne = { chemin, visage: item.visage };
    rapport.push(ligne);
    if (!chemin) { ligne.erreur = 'nom de sortie hors contrat'; continue; }
    const recette = recetteDeLot(item);
    const v = validerRecette(recette, kit);
    if (v.avertissements?.length) ligne.avertissements = v.avertissements;
    if (!v.ok) { ligne.erreur = `recette invalide : ${[...v.erreurs, ...v.manquantes.map((m) => `pièce manquante ${m.piece}`)].join(' ; ')}`; continue; }
    const c = document.createElement('canvas');
    c.width = c.height = kit.rendu.taille;
    dessiner2D(c, recette, kit);
    const m = mesurer(c);
    Object.assign(ligne, m);
    if (!m.boite) { ligne.erreur = 'rendu vide'; continue; }
    const S = c.width;
    if (m.boite[0] <= 0 || m.boite[1] <= 0 || m.boite[2] >= S || m.boite[3] >= S) { ligne.erreur = 'le personnage touche le bord du cadre'; continue; }
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    try { await envoyer(chemin, blob); ligne.ok = true; } catch (e) { ligne.erreur = String(e.message ?? e); }
  }
  return rapport;
}
