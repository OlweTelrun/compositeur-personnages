// Atelier de personnages : interface + rendu canvas des calques SVG de public/atelier/.
import { mulberry32, etatInitial, tirerPersonne, tirerCorps, tirerVisage, tirerTenue, calques, jetons, variante, copie, groupes } from './atelier-moteur.js';
import { dessinerPng } from './rendu-png.js';

const $ = (id) => document.getElementById(id);
// pièces PNG au style du jeu par défaut ; ?mode=svg = anciennes pièces dessinées par code
const MODE = new URLSearchParams(location.search).get('mode') === 'svg' ? 'svg' : 'png';
const base = await (await fetch(MODE === 'png' ? 'atelier2/base.json' : 'atelier/base.json')).json();
const G = groupes(base);
const CATEGORIES_TENUE = G.tenue, CATEGORIES_VISAGE = G.visage, CATEGORIES_CORPS = G.corps;
const [LARG, HAUT] = base.toile;
const RATIO = HAUT / LARG;
const vue = $('vue'); vue.width = 800; vue.height = Math.round(800 * RATIO); vue.style.aspectRatio = `${LARG} / ${HAUT}`;

// ---------- état (conservé dans le navigateur, sans incidence si indisponible) ----------
const CLE = `atelier-personnages/${MODE}/1`;
let etat = etatInitial(base);
let orient = { genre: '*', gabarit: null, peau: null, cheveux: null, style: '*' };
let verrous = {};
let planche = [];
try {
  const s = JSON.parse(localStorage.getItem(CLE) ?? 'null');
  if (s?.etat && s.etat.personne?.parts && Object.keys(s.etat.personne.parts).every((k) => base.categories[k])) { etat = s.etat; orient = { ...orient, ...s.orient }; verrous = s.verrous ?? {}; planche = s.planche ?? []; }
  else if (s) throw 0;
} catch { etat = etatInitial(base); }
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify({ etat, orient, verrous, planche })); } catch { /* stockage indisponible */ } };
const graine = () => (Math.random() * 2 ** 32) >>> 0;
const rng = () => mulberry32(graine());

// ---------- rendu ----------
const textes = new Map(), images = new Map(), jetonsDe = new Map();
const svgTexte = (f) => { if (!textes.has(f)) textes.set(f, fetch(`atelier/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.text(); })); return textes.get(f); };
async function imageCalque(c, t) {
  const txt = await svgTexte(c.fichier);
  if (!jetonsDe.has(c.fichier)) jetonsDe.set(c.fichier, [...new Set([...txt.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))]);
  const utiles = jetonsDe.get(c.fichier);
  const cle = c.fichier + '|' + utiles.map((k) => t[k]).join(',');
  if (!images.has(cle)) {
    images.set(cle, new Promise((ok, ko) => {
      const im = new Image();
      im.onload = () => ok(im); im.onerror = () => ko(new Error(c.fichier));
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(txt.replace(/\{\{(\w+)\}\}/g, (_, k) => t[k] ?? '#ff00ff'));
    }));
  }
  return images.get(cle);
}
async function dessiner(ctx, e, largeur) {
  if (base.mode === 'png') return dessinerPng(ctx, base, e, largeur);
  const ech = largeur / LARG;
  const liste = calques(base, e);
  const ims = await Promise.all(liste.map((c) => imageCalque(c, jetons(e, c.cat))));
  ctx.clearRect(0, 0, largeur, HAUT * ech);
  ims.forEach((im) => ctx.drawImage(im, 0, 0, LARG * ech, HAUT * ech));
}
let jeton = 0;
async function rendreVue() {
  const mon = ++jeton;
  const tmp = document.createElement('canvas'); tmp.width = 800; tmp.height = vue.height;
  try { await dessiner(tmp.getContext('2d'), etat, 800); } catch (err) { $('etat').textContent = `Pièce illisible : ${err.message}`; return; }
  if (mon !== jeton) return;
  const ctx = $('vue').getContext('2d'); ctx.clearRect(0, 0, 800, vue.height); ctx.drawImage(tmp, 0, 0);
}

// ---------- interface : orientation ----------
function segment(id, options, valeur, choisir) {
  const el = $(id); el.textContent = '';
  for (const [v, nom] of options) {
    const b = document.createElement('button'); b.textContent = nom; b.setAttribute('aria-pressed', String(valeur() === v));
    b.onclick = () => { choisir(v); el.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(options[i][0] === valeur()))); };
    el.append(b);
  }
}
function pastilles(id, couleurs, valeur, choisir) {
  const el = $(id); el.textContent = '';
  const tout = [[null, 'Au hasard'], ...couleurs];
  tout.forEach(([c, nom]) => {
    const b = document.createElement('button'); b.className = 'pastille' + (c ? '' : ' hasard');
    if (c) b.style.background = c; b.title = nom; b.setAttribute('aria-label', nom); b.setAttribute('aria-pressed', String(valeur() === c));
    b.onclick = () => { choisir(c); el.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(tout[i][0] === valeur()))); };
    el.append(b);
  });
}
function monterOrientation() {
  segment('o-genre', [['*', 'Peu importe'], ['f', 'Féminin'], ['h', 'Masculin']], () => orient.genre, (v) => { orient.genre = v; action('personne'); });
  segment('o-gabarit', [[null, 'Peu importe'], ['mince', 'Mince'], ['moyen', 'Moyenne'], ['rond', 'Ronde'], ['muscle', 'Athlétique']], () => orient.gabarit, (v) => { orient.gabarit = v; action('corps'); });
  pastilles('o-peau', base.palettes.peau.map((c, i) => [c, `Peau ${i + 1}`]), () => orient.peau, (c) => { orient.peau = c; if (c) etat.personne.peau = c; majTout(false); });
  pastilles('o-cheveux', base.palettes.cheveux.map(([n, c]) => [c, n]), () => orient.cheveux, (c) => { orient.cheveux = c; if (c) etat.personne.cheveux = c; majTout(false); });
  segment('o-style', [['*', 'Tous'], ['plage', 'Plage'], ['quotidien', 'Ville'], ['sport', 'Sport'], ['chic', 'Chic']], () => orient.style, (v) => { orient.style = v; action('tenue'); });
}

// ---------- interface : pièces ----------
function monterPieces() {
  const zone = $('pieces'); zone.textContent = '';
  const groupes = [['visage', 'Visage et cheveux', CATEGORIES_VISAGE], ['corps', 'Corps', CATEGORIES_CORPS], ['tenue', 'Tenue', CATEGORIES_TENUE]];
  for (const [, titre, cats] of groupes) {
    const h = document.createElement('p'); h.className = 'titre-groupe'; h.textContent = titre; zone.append(h);
    for (const cat of cats) zone.append(ligne(cat));
  }
}
const valeurCat = (cat) => CATEGORIES_TENUE.includes(cat) ? etat.tenue[cat].id : etat.personne.parts[cat];
function fixer(cat, id) {
  if (CATEGORIES_TENUE.includes(cat)) etat.tenue[cat].id = id;
  else if (CATEGORIES_CORPS.includes(cat)) etat.personne.parts[cat] = id; // une pièce de corps seule : on peut panacher
  else etat.personne.parts[cat] = id;
}
function ligne(cat) {
  const c = base.categories[cat], d = document.createElement('div'); d.className = 'piece'; d.dataset.cat = cat;
  const nom = document.createElement('span'); nom.className = 'nom'; nom.textContent = c.nom;
  const pas = (delta) => { const vs = c.variantes, i = vs.findIndex((v) => v.id === valeurCat(cat)); fixer(cat, vs[(i + delta + vs.length) % vs.length].id); majTout(); };
  const moins = Object.assign(document.createElement('button'), { textContent: '◀', title: 'Précédent', onclick: () => pas(-1) });
  const plus = Object.assign(document.createElement('button'), { textContent: '▶', title: 'Suivant', onclick: () => pas(1) });
  const sel = document.createElement('select'); sel.setAttribute('aria-label', c.nom);
  for (const v of c.variantes) sel.add(new Option(v.nom, v.id));
  sel.onchange = () => { fixer(cat, sel.value); majTout(); };
  const lock = Object.assign(document.createElement('button'), { className: 'verrou', textContent: '🔒', title: 'Garder cette pièce quand on tire au hasard', onclick: () => { verrous[cat] = !verrous[cat]; lock.setAttribute('aria-pressed', String(!!verrous[cat])); sauver(); } });
  lock.setAttribute('aria-pressed', String(!!verrous[cat]));
  d.append(nom, moins, sel, plus, lock);
  if (CATEGORIES_TENUE.includes(cat)) {
    const col = document.createElement('input'); col.type = 'color'; col.title = 'Couleur'; col.setAttribute('aria-label', `Couleur : ${c.nom}`);
    col.oninput = () => { etat.tenue[cat].couleur = col.value; rendreVue(); rendrePlanche(); sauver(); };
    d.append(col);
  } else d.append(Object.assign(document.createElement('span'), { className: 'vide' }));
  return d;
}
function majPieces() {
  document.querySelectorAll('.piece').forEach((d) => {
    const cat = d.dataset.cat, sel = d.querySelector('select'); sel.value = valeurCat(cat);
    const col = d.querySelector('input[type=color]'); if (col) col.value = etat.tenue[cat].couleur;
    const v = variante(base, cat, valeurCat(cat)); if (col) col.disabled = !v.calques.length;
  });
}

// ---------- planche de tenues ----------
const tenueEnCours = () => copie(etat.tenue);
async function rendrePlanche() {
  const zone = $('planche'); const mon = ++jetonPlanche;
  const vignettes = await Promise.all(planche.map(async (tenue, i) => {
    const cv = document.createElement('canvas'); cv.width = 168; cv.height = Math.round(168 * RATIO);
    await dessiner(cv.getContext('2d'), { personne: etat.personne, tenue }, 168);
    return [cv, tenue, i];
  }));
  if (mon !== jetonPlanche) return;
  zone.textContent = '';
  if (!planche.length) zone.append(Object.assign(document.createElement('span'), { className: 'vide-planche', textContent: 'Aucune tenue gardée. Les vignettes montrent TOUJOURS la personne affichée.' }));
  for (const [cv, tenue, i] of vignettes) {
    const b = document.createElement('div'); b.className = 'vignette'; b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-label', `Habiller avec la tenue ${i + 1}`);
    b.setAttribute('aria-current', String(JSON.stringify(tenue) === JSON.stringify(etat.tenue)));
    const x = Object.assign(document.createElement('button'), { className: 'retrait', textContent: '×', title: 'Retirer', onclick: (ev) => { ev.stopPropagation(); planche.splice(i, 1); sauver(); rendrePlanche(); } });
    const porter = () => { etat.tenue = copie(tenue); majTout(); };
    b.onclick = porter; b.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); porter(); } };
    b.append(cv, x); zone.append(b);
  }
}
let jetonPlanche = 0;

// ---------- actions ----------
function majTout(rendre = true) {
  majPieces(); sauver();
  if (rendre) { rendreVue(); rendrePlanche(); }
  const p = etat.personne;
  $('etat').textContent = `${p.genre === 'f' ? 'Femme' : 'Homme'} · ${base.silhouettes.find((s) => s.id === p.parts[CATEGORIES_CORPS[0]])?.nom ?? ''} · ${CATEGORIES_TENUE.map((c) => variante(base, c, etat.tenue[c].id).nom).filter((n) => !/^(Aucun|Aucune)$/.test(n)).join(', ')}`;
}
function action(type) {
  const r = rng();
  if (type === 'personne') { tirerPersonne(base, r, etat, orient, verrous); tirerTenue(base, r, etat, orient, verrous); }
  if (type === 'visage') tirerVisage(base, r, etat, orient, verrous);
  if (type === 'corps') tirerCorps(base, r, etat, orient, verrous);
  if (type === 'tenue') tirerTenue(base, r, etat, orient, verrous);
  if (type === 'personne' || type === 'visage') { /* la couleur de cheveux orientée reste sélectionnée */ }
  majTout();
}
$('b-personne').onclick = () => action('personne');
$('b-tenue').onclick = () => action('tenue');
$('b-visage').onclick = () => action('visage');
$('b-corps').onclick = () => action('corps');
$('p-garder').onclick = () => { planche.push(tenueEnCours()); sauver(); rendrePlanche(); };
$('p-six').onclick = () => {
  const sauve = copie(etat.tenue), r = rng();
  for (let i = 0; i < 6; i++) { tirerTenue(base, r, etat, orient, verrous); planche.push(tenueEnCours()); }
  etat.tenue = sauve; sauver(); rendrePlanche();
};
$('p-vider').onclick = () => { planche = []; sauver(); rendrePlanche(); };
$('b-json').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(etat)); $('etat').textContent = 'Recette copiée.'; } catch { $('etat').textContent = 'Copie impossible ici.'; } };

// ---------- exports ----------
const telecharger = (cv, nom) => cv.toBlob((b) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: nom }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
$('b-png').onclick = async () => {
  // cadrage du jeu : personnage haut de 225 px, pieds à 247 px, centré, sur 256×256 transparent
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = vue.height;
  await dessiner(cv.getContext('2d'), etat, 800);
  const { data, width, height } = cv.getContext('2d').getImageData(0, 0, 800, vue.height);
  let x0 = width, x1 = 0, y0 = height, y1 = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const h = y1 - y0 + 1, l = x1 - x0 + 1, ech = Math.min(225 / h, 250 / l);
  const sortie = document.createElement('canvas'); sortie.width = 256; sortie.height = 256;
  sortie.getContext('2d').drawImage(cv, x0, y0, l, h, 128 - (l * ech) / 2, 247 - h * ech, l * ech, h * ech);
  telecharger(sortie, 'personnage.png');
};
$('p-png').onclick = async () => {
  if (!planche.length) { $('etat').textContent = 'La planche est vide.'; return; }
  const l = 250, h = Math.round(250 * RATIO), cv = document.createElement('canvas'); cv.width = l * planche.length; cv.height = h;
  for (let i = 0; i < planche.length; i++) {
    const t = document.createElement('canvas'); t.width = l; t.height = h;
    await dessiner(t.getContext('2d'), { personne: etat.personne, tenue: planche[i] }, l);
    cv.getContext('2d').drawImage(t, i * l, 0);
  }
  telecharger(cv, 'planche-tenues.png');
};

// ---------- démarrage ----------
monterOrientation(); monterPieces();
let dejaVu = false; try { dejaVu = !!localStorage.getItem(CLE); } catch { /* stockage indisponible */ }
if (!dejaVu) action('personne'); else majTout();
