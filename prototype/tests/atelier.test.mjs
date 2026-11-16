import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { mulberry32, etatInitial, tirerPersonne, tirerTenue, tirerVisage, tirerCorps, calques, variante, jetons, copie, CATEGORIES_TENUE } from '../public/js/atelier-moteur.js';

const dossier = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'atelier');
const base = JSON.parse(readFileSync(join(dossier, 'base.json'), 'utf8'));

test('chaque calque du catalogue existe, pour chaque silhouette', () => {
  for (const [cat, c] of Object.entries(base.categories)) {
    for (const v of c.variantes) for (const k of v.calques) {
      assert.ok(base.ordre.includes(k.z), `${cat}/${v.id} : couche ${k.z} inconnue`);
      const sils = k.fichier.includes('{sil}') ? base.silhouettes.map((s) => s.id) : [''];
      for (const s of sils) assert.ok(existsSync(join(dossier, k.fichier.replace('{sil}', s))), `${k.fichier} (${s}) manquant`);
    }
  }
});

test('tirages déterministes par graine', () => {
  const f = (graine) => { const e = etatInitial(base); const r = mulberry32(graine); tirerPersonne(base, r, e); tirerTenue(base, r, e); return e; };
  assert.deepEqual(f(7), f(7));
  assert.notDeepEqual(f(7), f(8));
});

test('changer de tenue ne touche pas la personne (même personne, autre tenue)', () => {
  const e = etatInitial(base); const r = mulberry32(1);
  tirerPersonne(base, r, e);
  const avant = copie(e.personne);
  for (let i = 0; i < 20; i++) tirerTenue(base, r, e);
  assert.deepEqual(e.personne, avant);
});

test('orientation : genre, gabarit, peau, couleur de cheveux, style', () => {
  for (let g = 0; g < 40; g++) {
    const e = etatInitial(base); const r = mulberry32(g);
    tirerPersonne(base, r, e, { genre: 'h', gabarit: 'rond', peau: '#8d5a3b', cheveux: '#1e1a1a' });
    const s = base.silhouettes.find((x) => x.id === e.personne.parts.torse);
    assert.equal(s.genre, 'h'); assert.equal(s.gabarit, 'rond');
    assert.equal(e.personne.peau, '#8d5a3b'); assert.equal(e.personne.cheveux, '#1e1a1a');
    assert.ok(['h', '*'].includes(variante(base, 'cheveux', e.personne.parts.cheveux).genre));
    tirerTenue(base, r, e, { style: 'plage' });
    for (const c of ['haut', 'bas', 'chaussures']) assert.ok(variante(base, c, e.tenue[c].id).styles.includes('plage'), `${c}:${e.tenue[c].id}`);
  }
});

test('torse, bras et jambes restent sur la même silhouette quand on tire un corps', () => {
  const e = etatInitial(base); tirerCorps(base, mulberry32(3), e, { genre: 'f' });
  const { torse, bras, jambes } = e.personne.parts; assert.equal(torse, bras); assert.equal(torse, jambes);
});

test('une pièce verrouillée ne change jamais', () => {
  const e = etatInitial(base); const r = mulberry32(5);
  tirerPersonne(base, r, e);
  e.personne.parts.yeux = 'chat'; e.tenue.haut = { id: 'pull', couleur: '#ff6f61' };
  for (let i = 0; i < 30; i++) { tirerVisage(base, r, e, {}, { yeux: true }); tirerTenue(base, r, e, {}, { haut: true }); }
  assert.equal(e.personne.parts.yeux, 'chat'); assert.deepEqual(e.tenue.haut, { id: 'pull', couleur: '#ff6f61' });
});

test('empilement : ordre respecté, robe masque le bas, pas de calque pour « aucun »', () => {
  const e = etatInitial(base); const r = mulberry32(9);
  tirerPersonne(base, r, e, { genre: 'f' });
  e.tenue.haut = { id: 'robe', couleur: '#ff6f61' }; e.tenue.bas = { id: 'pantalon', couleur: '#26262b' };
  let l = calques(base, e);
  assert.ok(!l.some((c) => c.cat === 'bas'), 'le bas doit être masqué sous une robe');
  const z = l.map((c) => base.ordre.indexOf(c.z)); assert.deepEqual(z, [...z].sort((a, b) => a - b));
  e.tenue.haut = { id: 'aucun', couleur: '#fff' }; e.tenue.bas = { id: 'short', couleur: '#26262b' };
  l = calques(base, e);
  assert.ok(!l.some((c) => c.cat === 'haut') && l.some((c) => c.cat === 'bas'));
  assert.ok(l.every((c) => !c.fichier.includes('{sil}')));
});

test('jetons : la couleur de vêtement ne sort que pour les catégories habillées', () => {
  const e = etatInitial(base);
  assert.equal(jetons(e, 'tete').c, undefined);
  assert.ok(jetons(e, 'haut').c);
  assert.ok(CATEGORIES_TENUE.every((c) => jetons(e, c).peau));
});

test('atelier PNG : chaque pièce du catalogue a son image et ses mesures, le moteur tire sans erreur', () => {
  const d2 = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'atelier2');
  const b = JSON.parse(readFileSync(join(d2, 'base.json'), 'utf8')), meta = JSON.parse(readFileSync(join(d2, 'pieces.json'), 'utf8'));
  for (const [cat, c] of Object.entries(b.categories)) for (const v of c.variantes) for (const k of v.calques) {
    assert.ok(existsSync(join(d2, k.fichier)), `${k.fichier} manquant`); assert.ok(meta[cat][v.id], `mesures de ${cat}/${v.id}`);
  }
  for (const id of Object.keys(meta.corps)) assert.ok(meta.corps[id].larg.length === 50 && meta.corps[id].lum_peau);
  for (const id of Object.keys(meta.tete)) assert.ok(meta.tete[id].hface > 0 && meta.tete[id].wmax > 0);
  const e = etatInitial(b);
  for (let g = 0; g < 30; g++) { const r = mulberry32(g); tirerPersonne(b, r, e, { genre: g % 2 ? 'h' : 'f' }); tirerTenue(b, r, e, { style: 'plage' }); assert.ok(calques(b, e).length >= 5); }
});
