import { KIT, recetteExemple, validerRecette, tenueResolue, corpsResolu, macrosAleatoires, catalogueVisages, plageAgeVisage, visageCompatible, visagePourAge, ageAccordeAuVisage } from './kit.js';
import { dessiner2D, preparerImages } from './rendu2d.js';
import { dessiner3D, preparerModeles } from './rendu3d.js';

const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
let recette = recetteExemple();

// ---------- Rendu ----------
function toile(taille = KIT.rendu.taille) {
  const c = document.createElement('canvas');
  c.width = c.height = taille;
  return c;
}
let azimut = 0; // degrés ; vue du rendu 3D seulement (pas dans la recette). Planche et contrôles restent de face.
function rendre(r, az = 0) {
  const c2 = toile(), c3 = toile();
  dessiner2D(c2, r);
  dessiner3D(c3, r, undefined, (az * Math.PI) / 180);
  return { c2, c3 };
}
function copieAffichee(src, px, classe = '') {
  const c = toile();
  c.getContext('2d').drawImage(src, 0, 0);
  c.style.width = c.style.height = `${(px * KIT.rendu.taille) / (KIT.rendu.cadre * KIT.rendu.hauteurAffichee / KIT.rendu.hauteurAffichee) / 1}px`;
  // 40 px = hauteur du PERSONNAGE à l'écran : le cadre contient ~1,95 m sur 2,2 m
  c.style.width = c.style.height = `${Math.round(px * (KIT.rendu.cadre / 1.95))}px`;
  c.className = classe;
  return c;
}
function lignePng(canvas, nom) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${nom}.png`;
  a.click();
}

function afficher() {
  const v = validerRecette(recette);
  if (v.ok && v.avertissements.length) $('msgLien').textContent = `⚠ ${v.avertissements.join(' ; ')}`;
  if (!v.ok) {
    $('msgJson').textContent = `Recette refusée : ${[...v.erreurs, ...v.manquantes.map((m) => `pièce manquante ${m.piece} (${m.ou})`)].join(' ; ')}`;
    return;
  }
  $('msgJson').textContent = '';
  apercu();
  $('json').value = JSON.stringify(recette, null, 2);
  planche();
}

function apercu() {
  const { c2, c3 } = rendre(recette, azimut);
  for (const [id, src] of [['c2d', c2], ['c3d', c3]]) {
    const cible = $(id);
    cible.getContext('2d').clearRect(0, 0, cible.width, cible.height);
    cible.getContext('2d').drawImage(src, 0, 0);
  }
  const reel = $('reel');
  reel.replaceChildren();
  for (const px of [40, 120]) for (const src of [c2, c3]) {
    const d = document.createElement('span');
    d.className = 'damier';
    d.append(copieAffichee(src, px));
    reel.append(d);
  }
}

function planche() {
  const tenues = Object.keys(recette.garderobe.valise);
  const cadre = $('planche');
  cadre.replaceChildren();
  cadre.style.setProperty('--nt', tenues.length);
  cadre.append(document.createElement('span'));
  for (const t of tenues) {
    const h = document.createElement('strong');
    h.textContent = t;
    cadre.append(h);
  }
  for (const morpho of Object.keys(KIT.morphologies)) {
    const l = document.createElement('strong');
    l.textContent = morpho;
    cadre.append(l);
    for (const t of tenues) {
      const r = clone(recette);
      r.identite.morphologie = morpho;
      r.apparence.tenue = t;
      const { c2, c3 } = rendre(r);
      const cell = document.createElement('div');
      cell.className = 'cell';
      for (const src of [c2, c3]) {
        const d = document.createElement('span');
        d.className = 'damier';
        d.append(copieAffichee(src, 88));
        cell.append(d);
      }
      cadre.append(cell);
    }
  }
}

// ---------- Contrôles automatiques ----------
function ligneBas(canvas) {
  const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  for (let y = height - 1; y >= 0; y--) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 20) return y;
  return -1;
}
function lignePremiere(canvas) {
  const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 20) return y;
  return -1;
}
function bboxOpaque(canvas) {
  const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}
function controle(ok, titre, detail) {
  const d = document.createElement('div');
  d.className = 'controle';
  d.innerHTML = `<strong class="${ok ? 'ok' : 'ko'}">${ok ? '✓' : '✗'}</strong><span>${titre} <span class="sous">${detail}</span></span>`;
  $('controles').append(d);
}
function controles() {
  $('controles').replaceChildren();
  // 1. Ancrage au sol : 3 morphologies × 2 statures extrêmes × 2 rendus
  const solAttendu = KIT.rendu.taille * KIT.rendu.sol;
  const bas = { '2D': [], '3D': [] };
  for (const morpho of Object.keys(KIT.morphologies)) for (const stature of [KIT.stature.min, KIT.stature.max]) {
    const r = clone(recette);
    r.identite.morphologie = morpho;
    r.identite.stature = stature;
    const { c2, c3 } = rendre(r);
    bas['2D'].push(ligneBas(c2));
    bas['3D'].push(ligneBas(c3));
  }
  for (const k of ['2D', '3D']) {
    const ecart = Math.max(...bas[k].map((y) => Math.abs(y - solAttendu)));
    controle(ecart <= 3, `Ancrage au sol ${k}`, `ligne basse ${Math.min(...bas[k])}–${Math.max(...bas[k])} px pour un sol à ${solAttendu.toFixed(0)} (écart max ${ecart.toFixed(1)}, tolérance 3)`);
  }
  // 1 bis. Visages en pièces / maillage : même ancrage, et tête 2D/3D alignée pour les visages image
  for (const nom of [...Object.keys(KIT.visagesImage), ...Object.keys(KIT.visagesMaillage)]) {
    const r = clone(recette);
    r.identite.visage = nom;
    const { c2, c3 } = rendre(r);
    const ecart = Math.max(Math.abs(ligneBas(c2) - solAttendu), Math.abs(ligneBas(c3) - solAttendu));
    let detail = `ancrage : écart max ${ecart.toFixed(1)} px (tolérance 3)`, ok = ecart <= 3;
    if (KIT.visagesImage[nom]) {
      const e = Math.abs(lignePremiere(c2) - lignePremiere(c3));
      ok = ok && e <= 3;
      detail += ` ; sommet de tête 2D/3D : écart ${e} px (tolérance 3)`;
    } else {
      const profil = rendre(r, 90).c3;
      const visible = lignePremiere(profil) >= 0;
      ok = ok && visible;
      detail += ` ; profil à 90° ${visible ? 'non vide' : 'VIDE'}`;
    }
    controle(ok, `Visage ${nom}`, detail);
  }
  // 1 ter. Tirage de 200 corps aléatoires : recette valide, rendu non vide, au sol, dans le cadre ; 3D sur 20 d'entre eux
  {
    const S = KIT.rendu.taille, pb = [];
    let invalides = 0, horsCadre = 0, ecartMax = 0, vides = 0, ecart3d = 0, ceux3d = 0;
    for (let graine = 1; graine <= 200; graine++) {
      const r = clone(recette);
      r.identite.macros = macrosAleatoires(graine, { age: 0.03 + 0.97 * ((graine * 37) % 100) / 100 }); // tous âges, enfant compris
      if (!validerRecette(r).ok) { invalides++; continue; }
      const c = toile();
      dessiner2D(c, r);
      const bb = bboxOpaque(c);
      if (!bb) { vides++; continue; }
      ecartMax = Math.max(ecartMax, Math.abs(bb[3] - 1 - solAttendu));
      if (bb[0] <= 0 || bb[2] >= S) horsCadre++;
      if (graine % 10 === 0) { const c3 = toile(); dessiner3D(c3, r); ecart3d = Math.max(ecart3d, Math.abs(ligneBas(c3) - solAttendu)); ceux3d++; }
    }
    controle(invalides + vides + horsCadre === 0 && ecartMax <= 3 && ecart3d <= 3, 'Tirage de 200 corps aléatoires (tous âges)', `${invalides} recette(s) invalide(s), ${vides} rendu(s) vide(s), ${horsCadre} hors cadre ; ancrage 2D écart max ${ecartMax.toFixed(1)} px, 3D (${ceux3d} corps) ${ecart3d.toFixed(1)} px (tolérance 3)`);
    void pb;
  }
  // 1 quater. Toutes les tenues × toutes les poses × enfant / adulte / senior (visage procédural) : valide, non vide, au sol, dans le cadre
  {
    const S = KIT.rendu.taille;
    let n = 0, invalides = 0, vides = 0, horsCadre = 0, ecartMax = 0;
    for (const tenue of Object.keys(recette.garderobe.valise)) for (const pose of Object.keys(KIT.poses)) for (const age of [0.02, 0.5, 1]) {
      const r = clone(recette);
      r.apparence.tenue = tenue; r.apparence.pose = pose; r.identite.macros = { age };
      n++;
      if (!validerRecette(r).ok) { invalides++; continue; }
      const c = toile();
      dessiner2D(c, r);
      const bb = bboxOpaque(c);
      if (!bb) { vides++; continue; }
      ecartMax = Math.max(ecartMax, Math.abs(bb[3] - 1 - solAttendu));
      if (bb[0] <= 0 || bb[2] >= S || bb[1] <= 0) horsCadre++;
    }
    controle(invalides + vides + horsCadre === 0 && ecartMax <= 3, 'Tenues × poses × âges (enfant, adulte, senior)', `${n} combinaisons : ${invalides} invalide(s), ${vides} vide(s), ${horsCadre} hors cadre ; ancrage 2D écart max ${ecartMax.toFixed(1)} px (tolérance 3)`);
  }
  // 1 quinquies. Visages ↔ âge : chaque âge a au moins un visage à plage ; visagePourAge renvoie un visage compatible ; avertissement de validation
  {
    const sansCouverture = [];
    let incoherent = 0;
    for (let a = 0; a <= 100; a += 5) {
      const age = a / 100;
      const pourAge = Object.keys(catalogueVisages(KIT)).filter((id) => plageAgeVisage(id, KIT) && visageCompatible(id, age, KIT));
      if (!pourAge.length) sansCouverture.push(age);
      if (!visageCompatible(visagePourAge(age, 'image.enfant@1', KIT), age, KIT)) incoherent++;
    }
    const t = clone(recette);
    t.identite.visage = 'image.enfant@1';
    t.identite.macros = { age: 0.9 };
    const w = validerRecette(t);
    const t2 = clone(t); t2.identite.macros = { age: 0.1 };
    const attendu = w.ok && w.avertissements.length === 1 && validerRecette(t2).avertissements.length === 0;
    controle(sansCouverture.length === 0 && incoherent === 0 && attendu, 'Visages ↔ âge', `couverture de 21 âges (0 à 1, pas 0,05) : ${sansCouverture.length ? 'trous aux âges ' + sansCouverture.join(', ') : 'complète'} ; ${incoherent} accord(s) incohérent(s) ; visage d'enfant à l'âge 0,9 : avertissement non bloquant ${attendu ? 'émis' : 'ABSENT'}`);
  }
  // 2. Reconstruction identique depuis la recette sérialisée
  const a = rendre(recette), b = rendre(JSON.parse(JSON.stringify(recette)));
  controle(a.c2.toDataURL() === b.c2.toDataURL() && a.c3.toDataURL() === b.c3.toDataURL(), 'Recette → image déterministe', '(2D et 3D, deux reconstructions identiques)');
  // 3. Masquage des sous-vêtements
  const avec = tenueResolue(recette).pieces.some((p) => p.piece === 'sous.slip@1');
  const sansBas = clone(recette);
  sansBas.garderobe.valise[sansBas.apparence.tenue] = sansBas.garderobe.valise[sansBas.apparence.tenue].filter((e) => !e.piece.startsWith('bas.'));
  const slipVisible = tenueResolue(sansBas).pieces.some((p) => p.piece === 'sous.slip@1');
  controle(!avec && slipVisible, 'Masquage', 'slip caché sous un short/pantalon, affiché si aucun bas n\'est porté');
  // 4. Validation de la recette
  const v = validerRecette(recette);
  controle(v.ok, 'Recette valide pour le kit', v.ok ? `${KIT.id}@${KIT.version}` : v.erreurs.join(' ; '));
}

// ---------- Interface ----------
function remplir(select, valeurs) {
  select.replaceChildren(...valeurs.map((v) => Object.assign(document.createElement('option'), { value: v, textContent: v })));
}
const tenueCourante = () => recette.garderobe.valise[recette.apparence.tenue];
const hautCourant = () => tenueCourante().find((e) => ['haut', 'manteau'].includes(KIT.pieces[e.piece]?.categorie) && KIT.pieces[e.piece].categorie === 'haut');

const ageExplicite = () => recette.identite.macros?.age;
/** Liste des visages, ⚠ devant ceux dont la plage d'âge exclut l'âge explicite de la recette. */
function remplirVisages() {
  const age = ageExplicite();
  const sel = $('visage');
  sel.replaceChildren(...Object.keys(catalogueVisages(KIT)).map((id) => {
    const p = plageAgeVisage(id, KIT);
    const ko = typeof age === 'number' && !visageCompatible(id, age, KIT);
    return Object.assign(document.createElement('option'), { value: id, textContent: `${ko ? '⚠ ' : ''}${id}${p ? ` (âge ${p[0]}–${p[1]})` : ''}` });
  }));
  sel.value = recette.identite.visage;
}
/** Accorde le visage à l'âge de la recette (sans toucher à l'âge). Renvoie un message si le visage a changé. */
function accorderVisageAAge() {
  const age = ageExplicite();
  if (typeof age !== 'number' || visageCompatible(recette.identite.visage, age, KIT)) return '';
  const avant = recette.identite.visage;
  recette.identite.visage = visagePourAge(age, avant, KIT);
  return `Visage changé : ${avant} → ${recette.identite.visage} (âge ${age.toFixed(2)}).`;
}
function synchroniser() {
  $('morpho').value = recette.identite.morphologie;
  $('stature').value = recette.identite.stature;
  remplirVisages();
  $('teint').value = recette.identite.teint;
  $('cheveux').value = recette.identite.cheveux.piece;
  $('cheveuxCouleur').value = recette.identite.cheveux.couleur;
  for (const [nom, [mn, mx]] of Object.entries(KIT.macrosBornes)) {
    const el = document.getElementById(`macro-${nom}`);
    const val = recette.identite.macros?.[nom] ?? (mn + mx) / 2;
    if (el) { el.value = val; el.nextElementSibling.textContent = (+val).toFixed(2); }
  }
  const cr = corpsResolu(recette);
  for (const [nom, val] of Object.entries(cr)) {
    const el = document.getElementById(`corps-${nom}`);
    if (el) { el.value = val; el.nextElementSibling.textContent = (+val).toFixed(2); }
  }
  $('tenue').value = recette.apparence.tenue;
  $('pose').value = recette.apparence.pose ?? 'repos';
  $('sousvet').checked = recette.apparence.sousVetements;
  const h = hautCourant();
  $('hautCorps').value = h?.couleurs.corps ?? '#ffffff';
  $('motif').value = h?.motif?.type ?? 'aucun';
  $('empl').value = h?.motif?.emplacement ?? 'poitrine_gauche';
  $('motifCouleur').value = h?.motif?.couleur ?? '#f2b01e';
}

function init() {
  remplir($('morpho'), Object.keys(KIT.morphologies));
  remplirVisages();
  remplir($('cheveux'), Object.keys(KIT.pieces).filter((p) => p.startsWith('cheveux.')));
  remplir($('tenue'), Object.keys(recette.garderobe.valise));
  remplir($('pose'), Object.keys(KIT.poses));
  remplir($('motif'), ['aucun', ...KIT.motifs]);
  remplir($('empl'), Object.keys(KIT.emplacements));
  Object.assign($('stature'), { min: KIT.stature.min, max: KIT.stature.max });

  const lier = (id, evt, fn) => $(id).addEventListener(evt, () => { fn($(id)); synchroniser(); afficher(); });
  lier('morpho', 'change', (e) => { recette.identite.morphologie = e.value; delete recette.identite.corps; delete recette.identite.macros; $('msgLien').textContent = ''; });
  // Macros : un curseur par macro (neutre = milieu de la plage : 0, ou 0,5 pour l'âge)
  const zoneMacros = $('macroCurseurs');
  for (const [nom, [mn, mx]] of Object.entries(KIT.macrosBornes)) {
    const ligne = document.createElement('label');
    ligne.append(`${nom} `);
    const r = Object.assign(document.createElement('input'), { type: 'range', id: `macro-${nom}`, min: mn, max: mx, step: 0.01 });
    const sortie = document.createElement('output');
    ligne.append(r, sortie);
    r.addEventListener('input', () => { (recette.identite.macros ??= {})[nom] = +r.value; $('msgLien').textContent = nom === 'age' ? accorderVisageAAge() : ''; synchroniser(); afficher(); });
    zoneMacros.append(ligne);
  }
  // Curseurs de corps : un par paramètre borné du kit
  const zone = $('corpsCurseurs');
  for (const [nom, [mn, mx]] of Object.entries(KIT.corpsBornes)) {
    const ligne = document.createElement('label');
    ligne.append(`${nom} `);
    const r = Object.assign(document.createElement('input'), { type: 'range', id: `corps-${nom}`, min: mn, max: mx, step: 0.01 });
    const sortie = document.createElement('output');
    ligne.append(r, sortie);
    r.addEventListener('input', () => { (recette.identite.corps ??= {})[nom] = +r.value; synchroniser(); afficher(); });
    zone.append(ligne);
  }
  $('corpsReset').onclick = () => { delete recette.identite.corps; delete recette.identite.macros; $('msgLien').textContent = ''; synchroniser(); afficher(); };
  $('corpsAlea').onclick = () => { delete recette.identite.corps; recette.identite.macros = macrosAleatoires((Math.random() * 2 ** 31) | 0); $('msgLien').textContent = accorderVisageAAge(); synchroniser(); afficher(); };
  lier('stature', 'input', (e) => (recette.identite.stature = +e.value));
  lier('visage', 'change', (e) => {
    recette.identite.visage = e.value;
    const age = ageExplicite() ?? 0.5;
    const accorde = ageAccordeAuVisage(e.value, age, KIT);
    $('msgLien').textContent = '';
    if (accorde !== age) {
      (recette.identite.macros ??= {}).age = Math.round(accorde * 100) / 100;
      $('msgLien').textContent = `Âge ramené à ${recette.identite.macros.age.toFixed(2)} pour ce visage (le corps passe aux macros).`;
    }
  });
  lier('teint', 'input', (e) => (recette.identite.teint = e.value));
  lier('cheveux', 'change', (e) => (recette.identite.cheveux.piece = e.value));
  lier('cheveuxCouleur', 'input', (e) => (recette.identite.cheveux.couleur = e.value));
  lier('tenue', 'change', (e) => (recette.apparence.tenue = e.value));
  lier('pose', 'change', (e) => { if (e.value === 'repos') delete recette.apparence.pose; else recette.apparence.pose = e.value; });
  lier('sousvet', 'change', (e) => (recette.apparence.sousVetements = e.checked));
  lier('hautCorps', 'input', (e) => { const h = hautCourant(); if (h) h.couleurs.corps = e.value; });
  const motif = (fn) => (e) => { const h = hautCourant(); if (!h) return; if ($('motif').value === 'aucun') delete h.motif; else { h.motif ??= { echelle: 1, couleur: $('motifCouleur').value, emplacement: $('empl').value }; fn(h.motif, e.value); } };
  lier('motif', 'change', motif((m, v) => (m.type = v)));
  lier('empl', 'change', motif((m, v) => (m.emplacement = v)));
  lier('motifCouleur', 'input', motif((m, v) => (m.couleur = v)));

  const regler = (deg) => { azimut = deg; $('azimut').value = deg; $('azimutVal').textContent = `${deg}°`; apercu(); };
  $('azimut').addEventListener('input', (e) => regler(+e.target.value));
  document.querySelectorAll('[data-az]').forEach((b) => b.addEventListener('click', () => regler(+b.dataset.az)));
  $('png2d').onclick = () => lignePng($('c2d'), 'personnage-2d');
  $('png3d').onclick = () => lignePng($('c3d'), 'personnage-3d');
  $('rejouer').onclick = controles;
  $('appliquer').onclick = () => {
    try {
      const r = JSON.parse($('json').value);
      const v = validerRecette(r);
      if (!v.ok) { $('msgJson').textContent = `Refusée : ${[...v.erreurs, ...v.manquantes.map((m) => `pièce manquante ${m.piece}`)].join(' ; ')}`; return; }
      recette = r; synchroniser(); afficher();
    } catch (e) { $('msgJson').textContent = `JSON invalide : ${e.message}`; }
  };
  $('manquante').onclick = () => {
    const pieces = { ...KIT.pieces };
    delete pieces['haut.tshirt@1'];
    const kitReduit = { ...KIT, pieces };
    const v = validerRecette(recette, kitReduit, pieces);
    $('msgManquante').textContent = v.ok
      ? 'Aucune pièce concernée.'
      : `Refus explicite (jamais de remplacement silencieux) : ${v.manquantes.map((m) => `${m.piece} manquante dans ${m.ou}`).join(' ; ')}. Le jeu choisit : garder la version figée ou remplacer par une pièce désignée.`;
  };
  synchroniser();
  afficher();
  controles();
}
await Promise.all([preparerImages(KIT), preparerModeles(KIT)]);
init();
