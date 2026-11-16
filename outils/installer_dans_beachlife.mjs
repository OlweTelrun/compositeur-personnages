// Installe dans BeachlifeLike les sprites exportés par le compositeur (prototype/sortie/<segment>/<n>.png) :
// copie les PNG vers prototype/public/assets/personnages/<segment>/ et ajoute les entrées au manifeste.
// ESSAI À BLANC par défaut (n'écrit rien). Pour écrire : ajouter --ecrire. Usage : node outils/installer_dans_beachlife.mjs <segment> [--ecrire]
// Garde-fous : n'écrase JAMAIS un fichier différent du jeu (un fichier identique est ignoré), sauvegarde le manifeste avant d'y toucher,
// n'ajoute que des entrées absentes, ne retire rien. Retour arrière : restaurer la sauvegarde et supprimer les PNG listés.
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const [segment, ...opts] = process.argv.slice(2);
const ecrire = opts.includes('--ecrire');
if (!segment || !/^[a-z][a-z0-9-]{0,29}$/.test(segment)) { console.error('usage : node outils/installer_dans_beachlife.mjs <segment> [--ecrire]'); process.exit(2); }

const racine = fileURLToPath(new URL('../', import.meta.url));
const source = join(racine, 'prototype', 'sortie', segment);
const jeu = join(racine, '..', 'BeachlifeLike', 'prototype', 'public');
const dossier = join(jeu, 'assets', 'personnages', segment);
const fichierManifeste = join(jeu, 'assets', 'personnages', 'manifest.json');
if (!existsSync(source)) { console.error(`rien à installer : ${source} n'existe pas (exporter d'abord un lot)`); process.exit(1); }

const manifeste = JSON.parse(readFileSync(fichierManifeste, 'utf8'));
if (!manifeste.personnages?.[segment]) { console.error(`segment « ${segment} » absent du manifeste du jeu : refus d'en créer un`); process.exit(1); }
const entrees = manifeste.personnages[segment];

const actions = [];
for (const f of readdirSync(source).filter((x) => /^\d{1,3}\.png$/.test(x)).sort((a, b) => parseInt(a) - parseInt(b))) {
  const dest = join(dossier, f), chemin = `assets/personnages/${segment}/${f}`;
  const a = readFileSync(join(source, f));
  let copie = 'copier';
  if (existsSync(dest)) copie = readFileSync(dest).equals(a) ? 'identique (ignoré)' : 'CONFLIT (fichier différent déjà dans le jeu : refusé)';
  actions.push({ f, chemin, copie, manifeste: entrees.includes(chemin) ? 'déjà listé' : 'ajouter' });
}
for (const a of actions) console.log(`${segment}/${a.f} : fichier ${a.copie} ; manifeste ${a.manifeste}`);
const conflits = actions.filter((a) => a.copie.startsWith('CONFLIT'));
if (conflits.length) { console.error(`${conflits.length} conflit(s) : rien n'est écrit. Choisir un autre premier index (= nombre de variantes du jeu) à la génération.`); process.exit(1); }
const aFaire = actions.filter((a) => a.copie === 'copier' || a.manifeste === 'ajouter');
if (!aFaire.length) { console.log('rien à faire.'); process.exit(0); }
if (!ecrire) { console.log(`\nESSAI À BLANC : ${aFaire.length} action(s) possible(s). Relancer avec --ecrire pour installer.`); process.exit(0); }

const sauv = join(racine, 'prototype', 'sortie', '_sauvegardes');
mkdirSync(sauv, { recursive: true });
const sauvegarde = join(sauv, `manifest-personnages.${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
copyFileSync(fichierManifeste, sauvegarde);
mkdirSync(dossier, { recursive: true });
for (const a of aFaire) {
  if (a.copie === 'copier') copyFileSync(join(source, a.f), join(dossier, a.f));
  if (a.manifeste === 'ajouter') entrees.push(a.chemin);
}
writeFileSync(fichierManifeste, JSON.stringify(manifeste, null, 2) + '\n');
console.log(`\nInstallé : ${aFaire.length} action(s). Sauvegarde du manifeste : ${sauvegarde}`);
