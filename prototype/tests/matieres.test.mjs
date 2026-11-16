import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { KIT, recetteExemple, validerRecette } from '../public/js/kit.js';

const pub = fileURLToPath(new URL('../public/', import.meta.url));

test('chaque matière du kit a ses fichiers (albedo + normale) et une tuile positive', () => {
  for (const [id, m] of Object.entries(KIT.matieres)) {
    assert.ok(existsSync(join(pub, m.src)), `${id} : ${m.src}`);
    assert.ok(existsSync(join(pub, m.normale)), `${id} : ${m.normale}`);
    assert.ok(m.tuile > 0, id);
    assert.equal(typeof m.teintable, 'boolean', id);
  }
});

test('les tenues d\'exemple utilisant une matière sont valides, une matière inconnue est refusée', () => {
  for (const tenue of ['jean', 'ecossais']) {
    const r = recetteExemple();
    r.apparence.tenue = tenue;
    const v = validerRecette(r, KIT);
    assert.deepEqual(v.erreurs, [], tenue);
  }
  const r = recetteExemple();
  r.garderobe.valise.plage[0].matiere = 'tissu.inexistant@1';
  assert.ok(validerRecette(r, KIT).erreurs.some((e) => e.includes('matière inconnue')));
});

test('apparence.chaussures : matière et couleur validées, absence = comportement historique', () => {
  const r = recetteExemple();
  assert.deepEqual(validerRecette(r, KIT).erreurs, []);
  r.apparence.chaussures = { matiere: 'cuir.grain@1', couleur: '#7a4a28' };
  assert.deepEqual(validerRecette(r, KIT).erreurs, []);
  r.apparence.chaussures = { matiere: 'cuir.inconnu@1' };
  assert.ok(validerRecette(r, KIT).erreurs.some((e) => e.includes('chaussures inconnue')));
  r.apparence.chaussures = { couleur: 'rouge' };
  assert.ok(validerRecette(r, KIT).erreurs.some((e) => e.includes('couleur de chaussures')));
});

test('la tenue « jean » met une matière sur le chapeau', () => {
  const r = recetteExemple();
  r.apparence.tenue = 'jean';
  assert.ok(r.garderobe.valise.jean.some((e) => e.piece === 'tete.chapeau@1' && e.matiere));
  assert.deepEqual(validerRecette(r, KIT).erreurs, []);
});
