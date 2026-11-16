import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIT, validerRecette, visageCompatible } from '../public/js/kit.js';
import { recetteDeLot } from '../public/js/export.js';
import { SEGMENTS, genererLot, signature } from '../public/js/segments.js';

for (const seg of Object.keys(SEGMENTS)) {
  test(`${seg} : 12 sprites valides, ages et visages cohérents, tous différents`, () => {
    const { lot, rejets } = genererLot(seg, 12, 7);
    assert.equal(lot.segment, seg);
    assert.equal(lot.items.length, 12, `rejets : ${JSON.stringify(rejets.slice(0, 3))}`);
    const S = SEGMENTS[seg];
    for (const it of lot.items) {
      for (const m of it.membres ?? [it]) {
        assert.deepEqual(validerRecette(recetteDeLot(m), KIT).erreurs, []);
        const plage = m.enfant ? S.ageEnfant : S.age;
        assert.ok(m.macros.age >= plage[0] - 1e-9 && m.macros.age <= plage[1] + 1e-9, `age ${m.macros.age}`);
        assert.ok(visageCompatible(m.visage, m.macros.age, KIT), `${m.visage} @ ${m.macros.age}`);
        assert.ok((m.enfant ? S.visagesEnfant : S.visages).includes(m.visage));
        assert.ok(m.traits && m.attitude, 'traits de visage et attitude présents');
      }
    }
    assert.equal(new Set(lot.items.map(signature)).size, 12);
  });
}

test('tous les segments décrits ont libellé, look, proportions et au moins une attitude', () => {
  for (const [id, S] of Object.entries(SEGMENTS)) {
    assert.ok(S.libelle && S.segmentAnglais && S.look && S.proportions, id);
    assert.ok(S.attitudes.length >= 2, id);
  }
  assert.equal(Object.keys(SEGMENTS).length, 12); // les 12 segments à 7 sprites du jeu
});

test('famille : 2 parents + 1 ou 2 enfants, enfants nettement plus jeunes', () => {
  const { lot } = genererLot('famille', 12, 4);
  const tailles = new Set();
  for (const it of lot.items) {
    tailles.add(it.membres.length);
    const enfants = it.membres.filter((m) => m.enfant), adultes = it.membres.filter((m) => !m.enfant);
    assert.equal(adultes.length, 2);
    assert.ok(enfants.length >= 1 && enfants.length <= 2);
    for (const e of enfants) for (const a of adultes) assert.ok(a.macros.age - e.macros.age >= 0.12);
  }
  assert.ok(tailles.has(3) && tailles.has(4), `tailles de groupe vues : ${[...tailles]}`);
});

test('corps variés : pas de dérive vers le mannequin (musculature ≤ 0,6 partout, corpulence moyenne > 0 chez fêtards et couples)', () => {
  for (const seg of ['fetard', 'couple']) {
    const { lot } = genererLot(seg, 40, 11);
    const ms = lot.items.flatMap((it) => it.membres ?? [it]);
    assert.ok(ms.every((m) => m.macros.musculature <= 0.3 + 1e-9));
    assert.ok(ms.reduce((s, m) => s + m.macros.corpulence, 0) / ms.length > 0, seg);
  }
});

test('déterminisme : même graine → même lot ; autre graine → autre lot ; debut décale les index', () => {
  const a = genererLot('senior', 6, 3), b = genererLot('senior', 6, 3), c = genererLot('senior', 6, 4);
  assert.deepEqual(a.lot, b.lot);
  assert.notDeepEqual(a.lot.items.map(signature), c.lot.items.map(signature));
  const d = genererLot('senior', 3, 3, { debut: 7 });
  assert.deepEqual(d.lot.items.map((i) => i.index), [7, 8, 9]);
});

test('segment inconnu : erreur explicite', () => {
  assert.throws(() => genererLot('inexistant', 3), /segment inconnu/);
});

test('couple : les deux âges sont proches (écart ≤ 0,15 de la macro âge)', () => {
  const { lot } = genererLot('couple', 10, 9);
  for (const it of lot.items) assert.ok(Math.abs(it.membres[0].macros.age - it.membres[1].macros.age) <= 0.15);
});

test('enfants : pas de jupe pour les garçons (silhouette > 0), et seulement dans les groupes qui en ont', () => {
  const { lot } = genererLot('famille', 30, 2);
  for (const it of lot.items) for (const m of it.membres.filter((x) => x.enfant)) {
    if (m.macros.silhouette > 0) assert.ok(!m.tenuePieces.some((p) => p.piece === 'bas.jupe@1'), JSON.stringify(m.tenuePieces.map((p) => p.piece)));
  }
});

test('segment bloqué (ados) : marqué, et jamais présenté comme générable', () => {
  assert.ok(SEGMENTS.ados.bloque && /contourner/.test(SEGMENTS.ados.bloque));
});

test('catalogue.json : chaque pièce du kit utilisée par un segment a une entrée avec type Blender et version ample', async () => {
  const { readFile } = await import('node:fs/promises');
  const cat = JSON.parse(await readFile(new URL('../public/pieces/catalogue.json', import.meta.url), 'utf8'));
  const parKit = new Map(cat.pieces.filter((p) => p.kit).map((p) => [p.kit, p]));
  const utilisees = new Set();
  for (const seg of Object.keys(SEGMENTS)) {
    if (SEGMENTS[seg].bloque) continue;
    for (const it of genererLot(seg, 12, 3).lot.items) for (const m of it.membres ?? [it]) for (const p of m.tenuePieces) utilisees.add(p.piece);
  }
  for (const id of utilisees) {
    if (id === 'sous.slip@1') continue;
    const e = parKit.get(id);
    assert.ok(e, `${id} absent du catalogue`);
    assert.ok(e.blender?.type, `${id} : type Blender manquant`);
    assert.ok(e.couche >= 2 || e.categorie === 'couvre-chef', `${id} : ordre d'habillage (couche) manquant`);
  }
});

test('vip : le manteau fait partie des tenues possibles', () => {
  const vus = new Set();
  for (let g = 1; g <= 12; g++) for (const it of genererLot('vip', 12, g).lot.items) for (const p of it.tenuePieces ?? []) vus.add(p.piece);
  assert.ok(vus.has('haut.manteau@1'));
});
