// Moteur de l'atelier de personnages : PUR (aucun DOM) pour être testé sous node.
// Données : public/atelier/base.json (catalogue de pièces, fabriqué par outils/fabriquer_atelier.mjs).
// Modèle : un état = { personne, tenue }. La PERSONNE (corps, visage, couleurs) ne change pas quand on change la TENUE.

export const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const GROUPES_SVG = { visage: ['tete', 'yeux', 'sourcils', 'nez', 'bouche', 'cheveux'], corps: ['torse', 'bras', 'jambes'], tenue: ['haut', 'bas', 'chaussures', 'chapeau', 'lunettes'] };
// les groupes de catégories viennent du catalogue (`base.groupes`) ; repli : la base SVG d'origine
export const groupes = (base) => base.groupes ?? GROUPES_SVG;
export const CATEGORIES_VISAGE = GROUPES_SVG.visage, CATEGORIES_CORPS = GROUPES_SVG.corps, CATEGORIES_TENUE = GROUPES_SVG.tenue;

// ---------- couleurs ----------
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const melanger = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
export const assombrir = (h, t) => melanger(h, '#1a0d10', t);
export function famille(prefixe, h) {
  return { [prefixe]: h, [prefixe + 'Ombre']: melanger(h, '#2b1020', 0.28), [prefixe + 'Clair']: melanger(h, '#ffffff', 0.28), [prefixe + 'Contour']: melanger(h, '#1a0d10', 0.62) };
}
// jetons de couleur d'un calque de la catégorie `cat`
export function jetons(etat, cat) {
  const p = etat.personne;
  const t = { ...famille('peau', p.peau), ...famille('cheveux', p.cheveux), ...famille('iris', p.iris), levres: p.levres, levresContour: assombrir(p.levres, 0.5), sourcil: assombrir(p.cheveux, 0.25) };
  const h = etat.tenue[cat];
  if (h) Object.assign(t, famille('c', h.couleur));
  return t;
}

// ---------- catalogue ----------
export const variante = (base, cat, id) => base.categories[cat].variantes.find((v) => v.id === id);
export const genreOk = (v, genre) => !v.genre || v.genre === '*' || genre === '*' || v.genre === genre;
function choisir(rng, liste, poids = () => 1) {
  const total = liste.reduce((n, x) => n + poids(x), 0);
  let r = rng() * total;
  for (const x of liste) { r -= poids(x); if (r <= 0) return x; }
  return liste.at(-1);
}
const eligibles = (base, cat, genre, styleOk = () => true) => base.categories[cat].variantes.filter((v) => genreOk(v, genre) && styleOk(v));

// ---------- calques à empiler ----------
// Renvoie [{ z, fichier, cat }] dans l'ordre d'empilement (arrière → avant), pièces masquées exclues.
export function calques(base, etat) {
  const masquees = new Set();
  const liste = [];
  const parts = { ...etat.personne.parts, ...Object.fromEntries(groupes(base).tenue.map((c) => [c, etat.tenue[c]?.id])) };
  for (const cat of Object.keys(base.categories)) {
    const v = variante(base, cat, parts[cat]);
    if (!v) continue;
    (v.masque ?? []).forEach((m) => masquees.add(m));
  }
  for (const cat of Object.keys(base.categories)) {
    if (masquees.has(cat)) continue;
    const v = variante(base, cat, parts[cat]);
    if (!v) continue;
    for (const c of v.calques) liste.push({ z: c.z, cat, id: v.id, fichier: c.fichier.replace('{sil}', v.suit ? parts[v.suit] : '') });
  }
  return liste.sort((a, b) => base.ordre.indexOf(a.z) - base.ordre.indexOf(b.z));
}

// ---------- tirages ----------
const PAILLE = '#e4c882';
const couleurPour = (rng, base, id, evite) => {
  if (id === 'paille') return PAILLE;
  let c; let n = 0;
  do { c = choisir(rng, base.palettes.vetements); } while (c === evite && ++n < 8);
  return c;
};
export function etatInitial(base) {
  const prem = (c) => base.categories[c].variantes[0].id;
  return {
    personne: { genre: 'f', peau: base.palettes.peau[2], cheveux: base.palettes.cheveux[1][1], iris: base.palettes.iris[0][1], levres: base.palettes.levres[0], parts: Object.fromEntries([...groupes(base).visage, ...groupes(base).corps].map((c) => [c, prem(c)])) },
    tenue: Object.fromEntries(groupes(base).tenue.map((c) => [c, { id: base.categories[c].variantes[0].id, couleur: base.palettes.vetements[0] }])),
  };
}
const POIDS_CHEVEUX = [3, 3, 3, 2, 1, 1, 1, 0.5, 0.3, 0.3];

// orient = { genre:'*'|'f'|'h', gabarit:null|'mince'|'moyen'|'rond'|'muscle', peau:null|hex, cheveux:null|hex, style:'*'|'plage'|… }
// verrous = { <catégorie>: true } : une pièce verrouillée n'est jamais retirée.
export function tirerCorps(base, rng, etat, orient = {}, verrous = {}) {
  const p = etat.personne;
  if (!groupes(base).corps.some((c) => verrous[c])) {
    let cand = base.silhouettes.filter((s) => genreOk(s, p.genre));
    const g = cand.filter((s) => !orient.gabarit || s.gabarit === orient.gabarit);
    if (g.length) cand = g;
    const s = choisir(rng, cand);
    groupes(base).corps.forEach((c) => { p.parts[c] = s.id; });
  }
  p.peau = orient.peau ?? choisir(rng, base.palettes.peau);
}
export function tirerVisage(base, rng, etat, orient = {}, verrous = {}) {
  const p = etat.personne;
  for (const c of groupes(base).visage) if (!verrous[c]) p.parts[c] = choisir(rng, eligibles(base, c, p.genre), (v) => v.poids ?? 1).id;
  const ch = base.palettes.cheveux;
  p.cheveux = orient.cheveux ?? ch[ch.indexOf(choisir(rng, ch, (x) => POIDS_CHEVEUX[ch.indexOf(x)] ?? 1))][1];
  p.iris = choisir(rng, base.palettes.iris)[1];
  p.levres = choisir(rng, base.palettes.levres);
}
export function tirerPersonne(base, rng, etat, orient = {}, verrous = {}) {
  etat.personne.genre = orient.genre && orient.genre !== '*' ? orient.genre : (rng() < 0.5 ? 'f' : 'h');
  tirerCorps(base, rng, etat, orient, verrous);
  tirerVisage(base, rng, etat, orient, verrous);
}
export function tirerTenue(base, rng, etat, orient = {}, verrous = {}) {
  const g = etat.personne.genre, style = orient.style ?? '*';
  const styleOk = (v) => style === '*' || !v.styles || v.styles.includes(style);
  let precedente;
  for (const c of groupes(base).tenue) {
    if (verrous[c]) continue;
    let cand = eligibles(base, c, g, styleOk);
    if (c === 'chapeau' || c === 'lunettes') {
      const rien = base.categories[c].variantes[0];
      const pAucun = style === 'plage' ? 0.45 : 0.75;
      cand = rng() < pAucun ? [rien] : cand.filter((v) => v.id !== rien.id);
      if (!cand.length) cand = [rien];
    }
    if (!cand.length) cand = eligibles(base, c, g);
    const v = choisir(rng, cand);
    const couleur = couleurPour(rng, base, v.id, precedente);
    etat.tenue[c] = { id: v.id, couleur };
    if (c === 'haut' || c === 'bas') precedente = couleur;
  }
}
export const copie = (x) => JSON.parse(JSON.stringify(x));
