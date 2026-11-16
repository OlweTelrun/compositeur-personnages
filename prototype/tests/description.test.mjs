import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nomCouleur, anneesDepuisAge, descriptionPersonnage, promptPersonnage } from '../public/js/description.js';
import { genererLot } from '../public/js/segments.js';

test('nomCouleur : couleurs courantes', () => {
  assert.equal(nomCouleur('#000000'), 'black');
  assert.equal(nomCouleur('#ffffff'), 'white');
  assert.equal(nomCouleur('#e63946'), 'red');
  assert.equal(nomCouleur('#2e4f8f'), 'blue');
  assert.equal(nomCouleur('#808080'), 'grey');
  assert.equal(nomCouleur('#7a4a28'), 'brown');
});

test('anneesDepuisAge est croissant et borné', () => {
  let prec = 0;
  for (let a = 0; a <= 1; a += 0.05) { const y = anneesDepuisAge(a); assert.ok(y >= prec); prec = y; }
  assert.equal(anneesDepuisAge(0), 6);
  assert.equal(anneesDepuisAge(1), 85);
});

test('descriptions : en anglais, sans identifiant interne, cohérentes avec la recette', () => {
  for (const seg of ['senior', 'fetard']) {
    const { lot } = genererLot(seg, 10, 5);
    for (const it of lot.items) {
      const d = descriptionPersonnage(it);
      assert.ok(!/@1|\.|undefined|null|#[0-9a-f]{6}/i.test(d.replace(/years old\.?/, '')), d);
      assert.match(d, /years old/);
      assert.match(d, /wearing/);
      assert.ok(d.includes(it.macros.silhouette < 0 ? 'woman' : 'man') || /girl|boy/.test(d), d);
      if (it.pose === 'canne') assert.match(d, /cane/);
      if (it.pose === 'verre') assert.match(d, /cocktail/);
    }
  }
});

test('prompt : porte le segment et l\'isolation sur fond transparent', () => {
  const { lot } = genererLot('senior', 1, 1);
  const p = promptPersonnage(lot.items[0], { libelle: 'Les Seniors', segmentAnglais: 'Senior' });
  assert.match(p, /Les Seniors/);
  assert.match(p, /transparent background/);
});

test('prompt de groupe : deux personnes, côte à côte, corps entiers', () => {
  const { lot } = genererLot('couple', 1, 2);
  const p = promptPersonnage(lot.items[0], { libelle: 'Les Couples', segmentAnglais: 'Couple' });
  assert.match(p, /TWO people/);
  assert.match(p, /on the left .* on the right/);
  assert.ok(!/@1|undefined/.test(p));
});

test('style : proportions propres au segment (seniors trapus, fêtards ordinaires), clause familiale toujours présente', async () => {
  const { STYLE_BASE, STYLE_JEU } = await import('../public/js/description.js');
  const { SEGMENTS } = await import('../public/js/segments.js');
  assert.match(STYLE_BASE(SEGMENTS.senior.proportions), /short stocky legs/);
  assert.match(STYLE_BASE(SEGMENTS.fetard.proportions), /natural ordinary body/);
  for (const S of Object.values(SEGMENTS)) assert.match(STYLE_BASE(S.proportions), /no crop tops.*nothing sexualised/);
  for (const S of Object.values(SEGMENTS)) assert.ok(!/slender|graceful|long legs|athletic|sexy|glamo/i.test(S.proportions.replace('athletic-casual', '')), S.proportions);
  assert.match(STYLE_JEU, /Pixar-like/);
});
