import test from 'node:test';
import assert from 'node:assert/strict';
import { KIT, catalogueVisages, plageAgeVisage, visageCompatible, visagesCompatibles, visagePourAge, ageAccordeAuVisage, corpsDepuisMacros, macrosAleatoires, corpsResolu, segmentsJambe, demiLargeur, recetteExemple, validerRecette, tenueResolue, geometrie, pointEmplacement, placementsVisage, teinter, hexVersRgb } from '../public/js/kit.js';

test('la recette d\'exemple est valide', () => {
  assert.equal(validerRecette(recetteExemple()).ok, true);
});

test('une pièce absente du catalogue est refusée explicitement', () => {
  const pieces = { ...KIT.pieces };
  delete pieces['haut.tshirt@1'];
  const v = validerRecette(recetteExemple(), { ...KIT, pieces }, pieces);
  assert.equal(v.ok, false);
  assert.ok(v.manquantes.some((m) => m.piece === 'haut.tshirt@1' && m.ou === 'valise.plage'));
});

test('stature, morphologie et emplacement hors contrat sont rejetés', () => {
  const r = recetteExemple();
  r.identite.stature = 2;
  r.identite.morphologie = 'geante';
  r.garderobe.valise.plage[0].motif.emplacement = 'dos';
  const v = validerRecette(r);
  assert.equal(v.erreurs.length, 3);
});

test('le slip n\'apparaît que si aucun bas ne couvre les hanches', () => {
  const r = recetteExemple();
  assert.ok(!tenueResolue(r).pieces.some((p) => p.piece === 'sous.slip@1'));
  r.garderobe.valise.plage = r.garderobe.valise.plage.filter((e) => !e.piece.startsWith('bas.'));
  assert.ok(tenueResolue(r).pieces.some((p) => p.piece === 'sous.slip@1'));
});

test('les couches sont triées : manteau au-dessus du gilet au-dessus de la chemise', () => {
  const r = recetteExemple();
  r.apparence.tenue = 'historique';
  const ordre = tenueResolue(r).pieces.map((p) => p.def.categorie);
  assert.ok(ordre.indexOf('haut') < ordre.indexOf('gilet') && ordre.indexOf('gilet') < ordre.indexOf('manteau'));
});

test('la géométrie est déterministe et la taille suit la stature', () => {
  const r = recetteExemple();
  assert.deepEqual(geometrie(r), geometrie(structuredClone(r)));
  const grand = structuredClone(r); grand.identite.stature = 1.08;
  assert.ok(geometrie(grand).H > geometrie(r).H);
});

test('un emplacement nommé suit la morphologie (plus large sur la ronde que sur la fine)', () => {
  const fine = recetteExemple(); fine.identite.morphologie = 'fine';
  const ronde = recetteExemple(); ronde.identite.morphologie = 'ronde';
  const pf = pointEmplacement(geometrie(fine), 'ventre');
  assert.equal(pf.x, 0);
  const a = pointEmplacement(geometrie(fine), 'poitrine_gauche');
  const b = pointEmplacement(geometrie(ronde), 'poitrine_gauche');
  assert.ok(Math.abs(a.x) > 0 && Math.abs(b.x) > 0);
});

test('visage image : accepté par la validation, refusé s\'il est inconnu', () => {
  const r = recetteExemple();
  r.identite.visage = 'image.mix@1';
  assert.equal(validerRecette(r).ok, true);
  r.identite.visage = 'image.inconnu@1';
  assert.match(validerRecette(r).erreurs.join(' '), /visage inconnu/);
});

test('placementsVisage : proportionnel à la largeur du crâne, cheveux centrés, crâne coupé au menton', () => {
  const def = KIT.visagesImage['image.roux@1'];
  const a = placementsVisage(def, 100), b = placementsVisage(def, 200);
  const nez = (p) => p.calques.find((c) => c.role === 'nez');
  assert.ok(Math.abs(nez(b).dw / nez(a).dw - 2) < 1e-9);
  assert.ok(Math.abs(nez(b).dx / nez(a).dx - 2) < 1e-9);
  const crane = a.calques.find((c) => c.role === 'crane');
  assert.equal(crane.coupeBas, def.menton);
  assert.ok(Math.abs(a.cheveux.dx + a.cheveux.dw / 2 - 50) < 1e-9);
  assert.ok(a.cheveux.dy < 0);
  assert.ok(Math.abs(a.hauteurMenton - crane.dh * def.menton) < 1e-9);
});

test('teinter : identité si la cible égale la référence, proportionnel sinon, borné à 0–255', () => {
  assert.deepEqual(teinter([200, 150, 100], [200, 150, 100], [200, 150, 100]), [200, 150, 100]);
  assert.deepEqual(teinter([100, 80, 60], [200, 160, 120], [100, 80, 60]), [50, 40, 30]);
  assert.deepEqual(teinter([250, 250, 250], [100, 100, 100], [255, 255, 255]), [255, 255, 255]);
  assert.deepEqual(hexVersRgb('#e0ac8a'), [224, 172, 138]);
});

import { cheminSortie, recetteDeLot } from '../public/js/export.js';

test('cheminSortie : accepte segment/index du jeu, refuse tout le reste', () => {
  assert.equal(cheminSortie('couple', 3), 'couple/3.png');
  assert.equal(cheminSortie('celeb-dj-kalo', '07'), 'celeb-dj-kalo/7.png');
  for (const [s, i] of [['../x', 1], ['a/b', 1], ['Couple', 1], ['', 1], ['a', -1], ['a', '1.5'], ['a', 'x'], ['a', 1000], [null, 1]])
    assert.equal(cheminSortie(s, i), null, `${s}/${i}`);
});

test('recetteDeLot surcharge l\'exemple sans le muter et reste valide', () => {
  const base = recetteExemple();
  const r = recetteDeLot({ visage: 'image.aine@1', morphologie: 'trapue', teint: '#8a5a3c', tenue: 'soiree' });
  assert.equal(r.identite.visage, 'image.aine@1');
  assert.equal(r.apparence.tenue, 'soiree');
  assert.equal(base.identite.visage, 'v1');
  assert.equal(validerRecette(r).ok, true);
});

test('pose : inconnue refusée, connue acceptée, absente = repos, lot la transmet', () => {
  const r = recetteExemple();
  assert.equal(validerRecette(r).ok, true);
  r.apparence.pose = 'danse';
  assert.equal(validerRecette(r).ok, true);
  r.apparence.pose = 'moonwalk';
  const v = validerRecette(r);
  assert.equal(v.ok, false);
  assert.ok(v.erreurs.some((e) => e.includes('pose inconnue')));
  assert.equal(recetteDeLot({ pose: 'verre' }).apparence.pose, 'verre');
  for (const nom of Object.keys(KIT.poses)) assert.ok(KIT.poses[nom], nom);
});

test('corps : sans `corps` la géométrie est celle du préréglage (valeurs neutres des paramètres ajoutés)', () => {
  for (const mo of Object.keys(KIT.morphologies)) {
    const r = recetteExemple(); r.identite.morphologie = mo;
    const m = corpsResolu(r);
    for (const [k, v] of Object.entries(KIT.corpsDefaut)) assert.equal(m[k], v, `${mo}.${k}`);
    const g = geometrie(r);
    assert.equal(g.cuisseR, g.jambeR);
    assert.equal(g.molletR, g.jambeR);
    assert.equal(g.hanchesY, g.H * 0.44);
    assert.equal(g.tailleY, g.H * 0.54);
    assert.equal(g.profondeur, 0.72);
    assert.equal(g.cou, g.epaulesY + g.H * 0.03, `${mo} : dos neutre = cou d'avant`);
    assert.equal(g.teteY, g.cou + g.teteR * 0.9);
    assert.equal(r.identite.macros, undefined);
  }
});

test('corps : surcharge appliquée, bornes et noms contrôlés', () => {
  const r = recetteExemple();
  r.identite.corps = { epaules: 1.3, cuisses: 1.2, jambesLong: 1.08, poitrine: 0.5 };
  assert.equal(validerRecette(r).ok, true);
  const g = geometrie(r), g0 = geometrie(recetteExemple());
  assert.ok(g.demiEpaules > g0.demiEpaules);
  assert.ok(g.cuisseR > g.molletR);
  assert.ok(g.hanchesY > g0.hanchesY && g.tailleY > g.hanchesY && g.tailleY < g.epaulesY);
  for (const [k, v] of [['epaules', 2], ['jambesLong', 0.5], ['poitrine', 3], ['tete', NaN], ['inconnu', 1]]) {
    const x = recetteExemple(); x.identite.corps = { [k]: v };
    assert.equal(validerRecette(x).ok, false, `${k}=${v}`);
  }
  const y = recetteExemple(); y.identite.corps = [1];
  assert.equal(validerRecette(y).ok, false);
});

test('corps : bornes extrêmes → silhouette positive et continue, jambes cohérentes', () => {
  const noms = Object.keys(KIT.corpsBornes);
  for (const extr of [0, 1]) for (const mo of Object.keys(KIT.morphologies)) {
    const r = recetteExemple(); r.identite.morphologie = mo;
    r.identite.corps = Object.fromEntries(noms.map((n) => [n, KIT.corpsBornes[n][extr]]));
    assert.equal(validerRecette(r).ok, true);
    const g = geometrie(r);
    let prev = null;
    for (let i = 0; i <= 200; i++) {
      const y = g.hanchesY + ((g.epaulesY - g.hanchesY) * i) / 200;
      const w = demiLargeur(g, y);
      assert.ok(w > 0 && Number.isFinite(w), `${mo} y=${y}`);
      if (prev !== null) assert.ok(Math.abs(w - prev) < g.H * 0.02, `saut de silhouette ${mo} i=${i}`);
      prev = w;
    }
    assert.ok(g.hanchesY < g.tailleY && g.tailleY < g.epaulesY && g.epaulesY < g.cou && g.cou < g.teteY);
    const segs = segmentsJambe(g, g.hanchesY, g.jambeR);
    assert.ok(segs.every((s) => s.r > 0 && s.y1 > s.y2));
  }
});

test('macros : neutre = adulte moyen, bornes validées, âge enfant/senior cohérent', () => {
  const adulte = corpsDepuisMacros({});
  assert.deepEqual(adulte, corpsDepuisMacros({ corpulence: 0, musculature: 0, silhouette: 0, proportions: 0, age: 0.5 }));
  const enfant = corpsDepuisMacros({ age: 0 }), senior = corpsDepuisMacros({ age: 1 });
  assert.ok(enfant.hauteur < 0.7 && enfant.tete > adulte.tete && enfant.jambesLong < adulte.jambesLong);
  assert.ok(senior.dos > 0.5 && senior.hauteur < adulte.hauteur && adulte.dos === 0);
  for (const [nom, [mn, mx]] of Object.entries(KIT.macrosBornes)) for (const v of [mn, mx]) {
    const corps = corpsDepuisMacros({ [nom]: v });
    for (const [k, b] of Object.entries(KIT.corpsBornes)) assert.ok(corps[k] >= b[0] && corps[k] <= b[1], `${nom}=${v} → ${k}`);
  }
  const r = recetteExemple();
  r.identite.macros = { corpulence: 0.5, age: 0.9 };
  assert.equal(validerRecette(r).ok, true);
  assert.equal(corpsResolu(r).dos, corpsDepuisMacros(r.identite.macros).dos);
  r.identite.corps = { dos: 0 };
  assert.equal(corpsResolu(r).dos, 0, 'corps prime sur macros');
  for (const [k, v] of [['age', 2], ['corpulence', -2], ['inconnue', 0], ['age', NaN]]) {
    const x = recetteExemple(); x.identite.macros = { [k]: v };
    assert.equal(validerRecette(x).ok, false, `${k}=${v}`);
  }
});

test('macrosAleatoires : déterministe, dans les bornes, âge imposable', () => {
  assert.deepEqual(macrosAleatoires(42), macrosAleatoires(42));
  assert.notDeepEqual(macrosAleatoires(42), macrosAleatoires(43));
  for (let g = 1; g < 300; g++) for (const [k, v] of Object.entries(macrosAleatoires(g, { age: 0.1 }))) {
    const [mn, mx] = KIT.macrosBornes[k];
    assert.ok(v >= mn && v <= mx, `${g} ${k}`);
  }
  assert.equal(macrosAleatoires(1, { age: 0.9 }).age, 0.9);
});

test('tenues enfant / senior : pièces du catalogue, recette valide, jupe masque le slip, canne tenue en main', () => {
  const r = recetteExemple();
  for (const t of ['enfant', 'senior']) {
    assert.ok(r.garderobe.valise[t], t);
    r.apparence.tenue = t;
    assert.equal(validerRecette(r).ok, true, t);
    for (const e of r.garderobe.valise[t]) assert.ok(KIT.pieces[e.piece], e.piece);
  }
  assert.ok(KIT.pieces['tete.chapeau@1'] && KIT.pieces['bas.jupe@1'] && KIT.pieces['haut.pull@1']);
  r.apparence.tenue = 'enfant';
  assert.ok(!tenueResolue(r).pieces.some((p) => p.piece === 'sous.slip@1'), 'la jupe couvre les hanches');
  assert.ok(tenueResolue(r).pieces.some((p) => p.piece === 'tete.chapeau@1'));
  r.apparence.pose = 'canne';
  assert.equal(validerRecette(r).ok, true);
  assert.deepEqual(KIT.poses.canne.objets, [{ cote: 1, type: 'canne' }]);
});

test('visages ↔ âge : plages, compatibilité, choix et accord', () => {
  const cat = catalogueVisages();
  for (const id of [...Object.keys(KIT.visagesImage), ...Object.keys(KIT.visagesMaillage)]) {
    const p = plageAgeVisage(id);
    assert.ok(p && p[0] >= 0 && p[1] <= 1 && p[0] < p[1], `plage de ${id}`);
  }
  assert.equal(plageAgeVisage('v1'), null);
  assert.ok(visageCompatible('v1', 0.01) && visageCompatible('v1', 1), 'procédural : tous âges');
  assert.ok(visageCompatible('image.enfant@1', 0.1) && !visageCompatible('image.enfant@1', 0.9));
  assert.ok(!visageCompatible('image.ancien@1', 0.5) && visageCompatible('image.ancien@1', 0.95));
  // chaque âge de 0 à 1 (pas 0,01) a au moins un visage image/maillage à plage
  for (let a = 0; a <= 100; a++) {
    const age = a / 100;
    const avec = visagesCompatibles(age).filter((id) => plageAgeVisage(id));
    assert.ok(avec.length > 0, `aucun visage à plage pour l'âge ${age}`);
    const choisi = visagePourAge(age, 'image.enfant@1');
    assert.ok(visageCompatible(choisi, age), `${age} → ${choisi}`);
  }
  assert.equal(visagePourAge(0.1, 'image.enfant@1'), 'image.enfant@1', 'le visage courant est gardé quand il convient');
  assert.equal(visagePourAge(0.95, 'image.enfant@1').startsWith('image.') || visagePourAge(0.95, 'image.enfant@1').startsWith('maillage.'), true);
  assert.equal(ageAccordeAuVisage('image.enfant@1', 0.9), 0.15, 'hors plage → centre de la plage');
  assert.equal(ageAccordeAuVisage('image.aine@1', 0.5), 0.875);
  assert.equal(ageAccordeAuVisage('image.enfant@1', 0.1), 0.1, 'dans la plage → inchangé');
  assert.equal(ageAccordeAuVisage('image.roux@1', 0.5), 0.5);
  assert.equal(ageAccordeAuVisage('v1', 0.01), 0.01);
  assert.ok(Object.keys(cat).length >= 12);
});

test('visages ↔ âge : avertissement non bloquant, seulement avec un âge explicite', () => {
  const r = recetteExemple();
  r.identite.visage = 'image.enfant@1';
  let v = validerRecette(r);
  assert.equal(v.ok, true);
  assert.deepEqual(v.avertissements, [], 'sans macro age : pas d\'avertissement (recettes d\'avant)');
  r.identite.macros = { age: 0.9 };
  v = validerRecette(r);
  assert.equal(v.ok, true, 'reste valide');
  assert.equal(v.avertissements.length, 1);
  assert.match(v.avertissements[0], /image\.enfant@1.*0–0\.3.*0\.9/);
  r.identite.macros = { age: 0.1 };
  assert.deepEqual(validerRecette(r).avertissements, []);
});
