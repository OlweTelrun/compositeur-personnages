// Rendu de l'atelier « pièces PNG » : les calques viennent de planches du générateur d'images, découpées (outils/decouper_planches.py).
// Les pièces n'ont pas de repères communs : leur place est CALCULÉE ici d'après les mesures de pieces.json
// (largeur du corps à chaque hauteur, taille du visage). Les constantes de CFG se règlent à l'œil.
import { calques } from './atelier-moteur.js';

export const CFG = {
  W: 520, H: 900, PIEDS: 868, CORPS_H: 690,
  tete: { echelle: 0.6, recouvre: 0.09 },          // échelle de la tête relativement au corps ; recouvrement du cou (fraction de la hauteur du corps)
  yeux: { l: 0.5, y: 0.47 }, sourcils: { l: 0.52, y: 0.34 }, nez: { l: 0.26, h: 0.2, y: 0.70 }, bouche: { l: 0.3, y: 0.84 },
  cheveux: { echelle: 1.0, haut: -0.12 },
  haut: { y: 0.035, l: 1.38, sans_manches: 0.95, bas: 0.43 }, bas: { y: 0.385, l: 1.3, fin: 0.965 },
  chaussures: { l: 1.0 }, chapeau: { l: 1.12, large: 1.55, bas: 0.34 }, lunettes: { l: 0.86 },
};
const SANS_MANCHES = new Set(['debardeur', 'bikini', 'robe']);
const LARGES = new Set(['paille', 'capeline']);
const NATURELS = new Set(['paille']);          // pièces gardées dans leurs couleurs d'origine
const TEINTE_TOUT = new Set(['cheveux', 'haut', 'bas', 'chaussures', 'chapeau']);

const imgs = new Map(), teintes = new Map();
const charger = (url) => { if (!imgs.has(url)) imgs.set(url, new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error(url)); i.src = url; })); return imgs.get(url); };
const rvb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// re-teinte une pièce : luminance du pixel relative à la luminance moyenne de la pièce × couleur cible. mode 'peau' : seuls les pixels saturés
function teinter(img, couleur, lumRef, mode, cle) {
  const k = cle + couleur + mode;
  if (teintes.has(k)) return teintes.get(k);
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, [tr, tg, tb] = rvb(couleur);
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const mx = Math.max(p[i], p[i + 1], p[i + 2]), mn = Math.min(p[i], p[i + 1], p[i + 2]);
    if (mode === 'peau' && (mx - mn) / Math.max(mx, 1) < 0.15) continue;      // vêtement gris du corps de base : on n'y touche pas
    const L = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2], f = Math.pow(L / lumRef, 0.9);
    p[i] = Math.min(255, tr * f); p[i + 1] = Math.min(255, tg * f); p[i + 2] = Math.min(255, tb * f);
  }
  x.putImageData(d, 0, 0); teintes.set(k, c); return c;
}
const mesures = new Map();
const lireMesures = (dossier) => { if (!mesures.has(dossier)) mesures.set(dossier, fetch(`${dossier}/pieces.json`).then((r) => r.json())); return mesures.get(dossier); };

export const DOSSIER = 'atelier2';
export async function dessinerPng(ctx, base, etat, largeur) {
  const meta = await lireMesures(DOSSIER);
  const ech = largeur / CFG.W;
  const liste = calques(base, etat);
  const parCat = Object.fromEntries(liste.map((l) => [l.cat, l]));
  const sources = {};
  await Promise.all(liste.map(async (l) => { sources[l.cat] = await charger(`${DOSSIER}/${l.fichier}`); }));

  // --- corps : même hauteur pour toutes les silhouettes, cou centré ---
  const mc = meta.corps[etat.personne.parts.corps], sb = CFG.CORPS_H / mc.h;
  const cxCou = (mc.cx[0] + mc.cx[1] + mc.cx[2]) / 3;
  const x0 = CFG.W / 2 - cxCou * sb, y0 = CFG.PIEDS - CFG.CORPS_H;
  const ligne = (f) => Math.max(0, Math.min(49, Math.round(f * 50 - 0.5)));
  const Y = (f) => y0 + f * CFG.CORPS_H, Lg = (f) => mc.larg[ligne(f)] * sb, Cx = (f) => x0 + mc.cx[ligne(f)] * sb;
  // --- tête ---
  const mt = meta.tete[etat.personne.parts.tete], hMoy = Object.values(meta.corps).reduce((n, c) => n + c.h, 0) / Object.keys(meta.corps).length, sh = (CFG.CORPS_H / hMoy) * CFG.tete.echelle;
  const tl = mt.w * sh, th = mt.h * sh, hf = mt.hface * sh, wH = mt.wmax * sh;
  const tx = Cx(0.0) - mt.cx_tete * sh, ty = Y(CFG.tete.recouvre) - th;
  const cxT = tx + mt.cx_tete * sh;                         // axe du visage
  const yT = (f) => ty + f * hf;                            // f = fraction de la hauteur du visage (haut du crâne → menton)

  const poser = (src, cx, yHaut, l) => { const h = src.height * (l / src.width); ctx.drawImage(src, (cx - l / 2) * ech, yHaut * ech, l * ech, h * ech); return h; };
  ctx.clearRect(0, 0, largeur, CFG.H * ech);
  const peau = etat.personne.peau;
  for (const cat of base.ordre) {
    const l = parCat[cat]; if (!l) continue;
    const id = l.id, m = meta[cat]?.[id]; let src = sources[cat];
    if (cat === 'corps') { src = teinter(src, peau, m.lum_peau, 'peau', `corps/${id}`); ctx.drawImage(src, x0 * ech, y0 * ech, mc.w * sb * ech, CFG.CORPS_H * ech); }
    else if (cat === 'tete') { src = teinter(src, peau, m.lum_peau, 'peau', `tete/${id}`); ctx.drawImage(src, tx * ech, ty * ech, tl * ech, th * ech); }
    else if (cat === 'nez') { src = teinter(src, peau, 175, 'tout', `nez/${id}`); const lw = Math.min(wH * CFG.nez.l, (hf * CFG.nez.h) * (m.w / m.h)); poser(src, cxT, yT(CFG.nez.y) - (m.h / m.w) * lw / 2, lw); }
    else if (cat === 'yeux' || cat === 'sourcils' || cat === 'bouche') { const c = CFG[cat]; const lw = wH * c.l, h = (m.h / m.w) * lw; poser(src, cxT, yT(c.y) - h / 2, lw); }
    else if (cat === 'cheveux') { src = teinter(src, etat.personne.cheveux, m.lum, 'tout', `cheveux/${id}`); const s = sh * CFG.cheveux.echelle; poser(src, cxT, ty + CFG.cheveux.haut * hf, m.w * s); }
    else if (cat === 'haut') { const k = SANS_MANCHES.has(id) ? CFG.haut.sans_manches : CFG.haut.l; src = teinter(src, etat.tenue.haut.couleur, m.lum, 'tout', `haut/${id}`); const lw = Lg(0.17) * k, h0 = src.height * (lw / src.width), cible = Y(CFG.haut.bas) - Y(CFG.haut.y);
      const etire = (id === 'bikini' || id === 'robe') ? 1 : Math.min(1.3, Math.max(1, cible / h0));
      ctx.drawImage(src, (Cx(0.17) - lw / 2) * ech, Y(CFG.haut.y) * ech, lw * ech, h0 * etire * ech); }
    else if (cat === 'bas') { src = teinter(src, etat.tenue.bas.couleur, m.lum, 'tout', `bas/${id}`); let lw = Lg(0.5) * CFG.bas.l; const hMax = Y(CFG.bas.fin) - Y(CFG.bas.y), h0 = src.height * (lw / src.width); if (h0 > hMax) lw *= hMax / h0; poser(src, Cx(0.5), Y(CFG.bas.y), lw); }
    else if (cat === 'chaussures') { src = teinter(src, etat.tenue.chaussures.couleur, m.lum, 'tout', `chaussures/${id}`); const lw = Lg(0.985) * CFG.chaussures.l; const h = (m.h / m.w) * lw; poser(src, Cx(0.985), CFG.PIEDS + 6 - h, lw); }
    else if (cat === 'chapeau') { if (!NATURELS.has(id)) src = teinter(src, etat.tenue.chapeau.couleur, m.lum, 'tout', `chapeau/${id}`); const lw = wH * (LARGES.has(id) ? CFG.chapeau.large : CFG.chapeau.l); const h = (m.h / m.w) * lw; poser(src, cxT, yT(CFG.chapeau.bas) - h, lw); }
    else if (cat === 'lunettes') { const lw = wH * CFG.lunettes.l; const h = (m.h / m.w) * lw; poser(src, cxT, yT(CFG.yeux.y) - h / 2, lw); }
  }
}
