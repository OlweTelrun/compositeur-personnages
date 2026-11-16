// Animations : clips PURS (aucun DOM, aucun three.js) → pose d'articulations à l'instant t ∈ [0, 1[ d'un cycle.
// Le rendu 3D (dessiner3D, dernier argument) applique cette pose ; le même clip sert donc à l'aperçu et à l'export.
// Angles en radians autour de l'axe X (avant/arrière du personnage) : positif = le segment part vers l'ARRIÈRE.
// Un genou ne plie que vers l'arrière (genou ≥ 0).

/** Durée (s) d'un cycle et nombre d'images conseillé pour l'export. */
export const CLIPS = {
  respire: { titre: 'Repos (respiration)', duree: 2.4, images: 8 },
  marche: { titre: 'Marche', duree: 0.9, images: 8 },
  danse: { titre: 'Danse', duree: 0.8, images: 8 },
};

const TAU = Math.PI * 2;

/**
 * Pose du clip `nom` à l'instant `t` (fraction de cycle, 0 ≤ t < 1) pour la géométrie `g` (cf. kit.geometrie).
 * Retourne { dy, hanche:{1,-1}, genou:{1,-1}, epaule:{1,-1}, bras? }.
 *  - dy : décalage vertical du corps (m) ; pour la marche il garde les pieds au sol malgré l'angle des jambes.
 *  - bras : angles latéraux de la pose (même format que kit.poses[...].bras) qui remplacent ceux de la recette.
 */
export function poseAnimee(nom, t, g) {
  const p = (t - Math.floor(t)) * TAU;
  const zero = { 1: 0, '-1': 0 };
  if (nom === 'marche') {
    const A = 0.5; // amplitude de la hanche (≈ 29°)
    const s = Math.sin(p), c = Math.cos(p);
    const hanche = { 1: -A * s, '-1': A * s }; // jambe qui avance = angle négatif
    const genou = { 1: 0.9 * Math.max(0, c), '-1': 0.9 * Math.max(0, -c) }; // plie quand la jambe revient vers l'avant
    // La jambe tendue raccourcit la hauteur de hanche de (1 − cos θ) : on abaisse le corps de ce qu'il faut.
    const dy = -g.hanchesY * (1 - Math.cos(A * Math.abs(s)));
    return { dy, hanche, genou, epaule: { 1: 0.45 * s, '-1': -0.45 * s } }; // bras en opposition aux jambes
  }
  if (nom === 'danse') {
    const s = Math.sin(p), c2 = Math.cos(2 * p);
    return {
      dy: (g.H * 0.012 * (1 - c2)) / 2, // rebond à double fréquence, jamais sous le sol
      hanche: { 1: -0.12 * s, '-1': 0.12 * s },
      genou: { 1: 0.25 * Math.max(0, s), '-1': 0.25 * Math.max(0, -s) },
      epaule: zero,
      bras: { 1: [112 + 22 * s, 168], '-1': [66 - 22 * s, 108] },
    };
  }
  // respire (défaut) : le corps monte et descend à peine ; les bras suivent avec un léger retard.
  const s = Math.sin(p);
  return { dy: (g.H * 0.004 * (1 + s)) / 2, hanche: zero, genou: zero, epaule: { 1: 0.03 * Math.sin(p - 0.6), '-1': -0.03 * Math.sin(p - 0.6) } };
}
