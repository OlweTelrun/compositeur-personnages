// Recette (item de lot) → description en ANGLAIS pour un générateur d'images : c'est le pont entre le compositeur (qui décide QUI
// et COMMENT il est habillé, de façon contrôlée et variée) et l'illustrateur (qui donne le style du jeu). Pur : aucun DOM.
import { hexVersRgb } from './kit.js';

/** Style du jeu (guide d'assets graphiques de BeachlifeLike, documentation/beachlifeLIke-assets-graphiques.md). */
// Clause de décence : le générateur tire spontanément vers des silhouettes de mannequin et des vêtements très courts ou ajustés ;
// elle impose des gens ordinaires, de tous gabarits, en tenue de plage décontractée et couvrante (retour de Jeremy, 7 nov. 2026).
export const CLAUSE_FAMILIALE = 'family-friendly and wholesome, ordinary relatable people of varied body shapes, natural everyday bodies, friendly everyday faces (not model-like, not glamorous), casual relaxed regular-fit modest clothing, fully covered torso, no cleavage, no crop tops, no tight or revealing clothes, nothing sexualised';
export const STYLE_BASE = (proportions) => `stylised 3D cartoon game asset, glossy Pixar-like render, playful Ibiza spring-break beach-resort vibe, vibrant saturated tropical colour palette, clean readable silhouette, ${proportions}, soft global illumination, high detail, ${CLAUSE_FAMILIALE}, no lettering`;
export const STYLE_JEU = STYLE_BASE('slightly caricatural proportions');

/** Nom anglais approximatif d'une couleur hexadécimale (teinte, clarté, saturation). */
export function nomCouleur(hex) {
  const [r, g, b] = hexVersRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (l < 0.12) return 'black';
  if (l > 0.92) return 'white';
  if (s < 0.12) return l < 0.35 ? 'dark grey' : l > 0.75 ? 'light grey' : 'grey';
  const base = h < 15 || h >= 345 ? 'red' : h < 40 ? 'orange' : h < 65 ? 'yellow' : h < 95 ? 'lime green' : h < 165 ? 'green' : h < 195 ? 'turquoise' : h < 250 ? 'blue' : h < 290 ? 'purple' : 'pink';
  if ((base === 'yellow' || base === 'orange') && s < 0.5) return l > 0.62 ? 'beige' : l > 0.4 ? 'khaki' : 'brown';
  if (base === 'lime green' && s < 0.45) return l > 0.5 ? 'khaki' : 'olive green';
  if (base === 'orange' && l < 0.4) return 'brown';
  if (base === 'yellow' && l < 0.4) return 'olive';
  if (base === 'red' && l > 0.78) return 'pale pink';
  if (base === 'green' && h >= 140) return 'emerald green';
  const clair = l > 0.75 ? 'pale ' : l < 0.3 ? 'dark ' : '';
  return `${clair}${base}`;
}

const MATIERES = {
  'tissu.denim@1': 'denim', 'tissu.lin@1': 'linen', 'tissu.maille@1': 'chunky knit', 'tissu.tweed@1': 'tweed', 'cuir.grain@1': 'leather',
  'tissu.vichy@1': 'gingham-check', 'tissu.rayures@1': 'striped', 'tissu.tartan@1': 'tartan plaid',
};
const IMPRIMEES = new Set(['tissu.vichy@1', 'tissu.rayures@1', 'tissu.tartan@1']); // la couleur propre à la pièce n'a pas de sens

const AGE_ANNEES = [[0, 6], [0.3, 18], [0.5, 35], [0.75, 60], [1, 85]];
export function anneesDepuisAge(age) {
  for (let i = 1; i < AGE_ANNEES.length; i++) {
    const [a0, y0] = AGE_ANNEES[i - 1], [a1, y1] = AGE_ANNEES[i];
    if (age <= a1) return Math.round(y0 + ((age - a0) / (a1 - a0)) * (y1 - y0));
  }
  return 85;
}

function infosPersonne(it) {
  const m = it.macros ?? {};
  const ans = anneesDepuisAge(m.age ?? 0.5);
  const femme = (m.silhouette ?? 0) < 0;
  const mot = ans < 13 ? (femme ? 'girl' : 'boy') : ans < 20 ? (femme ? 'teenage girl' : 'teenage boy') : ans >= 70 ? (femme ? 'elderly woman' : 'elderly man') : (femme ? 'woman' : 'man');
  // Gabarit : toujours dit explicitement (sinon le générateur choisit le plus « flatteur »). La morphologie du kit nuance.
  const c = m.corpulence ?? 0;
  let gabarit = c > 0.35 ? 'plump' : c < -0.35 ? 'slim' : 'average-build';
  if (it.morphologie === 'ronde' && c > 0) gabarit = c > 0.35 ? 'plump, soft round-bellied' : 'soft round';
  if (it.morphologie === 'trapue' && c > -0.2) gabarit = 'stocky sturdy';
  if (ans < 20) gabarit = ans < 13 ? '' : 'slim';
  const teint = { '#f3d2b3': 'fair', '#e8bc99': 'light', '#d9a07a': 'light brown', '#c68b64': 'tan', '#a8704a': 'brown', '#8a5a3c': 'dark brown', '#6b422b': 'deep dark brown' }[it.teint];
  return { ans, mot, gabarit, teint };
}

function personne(it) {
  const { ans, mot, gabarit, teint } = infosPersonne(it);
  const premier = gabarit || mot;
  return `${/^[aeiou]/.test(premier) ? 'an' : 'a'} ${gabarit ? gabarit + ' ' : ''}${mot} of about ${ans} years old${teint ? `, ${teint} skin` : ''}${it.traits ? `, with ${it.traits}` : ''}`;
}

function vetement(p) {
  const NOMS = { 'haut.tshirt@1': 'regular-fit short-sleeved t-shirt covering the waist', 'haut.chemise@1': 'loose button-up shirt', 'haut.pull@1': 'sweater', 'haut.gilet@1': 'waistcoat', 'haut.manteau@1': 'long coat', 'bas.short@1': 'knee-length bermuda shorts', 'bas.pantalon@1': 'straight-leg trousers', 'bas.jupe@1': 'flared knee-length skirt', 'tete.chapeau@1': 'straw hat', 'sous.slip@1': '' };
  const nom = NOMS[p.piece];
  if (!nom) return null;
  const mat = p.matiere ? MATIERES[p.matiere] : null;
  const couleur = p.matiere && IMPRIMEES.has(p.matiere) ? null : nomCouleur(p.couleurs.corps);
  let txt = [couleur, mat, nom].filter(Boolean).join(' ');
  if (p.piece === 'tete.chapeau@1' && p.couleurs.ruban) { const cr = nomCouleur(p.couleurs.ruban); txt += ` with ${/^[aeiou]/.test(cr) ? 'an' : 'a'} ${cr} ribbon`; }
  if (p.motif) txt += ` with a small ${{ soleil: 'sun', coeur: 'heart', rayures: 'stripe' }[p.motif.type] ?? p.motif.type} motif in ${nomCouleur(p.motif.couleur)}`;
  return /(shorts|trousers)$/.test(txt) ? txt : `${/^[aeiou]/.test(txt) ? 'an' : 'a'} ${txt}`; // pluriels sans article
}

const POSES = {
  canne: 'standing calmly and leaning on a wooden walking cane',
  repos: 'standing relaxed, friendly',
  verre: 'holding a colourful cocktail glass with a straw in one hand, cheerful',
  danse: 'dancing joyfully with arms raised',
  salut: 'waving hello with one raised arm, smiling',
};

/** Texte limité à UN aspect d'une personne (pour une retouche « seulement ça » d'une image existante) : 'visage' | 'corps' | 'tenue'. */
export function descriptionAspect(it, aspect) {
  const { ans, mot, gabarit, teint } = infosPersonne(it);
  if (aspect === 'visage') return `${it.traits ? `${it.traits}` : 'ordinary friendly face'}${teint ? `, ${teint} skin` : ''}, about ${ans} years old`;
  if (aspect === 'corps') return `${gabarit ? gabarit + ' ' : ''}${mot} body build${it.morphologie === 'ronde' ? ', soft round belly' : it.morphologie === 'trapue' ? ', stocky and sturdy' : ''}`;
  const haut = it.tenuePieces.map(vetement).filter(Boolean);
  const chaussures = it.chaussures?.matiere === 'tissu.lin@1' ? `${nomCouleur(it.chaussures.couleur)} canvas shoes` : it.chaussures?.matiere ? `${nomCouleur(it.chaussures.couleur)} leather shoes` : it.chaussures?.couleur ? `${nomCouleur(it.chaussures.couleur)} shoes` : 'simple shoes';
  return `${haut.join(', ')} and ${chaussures}, ${it.attitude ?? POSES[it.pose] ?? POSES.repos}`;
}

/** Description complète d'un item de lot : qui, vêtements, chaussures, pose. */
export function descriptionPersonnage(it) {
  const haut = it.tenuePieces.map(vetement).filter(Boolean);
  const chaussures = it.chaussures?.matiere === 'tissu.lin@1' ? `${nomCouleur(it.chaussures.couleur)} canvas shoes` : it.chaussures?.matiere ? `${nomCouleur(it.chaussures.couleur)} leather shoes` : it.chaussures?.couleur ? `${nomCouleur(it.chaussures.couleur)} shoes` : 'simple shoes';
  return `${personne(it)}, wearing ${haut.join(', ')} and ${chaussures}, ${it.attitude ?? POSES[it.pose] ?? POSES.repos}`;
}

/** Prompt complet pour un segment du jeu (`libelle` = « Les Seniors »…, `look` = archétype du segment). */
export function promptPersonnage(it, { libelle, segmentAnglais, look = '', groupeMot = '' } = {}) {
  if (it.membres) { // groupe de N personnages dans la même image
    const NB = { 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE' };
    const places = ['on the left', 'next to them', 'then', 'on the far right', 'also'];
    const desc = it.membres.map((m, i) => `${i === 0 ? 'on the left' : i === it.membres.length - 1 ? 'on the right' : 'in the middle'} ${descriptionPersonnage(m)}`);
    return `Full-body stylised cartoon tourist characters${libelle ? ` — “${libelle}”` : ''} (resort guests${segmentAnglais ? `, segment: ${segmentAnglais}` : ''}): ${groupeMot ? `${groupeMot}: ` : ''}${NB[it.membres.length] ?? it.membres.length} people standing side by side, close together, ${desc.join('; ')}.${look ? ` Archetype look: ${look}.` : ''} Every character has their full body visible from head to feet, correct relative scale${it.membres.some((m) => m.enfant) ? ' (children clearly smaller than the adults)' : ''}, idle poses, isolated on transparent background, nothing else.`;
  }
  return `Full-body stylised cartoon tourist character${libelle ? ` — “${libelle}”` : ''} (resort guest${segmentAnglais ? `, segment: ${segmentAnglais}` : ''}): ${descriptionPersonnage(it)}.${look ? ` Archetype look: ${look}.` : ''} Idle pose, recognisable silhouette, full body visible from head to feet, a single character, isolated on transparent background, nothing else.`;
}
