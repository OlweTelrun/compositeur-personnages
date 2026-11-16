// Prépare un lot « style du jeu » : tire les recettes d'un segment (segments.js) et écrit pour chacune le prompt anglais
// à envoyer au générateur d'images (MCP generateur-images, outil generer_images) avec le style du jeu.
// Usage : node outils/prompts_lot.mjs <segment> <n> <graine> <premierIndex>  → JSON sur la sortie standard.
import { genererLot, SEGMENTS } from '../prototype/public/js/segments.js';
import { promptPersonnage, STYLE_BASE, STYLE_JEU } from '../prototype/public/js/description.js';

const [segment, n = '4', graine = '1', debut = '0'] = process.argv.slice(2);
const S = SEGMENTS[segment];
if (!S) { console.error(`segment inconnu : ${segment} (connus : ${Object.keys(SEGMENTS).join(', ')})`); process.exit(2); }
if (S.bloque) { console.error(`segment « ${segment} » bloqué : ${S.bloque}`); process.exit(3); }
const { lot, rejets } = genererLot(segment, Number(n), Number(graine), { debut: Number(debut) });
const items = lot.items.map((it) => ({ index: it.index, recette: it, prompt: promptPersonnage(it, S) }));
// `style` = ce qu'il faut passer tel quel au paramètre `style` de generer_images (proportions propres au segment)
const style = S.proportions ? STYLE_BASE(S.proportions) : STYLE_JEU;
console.log(JSON.stringify({ segment, graine: Number(graine), rejets: rejets.length, style, prompts: items.map((i) => i.prompt), items }, null, 1));
