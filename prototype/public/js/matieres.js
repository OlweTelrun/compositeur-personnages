// Matières : images chargées d'avance (chargerMatieres), puis utilisées par le rendu 2D (motif de canvas) et 3D (textures).
// Une matière `teintable` est un albedo gris clair multiplié par la couleur de la pièce ; sinon le motif est gardé tel quel.
import { KIT } from './kit.js';

const images = new Map();
export function chargerMatieres(kit = KIT) {
  const srcs = new Set(Object.values(kit.matieres ?? {}).flatMap((m) => [m.src, m.normale]).filter(Boolean));
  return Promise.all([...srcs].map((src) => images.has(src) ? null : new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => { images.set(src, i); ok(); };
    i.onerror = () => ko(new Error(`matière introuvable : ${src}`));
    i.src = src;
  })));
}
export const imageMatiere = (src) => {
  const i = images.get(src);
  if (!i) throw new Error(`matière non chargée (appeler chargerMatieres avant le rendu) : ${src}`);
  return i;
};

// Tuile teintée mise en cache (le rendu d'animation redessine à chaque image).
const tuiles = new Map();
function tuile(def, couleur) {
  const cle = `${def.src}|${def.teintable ? couleur : ''}`;
  let c = tuiles.get(cle);
  if (!c) {
    const img = imageMatiere(def.src);
    c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    if (def.teintable) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = couleur; ctx.fillRect(0, 0, c.width, c.height); }
    tuiles.set(cle, c);
  }
  return c;
}

/** Remplissage 2D (utilisable comme fillStyle / strokeStyle) : motif répété, ancré en (ox, oy) px, une tuile = `def.tuile` mètres = `def.tuile * pxParMetre` px. */
export function motifMatiere(ctx, def, couleur, pxParMetre, ox = 0, oy = 0) {
  const t = tuile(def, couleur);
  const p = ctx.createPattern(t, 'repeat');
  p.setTransform(new DOMMatrix().translate(ox, oy).scale((def.tuile * pxParMetre) / t.width)); // (ox, oy) : origine du motif = pied du personnage
  return p;
}
