import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIT, recetteExemple, geometrie } from '../public/js/kit.js';
import { CLIPS, poseAnimee } from '../public/js/anim.js';

const g = geometrie(recetteExemple(), KIT);

test('chaque clip est périodique (t = 0 et t = 1 donnent la même pose)', () => {
  for (const nom of Object.keys(CLIPS)) {
    const a = poseAnimee(nom, 0, g), b = poseAnimee(nom, 1, g);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), nom);
  }
});

test('le corps ne descend jamais sous les pieds : marche ≤ 0 (jambes inclinées), repos et danse ≥ 0', () => {
  for (let i = 0; i < 32; i++) {
    const t = i / 32;
    assert.ok(poseAnimee('marche', t, g).dy <= 0);
    assert.ok(poseAnimee('respire', t, g).dy >= 0);
    assert.ok(poseAnimee('danse', t, g).dy >= 0);
  }
});

test('un genou ne plie que vers l\'arrière, et les jambes de la marche sont en opposition', () => {
  for (let i = 0; i < 32; i++) {
    const p = poseAnimee('marche', i / 32, g);
    assert.ok(p.genou[1] >= 0 && p.genou[-1] >= 0);
    assert.ok(Math.abs(p.hanche[1] + p.hanche[-1]) < 1e-9);
    assert.ok(Math.abs(p.epaule[1] + p.epaule[-1]) < 1e-9);
  }
});
