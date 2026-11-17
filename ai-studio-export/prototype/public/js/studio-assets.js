// Catalogue unifié d'assets 2D propres (silhouettes atelier3/atelier2 + visages/vêtements complets atelier2 + import perso)
// et gestion persistante des assets personnalisés / GLB dans IndexedDB.

const DB_NAME = 'compositeur-studio-db';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';
const STORE_GLBS = 'glbs';

export const CATEGORIES = [
  { id: 'corps', nom: 'Silhouettes', groupe: 'corps', hasColor: false, defaultTint: 'skin' },
  { id: 'tete', nom: 'Tête', groupe: 'visage', hasColor: false, defaultTint: 'skin' },
  { id: 'yeux', nom: 'Yeux', groupe: 'visage', hasColor: false, defaultTint: 'none' },
  { id: 'sourcils', nom: 'Sourcils', groupe: 'visage', hasColor: true, defaultTint: 'hair' },
  { id: 'nez', nom: 'Nez', groupe: 'visage', hasColor: false, defaultTint: 'skin' },
  { id: 'bouche', nom: 'Bouche', groupe: 'visage', hasColor: false, defaultTint: 'mouth' },
  { id: 'pilosite', nom: 'Barbe / Moustache', groupe: 'visage', hasColor: true, defaultTint: 'hair', optional: true },
  { id: 'cheveux', nom: 'Cheveux', groupe: 'visage', hasColor: true, defaultTint: 'hair' },
  { id: 'haut', nom: 'Hauts', groupe: 'tenue', hasColor: true, defaultTint: 'cloth' },
  { id: 'bas', nom: 'Bas', groupe: 'tenue', hasColor: true, defaultTint: 'cloth' },
  { id: 'chaussures', nom: 'Chaussures', groupe: 'tenue', hasColor: true, defaultTint: 'cloth' },
  { id: 'chapeau', nom: 'Chapeaux', groupe: 'tenue', hasColor: true, defaultTint: 'cloth', optional: true },
  { id: 'lunettes', nom: 'Lunettes', groupe: 'tenue', hasColor: false, defaultTint: 'none', optional: true },
];

export const PALETTE_PEAU = [
  '#fbe0cc', '#f5cba7', '#e8b48a', '#d39a6b',
  '#b9794a', '#8d5a3b', '#6b4128', '#4a2c1b',
];

export const PALETTE_CHEVEUX = [
  ['Noir', '#1e1a1a'],
  ['Brun foncé', '#4a3020'],
  ['Châtain', '#7a5233'],
  ['Blond doré', '#d9b36c'],
  ['Roux', '#b5502a'],
  ['Poivre & sel', '#8c8c94'],
  ['Platine', '#e8dec8'],
  ['Rose', '#e75a9a'],
  ['Bleu', '#3b7fd9'],
];

export const PALETTE_VETEMENTS = [
  '#ff6f61', '#ffd23f', '#1fb5c4', '#1f3a6b',
  '#f4f4f2', '#26262b', '#3aa05b', '#ff8fb3',
  '#ff9442', '#7a56c9', '#d9383a', '#c9b79c',
];

export const TETES_3D_DISPONIBLES = [
  { id: 'portrait-2d', nom: 'Portrait 2D projeté (fidèle)', mode: 'portrait' },
  { id: 'tete-ronde', nom: 'Maillage 3D · Femme ronde', mode: 'glb', src: '/etape2/tete-ronde.glb', coupe: 0.78, menton: 0.72 },
  { id: 'tete-homme', nom: 'Maillage 3D · Homme', mode: 'glb', src: '/etape2/tete-homme.glb', coupe: 0.78, menton: 0.72 },
  { id: 'tete-roux', nom: 'Maillage 3D · Jeune', mode: 'glb', src: '/etape2/tete-roux.glb', coupe: 0.78, menton: 0.72 },
  { id: 'tete-aine', nom: 'Maillage 3D · Senior', mode: 'glb', src: '/etape2/tete-aine.glb', coupe: 0.78, menton: 0.72 },
];

export const MATIERES_3D = [
  { id: 'uni', nom: 'Couleur unie', src: null },
  { id: 'denim', nom: 'Denim', src: '/matieres/tissu-denim.png', normale: '/matieres/tissu-denim-n.png', teintable: true },
  { id: 'lin', nom: 'Lin', src: '/matieres/tissu-lin.png', normale: '/matieres/tissu-lin-n.png', teintable: true },
  { id: 'maille', nom: 'Maille', src: '/matieres/tissu-maille.png', normale: '/matieres/tissu-maille-n.png', teintable: true },
  { id: 'rayures', nom: 'Rayures', src: '/matieres/tissu-rayures.png', normale: '/matieres/tissu-rayures-n.png', teintable: true },
  { id: 'vichy', nom: 'Vichy', src: '/matieres/tissu-vichy.png', normale: '/matieres/tissu-vichy-n.png', teintable: true },
  { id: 'tartan', nom: 'Tartan', src: '/matieres/tissu-tartan.png', normale: '/matieres/tissu-tartan-n.png', teintable: true },
  { id: 'hibiscus', nom: 'Hibiscus', src: '/matieres/imprimes/hibiscus-turquoise.png', teintable: false },
  { id: 'monstera', nom: 'Monstera', src: '/matieres/imprimes/monstera-marine.png', teintable: false },
  { id: 'ananas', nom: 'Ananas', src: '/matieres/imprimes/ananas-menthe.png', teintable: false },
];

// Repères normalisés [0..1] mesurés sur chaque silhouette (torse nu hors bras + envergure bras + hanches + pieds)
const ANCRES_SILHOUETTES_ATELIER3 = {
  moyenne: {
    nom: 'Moyenne (F)', genre: 'f', gabarit: 'moyen',
    landmarks: {
      centerX: 0.50, neckY: 0.165, shoulderY: 0.195,
      torsoW: 0.215, shoulderW: 0.295, shoulderSpanW: 0.355,
      waistY: 0.375, waistW: 0.220, hipY: 0.455, hipW: 0.315,
      kneeY: 0.695, feetY: 0.972, feetW: 0.365,
    },
    proportions3d: { hauteur: 1.68, epaules: 0.36, taille: 0.24, hanches: 0.35, membres: 1.0 },
  },
  forte: {
    nom: 'Forte (F)', genre: 'f', gabarit: 'rond',
    landmarks: {
      centerX: 0.50, neckY: 0.165, shoulderY: 0.195,
      torsoW: 0.275, shoulderW: 0.355, shoulderSpanW: 0.440,
      waistY: 0.375, waistW: 0.340, hipY: 0.460, hipW: 0.440,
      kneeY: 0.695, feetY: 0.973, feetW: 0.435,
    },
    proportions3d: { hauteur: 1.66, epaules: 0.41, taille: 0.38, hanches: 0.46, membres: 1.24 },
  },
  'moyen-h': {
    nom: 'Moyen (H)', genre: 'h', gabarit: 'moyen',
    landmarks: {
      centerX: 0.50, neckY: 0.160, shoulderY: 0.190,
      torsoW: 0.255, shoulderW: 0.345, shoulderSpanW: 0.400,
      waistY: 0.385, waistW: 0.245, hipY: 0.465, hipW: 0.315,
      kneeY: 0.700, feetY: 0.968, feetW: 0.405,
    },
    proportions3d: { hauteur: 1.76, epaules: 0.42, taille: 0.31, hanches: 0.33, membres: 1.06 },
  },
  athletique: {
    nom: 'Athlétique (H)', genre: 'h', gabarit: 'muscle',
    landmarks: {
      centerX: 0.50, neckY: 0.160, shoulderY: 0.190,
      torsoW: 0.275, shoulderW: 0.385, shoulderSpanW: 0.455,
      waistY: 0.385, waistW: 0.250, hipY: 0.465, hipW: 0.330,
      kneeY: 0.700, feetY: 0.970, feetW: 0.460,
    },
    proportions3d: { hauteur: 1.82, epaules: 0.47, taille: 0.30, hanches: 0.34, membres: 1.18 },
  },
};

const ANCRES_SILHOUETTES_ATELIER2 = {
  fine: {
    nom: 'Fine (F)', genre: 'f', gabarit: 'mince',
    landmarks: {
      centerX: 0.50, neckY: 0.032, shoulderY: 0.068,
      torsoW: 0.480, shoulderW: 0.640, shoulderSpanW: 0.750,
      waistY: 0.295, waistW: 0.450, hipY: 0.405, hipW: 0.650,
      kneeY: 0.680, feetY: 0.985, feetW: 0.740,
    },
    proportions3d: { hauteur: 1.70, epaules: 0.33, taille: 0.21, hanches: 0.31, membres: 0.90 },
  },
  courbes: {
    nom: 'Courbes (F)', genre: 'f', gabarit: 'moyen',
    landmarks: {
      centerX: 0.50, neckY: 0.032, shoulderY: 0.068,
      torsoW: 0.460, shoulderW: 0.610, shoulderSpanW: 0.710,
      waistY: 0.300, waistW: 0.460, hipY: 0.415, hipW: 0.720,
      kneeY: 0.680, feetY: 0.985, feetW: 0.710,
    },
    proportions3d: { hauteur: 1.66, epaules: 0.36, taille: 0.24, hanches: 0.40, membres: 1.04 },
  },
  'mince-h': {
    nom: 'Mince (H)', genre: 'h', gabarit: 'mince',
    landmarks: {
      centerX: 0.50, neckY: 0.032, shoulderY: 0.065,
      torsoW: 0.520, shoulderW: 0.680, shoulderSpanW: 0.780,
      waistY: 0.305, waistW: 0.440, hipY: 0.410, hipW: 0.550,
      kneeY: 0.680, feetY: 0.985, feetW: 0.770,
    },
    proportions3d: { hauteur: 1.80, epaules: 0.38, taille: 0.26, hanches: 0.30, membres: 0.92 },
  },
  'rond-h': {
    nom: 'Rond (H)', genre: 'h', gabarit: 'rond',
    landmarks: {
      centerX: 0.50, neckY: 0.035, shoulderY: 0.070,
      torsoW: 0.540, shoulderW: 0.680, shoulderSpanW: 0.780,
      waistY: 0.320, waistW: 0.610, hipY: 0.420, hipW: 0.670,
      kneeY: 0.680, feetY: 0.985, feetW: 0.800,
    },
    proportions3d: { hauteur: 1.74, epaules: 0.44, taille: 0.42, hanches: 0.41, membres: 1.20 },
  },
};

// ---------- IndexedDB ----------
function ouvrirDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_GLBS)) db.createObjectStore(STORE_GLBS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listerAssetsPerso() {
  try {
    const db = await ouvrirDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const req = tx.objectStore(STORE_ASSETS).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function sauverAssetPerso(asset) {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite');
    tx.objectStore(STORE_ASSETS).put(asset);
    tx.oncomplete = () => resolve(asset);
    tx.onerror = () => reject(tx.error);
  });
}

export async function supprimerAssetPerso(id) {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, 'readwrite');
    tx.objectStore(STORE_ASSETS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listerGlbsPerso() {
  try {
    const db = await ouvrirDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_GLBS, 'readonly');
      const req = tx.objectStore(STORE_GLBS).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function sauverGlbPerso(entry) {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GLBS, 'readwrite');
    tx.objectStore(STORE_GLBS).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Chargement & nettoyage d'images ----------
const imgCache = new Map();
export function chargerImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    im.src = src;
  });
  imgCache.set(src, p);
  return p;
}

export function imageVersCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

function defringeVert(d, strict = true) {
  const minDiff = strict ? 4 : 12;
  const eraseDiff = strict ? 24 : 42;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const diff = g - Math.max(r, b);
    if (diff > minDiff) {
      if (d[i + 3] < 220 || diff > eraseDiff) {
        d[i + 3] = 0;
      } else {
        if (strict && diff > 9) {
          const k = Math.max(0, 1 - (diff - 9) / 18);
          d[i + 3] = Math.round(d[i + 3] * k);
        }
        d[i + 1] = Math.round((r + b) * 0.48);
      }
    }
  }
}

/**
 * Supprime un léger liseré olive/jaune-vert sur le contour extérieur anti-aliasé des pièces PNG.
 */
function nettoyerContourOlive(d, w, h) {
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = d[p * 4 + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const a = alpha[p];
      if (a === 0) continue;
      const isEdge = alpha[p - 1] < 90 || alpha[p + 1] < 90 || alpha[p - w] < 90 || alpha[p + w] < 90;
      if (!isEdge) continue;
      const i = p * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (g > b + 15 && g >= r * 0.90) {
        d[i + 3] = a < 245 ? 0 : Math.round(a * 0.32);
      }
    }
  }
}

/**
 * Adoucit le bord extérieur des pixels peau au contact de la transparence
 * pour supprimer l'effet « timbre-poste » sur les yeux, le nez et la bouche.
 */
export function adoucirBordsPeau(d, w, h, passes = 3, filterFn = null) {
  const alphaCopy = new Uint8Array(w * h);
  for (let pass = 0; pass < passes; pass++) {
    for (let p = 0; p < w * h; p++) alphaCopy[p] = d[p * 4 + 3];
    const factor = 0.22 + (pass / Math.max(1, passes)) * 0.55;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const a = alphaCopy[p];
        if (a < 16) continue;
        if (filterFn && !filterFn(d, p * 4, x, y)) continue;
        const hasZeroNeighbor =
          alphaCopy[p - 1] < 40 || alphaCopy[p + 1] < 40 ||
          alphaCopy[p - w] < 40 || alphaCopy[p + w] < 40;
        if (hasZeroNeighbor) {
          d[p * 4 + 3] = Math.min(a, Math.round(a * factor));
        }
      }
    }
  }
}

/**
 * Supprime un fond uniforme (vert chroma #00FF00, blanc/clair ou couleur des coins)
 * avec adoucissement de bord et suppression du halo vert (defringe).
 */
export function nettoyerFondCanvas(sourceCanvas, mode = 'auto', tolerance = 42, cleanOliveEdge = false) {
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0);
  if (mode === 'none' && !cleanOliveEdge) return c;

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  if (mode !== 'none') {
    let transparents = 0;
    const step = Math.max(1, Math.floor((w * h) / 4000));
    let totalSampled = 0;
    for (let i = 0; i < d.length; i += 4 * step) {
      totalSampled++;
      if (d[i + 3] < 20) transparents++;
    }

    if (!(mode === 'auto' && transparents / Math.max(1, totalSampled) > 0.12)) {
      const corners = [
        [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
        [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
      ];
      let br = 0, bg = 0, bb = 0, bn = 0;
      for (const [cx, cy] of corners) {
        const idx = (Math.max(0, Math.min(h - 1, cy)) * w + Math.max(0, Math.min(w - 1, cx))) * 4;
        if (d[idx + 3] > 200) {
          br += d[idx]; bg += d[idx + 1]; bb += d[idx + 2]; bn++;
        }
      }
      if (bn > 0) {
        br /= bn; bg /= bn; bb /= bn;
        const isGreenScreen = mode === 'green' || (mode === 'auto' && bg > br + 30 && bg > bb + 30);
        const isLightBg = mode === 'light' || (mode === 'auto' && !isGreenScreen && br > 210 && bg > 210 && bb > 210);

        if (isGreenScreen || isLightBg) {
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const r = d[i], g = d[i + 1], b = d[i + 2];
            if (isGreenScreen) {
              const greenness = g - Math.max(r, b);
              if (greenness > tolerance * 0.72) {
                d[i + 3] = 0;
              } else if (greenness > 5) {
                const k = Math.max(0, Math.min(1, 1 - greenness / (tolerance * 0.72)));
                d[i + 3] = Math.round(d[i + 3] * k);
                d[i + 1] = Math.min(g, Math.round((r + b) * 0.48));
              }
            } else if (isLightBg) {
              const dist = Math.hypot(r - br, g - bg, b - bb);
              if (dist < tolerance * 0.75 && Math.max(r, g, b) > 195) {
                d[i + 3] = 0;
              } else if (dist < tolerance * 1.25 && Math.max(r, g, b) > 180) {
                const k = (dist - tolerance * 0.75) / (tolerance * 0.5);
                d[i + 3] = Math.round(d[i + 3] * Math.max(0, Math.min(1, k)));
              }
            }
          }
        }
      }
    }
  }

  defringeVert(d, true);
  if (cleanOliveEdge) nettoyerContourOlive(d, w, h);
  ctx.putImageData(imgData, 0, 0);
  return c;
}

// ---------- Planches Pixar haute qualité (etape2) ----------
export const ETAPE2_PIECES = {
  tete: [
    {
      id: 'e2:tete:roux2', nom: 'Pixar · Douce (rosée)', src: '/etape2/planche-roux2.png',
      rect: [548, 44, 923, 589], mentonRatio: 0.74, faceWFrac: 0.85,
      featureFracs: { brow: 0.435, eye: 0.56, nose: 0.71, mouth: 0.85 },
      defaultTint: 'skin',
    },
    {
      id: 'e2:tete:aine', nom: 'Pixar · Ovale mature', src: '/etape2/planche-aine.png',
      rect: [576, 80, 951, 621], mentonRatio: 0.74, faceWFrac: 0.85,
      featureFracs: { brow: 0.435, eye: 0.56, nose: 0.71, mouth: 0.85 },
      defaultTint: 'skin',
    },
    {
      id: 'e2:tete:senior', nom: 'Pixar · Sculptée senior', src: '/etape2/planche-senior.png',
      rect: [554, 32, 961, 579], mentonRatio: 0.78, faceWFrac: 0.86,
      featureFracs: { brow: 0.42, eye: 0.54, nose: 0.69, mouth: 0.845 },
      defaultTint: 'skin',
    },
  ],
  yeux: [
    { id: 'e2:yeux:roux2', nom: 'Pixar · Expressifs (cils)', src: '/etape2/planche-roux2.png', rect: [1012, 148, 1471, 274], wFrac: 0.68, defaultTint: 'none' },
    { id: 'e2:yeux:elements', nom: 'Pixar · Doux marron', src: '/etape2/planche-elements.png', rect: [1182, 148, 1473, 223], wFrac: 0.66, defaultTint: 'none' },
    { id: 'e2:yeux:aine', nom: 'Pixar · Pétillants', src: '/etape2/planche-aine.png', rect: [1058, 128, 1462, 247], wFrac: 0.68, defaultTint: 'eyelids' },
    { id: 'e2:yeux:homme', nom: 'Pixar · Ouverts neutres', src: '/etape2/planche-homme.png', rect: [579, 442, 884, 543], wFrac: 0.68, defaultTint: 'eyelids' },
    { id: 'e2:yeux:senior', nom: 'Pixar · Sages', src: '/etape2/planche-senior.png', rect: [84, 624, 416, 749], wFrac: 0.68, defaultTint: 'eyelids' },
  ],
  sourcils: [
    { id: 'e2:sourcils:elements', nom: 'Pixar · Naturels fournis', src: '/etape2/planche-elements.png', rect: [838, 158, 1105, 199], wFrac: 0.67, defaultTint: 'hair' },
    { id: 'e2:sourcils:roux2', nom: 'Pixar · Arqués doux', src: '/etape2/planche-roux2.png', rect: [1013, 365, 1467, 426], wFrac: 0.68, defaultTint: 'hair' },
    { id: 'e2:sourcils:aine', nom: 'Pixar · Souples', src: '/etape2/planche-aine.png', rect: [1028, 324, 1479, 388], wFrac: 0.68, defaultTint: 'hair' },
    { id: 'e2:sourcils:homme', nom: 'Pixar · Droits masculins', src: '/etape2/planche-homme.png', rect: [1000, 472, 1424, 543], wFrac: 0.68, defaultTint: 'hair' },
    { id: 'e2:sourcils:senior', nom: 'Pixar · Épais argentés', src: '/etape2/planche-senior.png', rect: [1043, 248, 1482, 332], wFrac: 0.69, defaultTint: 'none' },
  ],
  nez: [
    { id: 'e2:nez:elements', nom: 'Pixar · Petit doux', src: '/etape2/planche-elements.png', rect: [154, 422, 269, 503], wFrac: 0.25, defaultTint: 'skin' },
    { id: 'e2:nez:roux2', nom: 'Pixar · Fin retroussé', src: '/etape2/planche-roux2.png', rect: [144, 620, 285, 735], wFrac: 0.26, defaultTint: 'skin' },
    { id: 'e2:nez:aine', nom: 'Pixar · Arrondi doux', src: '/etape2/planche-aine.png', rect: [1178, 476, 1327, 601], wFrac: 0.27, defaultTint: 'skin' },
    { id: 'e2:nez:homme', nom: 'Pixar · Classique structuré', src: '/etape2/planche-homme.png', rect: [611, 626, 775, 794], wFrac: 0.28, defaultTint: 'skin' },
    { id: 'e2:nez:senior', nom: 'Pixar · Caractère', src: '/etape2/planche-senior.png', rect: [530, 618, 703, 783], wFrac: 0.30, defaultTint: 'skin' },
  ],
  bouche: [
    { id: 'e2:bouche:roux2', nom: 'Pixar · Sourire doux', src: '/etape2/planche-roux2.png', rect: [434, 668, 677, 763], wFrac: 0.36, defaultTint: 'mouth' },
    { id: 'e2:bouche:elements', nom: 'Pixar · Sourire naturel', src: '/etape2/planche-elements.png', rect: [472, 440, 685, 511], wFrac: 0.36, defaultTint: 'mouth' },
    { id: 'e2:bouche:aine', nom: 'Pixar · Sourire chaleureux', src: '/etape2/planche-aine.png', rect: [1112, 662, 1389, 749], wFrac: 0.37, defaultTint: 'mouth' },
    { id: 'e2:bouche:homme', nom: 'Pixar · Calme neutre', src: '/etape2/planche-homme.png', rect: [887, 688, 1106, 765], wFrac: 0.35, defaultTint: 'mouth' },
    { id: 'e2:bouche:senior', nom: 'Pixar · Fine sage', src: '/etape2/planche-senior.png', rect: [790, 672, 1017, 741], wFrac: 0.35, defaultTint: 'mouth' },
  ],
  pilosite: [
    { id: 'e2:pilosite:barbe', nom: 'Pixar · Barbe fournie', src: '/etape2/planche-homme.png', rect: [881, 105, 1228, 360], wFrac: 0.99, yFrac: 0.805, defaultTint: 'hair' },
    { id: 'e2:pilosite:moustache', nom: 'Pixar · Moustache fournie', src: '/etape2/planche-senior.png', rect: [1094, 644, 1477, 751], wFrac: 0.62, yFrac: 0.77, defaultTint: 'hair' },
  ],
  cheveux: [
    { id: 'e2:cheveux:roux2', nom: 'Pixar · Court texturé', src: '/etape2/planche-roux2.png', rect: [40, 50, 471, 397], wRel: 1.24, topRel: 0.145, defaultTint: 'hair' },
    { id: 'e2:cheveux:elements', nom: 'Pixar · Mi-long ondulé', src: '/etape2/planche-elements.png', rect: [404, 38, 765, 355], wRel: 1.88, topRel: 0.125, splitBackYFrac: 0.40, defaultTint: 'hair' },
    { id: 'e2:cheveux:homme', nom: 'Pixar · Court classique', src: '/etape2/planche-homme.png', rect: [303, 18, 674, 311], wRel: 1.14, topRel: 0.145, defaultTint: 'hair' },
    { id: 'e2:cheveux:aine', nom: 'Pixar · Bouclé volumineux', src: '/etape2/planche-aine.png', rect: [26, 76, 547, 517], wRel: 1.64, topRel: 0.125, splitBackYFrac: 0.42, defaultTint: 'hair' },
    { id: 'e2:cheveux:senior', nom: 'Pixar · Dégarni élégant', src: '/etape2/planche-senior.png', rect: [34, 82, 495, 427], wRel: 1.24, topRel: 0.155, defaultTint: 'hair' },
  ],
};

/**
 * Flood-fill depuis les bords pour supprimer uniquement le fond blanc extérieur
 * tout en préservant intégralement le blanc des yeux (sclère) ou des dents.
 */
function supprimerFondBlancExterieur(d, w, h, lumMin = 228, maxSat = 0.11) {
  const visited = new Uint8Array(w * h);
  const bg = new Uint8Array(w * h);
  const stack = [];
  const isLightNeutral = (p) => {
    const i = p * 4;
    if (d[i + 3] < 24) return true;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    const sat = (mx - mn) / Math.max(1, mx);
    return mn >= lumMin && sat <= maxSat;
  };
  const push = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isLightNeutral(p)) {
      bg[p] = 1;
      stack.push(p);
    }
  };

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x + 1 < w) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < h) push(x, y + 1);
  }

  for (let p = 0; p < w * h; p++) {
    if (bg[p]) {
      d[p * 4 + 3] = 0;
    }
  }

  // Anti-aliasing doux sur les pixels blancs adjacents au fond supprimé
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (bg[p]) continue;
      if (bg[p - 1] || bg[p + 1] || bg[p - w] || bg[p + w]) {
        const i = p * 4;
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const sat = (mx - mn) / Math.max(1, mx);
        if (mn > 200 && sat < 0.16) {
          const k = Math.max(0.15, Math.min(1, (248 - mn) / 48));
          d[i + 3] = Math.round(d[i + 3] * k);
        }
      }
    }
  }
}

/**
 * Adoucit le bord elliptique du nez ou de la bouche pour une fusion invisible sur le crâne.
 */
function fondreContourOval(d, w, h, topFadeFrac = 0.0) {
  const cx = w * 0.5, cy = h * 0.5;
  const rx = w * 0.48, ry = h * 0.48;
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) / ry;
    const topK = topFadeFrac > 0 ? Math.min(1, (y / Math.max(1, h * topFadeFrac))) : 1;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const dx = (x - cx) / rx;
      const dist = Math.hypot(dx, dy);
      let k = 1;
      if (dist > 0.72) {
        k = Math.max(0, Math.min(1, 1 - (dist - 0.72) / 0.28));
      }
      d[i + 3] = Math.round(d[i + 3] * Math.pow(k * topK, 0.85));
    }
  }
}

/**
 * Extrait et nettoie une pièce haute définition depuis une planche etape2 (fond blanc pur).
 */
export function extrairePieceEtape2(img, rect, cat, meta = null) {
  const [x0, y0, x1, y1] = rect;
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  supprimerFondBlancExterieur(d, w, h, cat === 'cheveux' || cat === 'pilosite' ? 232 : 226, 0.12);

  if (cat === 'tete') {
    const mentonRatio = meta?.mentonRatio ?? 0.74;
    const fade0 = Math.round(h * (mentonRatio + 0.04));
    const fade1 = Math.min(h, Math.round(h * (mentonRatio + 0.14)));
    for (let y = fade0; y < h; y++) {
      const t = Math.max(0, Math.min(1, (y - fade0) / Math.max(1, fade1 - fade0)));
      const aY = y >= fade1 ? 0 : Math.pow(1 - t, 1.25);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        d[i + 3] = Math.round(d[i + 3] * aY);
      }
    }
  } else if (cat === 'nez') {
    adoucirBordsPeau(d, w, h, 4);
    fondreContourOval(d, w, h, 0.26);
  } else if (cat === 'bouche') {
    adoucirBordsPeau(d, w, h, 3, (px, i) => {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      return !(r > g * 1.28 && (r - b) > 30);
    });
  } else if (cat === 'cheveux') {
    // Séparer la masse arrière/basse des coiffures mi-longues ou bouclées derrière la tête
    if (meta?.splitBackYFrac) {
      const ySplit = Math.round(h * meta.splitBackYFrac);
      const backCanvas = document.createElement('canvas');
      backCanvas.width = w; backCanvas.height = h;
      const bctx = backCanvas.getContext('2d', { willReadFrequently: true });
      const bd = bctx.createImageData(w, h);
      const bpx = bd.data;
      const cx = w * 0.5;
      for (let y = Math.max(0, ySplit - 6); y < h; y++) {
        const dy = Math.max(0, y - ySplit);
        const innerBand = w * (0.24 + Math.min(0.12, (dy / Math.max(1, h - ySplit)) * 0.12));
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3] === 0) continue;
          const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          if ((y >= ySplit && Math.abs(x - cx) < innerBand) || L < 26) {
            bpx[i] = d[i]; bpx[i + 1] = d[i + 1]; bpx[i + 2] = d[i + 2]; bpx[i + 3] = d[i + 3];
            d[i + 3] = 0;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      bctx.putImageData(bd, 0, 0);
      return { canvas: c, backHairCanvas: backCanvas };
    }
    adoucirBordsPeau(d, w, h, 1);
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
}

/**
 * Ajoute un léger relief chaleureux (fard joues + ombre arcade/menton) aux têtes unies atelier2.
 */
function ajouterReliefVisageDoux(d, w, h) {
  const lx = w * 0.27, rx = w * 0.73, cy = h * 0.56;
  const rad = w * 0.18;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 40) continue;
      const dl = Math.hypot(x - lx, (y - cy) * 1.25);
      const dr = Math.hypot(x - rx, (y - cy) * 1.25);
      const cheek = Math.max(
        Math.max(0, 1 - dl / rad),
        Math.max(0, 1 - dr / rad),
      );
      if (cheek > 0) {
        const strength = cheek * cheek * 0.14;
        d[i] = Math.min(255, Math.round(d[i] + 18 * strength * 4));
        d[i + 1] = Math.max(0, Math.round(d[i + 1] - 28 * strength * 2));
        d[i + 2] = Math.max(0, Math.round(d[i + 2] - 26 * strength * 2));
      }
      // Subtile ombre douce sous les sourcils (arcade orbitaire)
      const eyeY = h * 0.41;
      const eL = Math.hypot((x - w * 0.33) * 0.85, (y - eyeY) * 1.6);
      const eR = Math.hypot((x - w * 0.67) * 0.85, (y - eyeY) * 1.6);
      const socket = Math.max(
        Math.max(0, 1 - eL / (w * 0.15)),
        Math.max(0, 1 - eR / (w * 0.15)),
      );
      if (socket > 0) {
        const k = 1 - socket * socket * 0.065;
        d[i] = Math.round(d[i] * k);
        d[i + 1] = Math.round(d[i + 1] * k);
        d[i + 2] = Math.round(d[i + 2] * k);
      }
    }
  }
}

/**
 * Sépare le creux intérieur sombre du col d'un haut (t-shirt, chemise, pull, polo, sweat...)
 * vers un calque arrière `backCollarCanvas` dessiné derrière le cou du personnage,
 * par composante connexe 2D + fin rebord supérieur afin d'éviter toute entaille verticale.
 */
function separerColArriereHaut(frontCanvas) {
  const w = frontCanvas.width, h = frontCanvas.height;
  const fctx = frontCanvas.getContext('2d', { willReadFrequently: true });
  const fd = fctx.getImageData(0, 0, w, h);
  const d = fd.data;

  const backCanvas = document.createElement('canvas');
  backCanvas.width = w; backCanvas.height = h;
  const bctx = backCanvas.getContext('2d', { willReadFrequently: true });
  const bd = bctx.createImageData(w, h);
  const bpx = bd.data;

  const cx = Math.floor(w / 2);
  const xMin = Math.max(0, Math.floor(w * 0.32));
  const xMax = Math.min(w - 1, Math.ceil(w * 0.68));
  const halfSpan = Math.max(1, cx - xMin);
  const yMaxScan = Math.min(h - 1, Math.floor(h * 0.28));

  const isHollow = (p, x) => {
    const i = p * 4;
    if (d[i + 3] < 40) return false;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, r, g, b);
    const dist = Math.min(1, Math.abs(x - cx) / halfSpan);
    const maxL = 138 - dist * 22;
    return L < maxL && sat < 0.24;
  };

  // Amorcer uniquement depuis une zone creuse continue d'au moins 6 px au centre (évite le liseré tout en haut)
  const hollowMask = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const queue = [];
  for (let dx = -12; dx <= 12; dx += 4) {
    const sx = cx + dx;
    if (sx < xMin || sx > xMax) continue;
    let run = 0;
    for (let y = 6; y < yMaxScan; y++) {
      const p = y * w + sx;
      if (isHollow(p, sx)) {
        run++;
        if (run >= 6) {
          for (let k = 0; k < run; k++) {
            const sp = (y - k) * w + sx;
            if (!visited[sp]) {
              visited[sp] = 1;
              hollowMask[sp] = 1;
              queue.push(sp);
            }
          }
        }
      } else {
        run = 0;
      }
    }
  }
  while (queue.length) {
    const p = queue.pop();
    const x = p % w;
    const y = (p - x) / w;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < xMin || nx > xMax || ny < 0 || ny > yMaxScan) continue;
      const np = ny * w + nx;
      if (visited[np]) continue;
      visited[np] = 1;
      if (isHollow(np, nx)) {
        hollowMask[np] = 1;
        queue.push(np);
      }
    }
  }

  // Stopper sous le creux dès que la largeur retombe en dessous de 14 px (patte de boutonnage / zip)
  let mainStartY = -1;
  let widestSeen = false;
  for (let y = 0; y <= yMaxScan; y++) {
    let rowCount = 0;
    for (let x = xMin; x <= xMax; x++) {
      if (hollowMask[y * w + x]) rowCount++;
    }
    if (rowCount >= 14) {
      if (mainStartY === -1) mainStartY = y;
      widestSeen = true;
    } else if (widestSeen && rowCount < 14) {
      for (let yy = y; yy <= yMaxScan; yy++) {
        for (let x = xMin; x <= xMax; x++) hollowMask[yy * w + x] = 0;
      }
      break;
    }
  }

  let movedAny = 0;
  for (let x = xMin; x <= xMax; x++) {
    let hMinY = -1, hMaxY = -1;
    for (let y = 0; y <= yMaxScan; y++) {
      if (hollowMask[y * w + x]) {
        if (hMinY === -1) hMinY = y;
        hMaxY = y;
      }
    }
    if (hMinY === -1) continue;
    // Inclure uniquement le fin rebord supérieur du col arrière juste au-dessus du creux (max 5 px, sans mordre les pointes de col)
    let rimTop = hMinY;
    for (let y = hMinY - 1; y >= Math.max(0, hMinY - 5); y--) {
      if (d[(y * w + x) * 4 + 3] >= 40) rimTop = y;
      else break;
    }
    for (let y = rimTop; y <= hMaxY; y++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      bpx[i] = d[i];
      bpx[i + 1] = d[i + 1];
      bpx[i + 2] = d[i + 2];
      bpx[i + 3] = d[i + 3];
      d[i + 3] = 0;
      movedAny++;
    }
    for (let k = 1; k <= 2; k++) {
      const yy = hMaxY + k;
      if (yy < h) {
        const i = (yy * w + x) * 4;
        d[i + 3] = Math.round(d[i + 3] * (k === 1 ? 0.55 : 0.85));
      }
    }
  }

  if (movedAny < 40) return null;
  fctx.putImageData(fd, 0, 0);
  bctx.putImageData(bd, 0, 0);
  return backCanvas;
}

/**
 * Nettoie une pièce atelier2 (halo vert/olive + adoucissement d'intégration du nez/yeux/bouche
 * + suppression de l'ombre portée sous les chaussures + séparation du col arrière sur les hauts).
 */
export function nettoyerPieceAtelier2(img, cat, a2Meta = null) {
  const base = nettoyerFondCanvas(imageVersCanvas(img), 'auto', 42, true);
  const w = base.width, h = base.height;
  const ctx = base.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  if (cat === 'tete') {
    ajouterReliefVisageDoux(d, w, h);
    const hface = a2Meta?.hface ?? Math.round(h * 0.76);
    const fade0 = Math.round(hface + 12);
    const fade1 = Math.min(h, Math.round(hface + 36));
    for (let y = fade0; y < h; y++) {
      const t = Math.max(0, Math.min(1, (y - fade0) / Math.max(1, fade1 - fade0)));
      const aY = y >= fade1 ? 0 : Math.pow(1 - t, 1.2);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        d[i + 3] = Math.round(d[i + 3] * aY);
      }
    }
  } else if (cat === 'nez') {
    adoucirBordsPeau(d, w, h, 5);
    fondreContourOval(d, w, h, 0.24);
  } else if (cat === 'yeux') {
    adoucirBordsPeau(d, w, h, 3, (px, i) => {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      return r > g * 1.06 && g >= b && L > 95;
    });
  } else if (cat === 'bouche') {
    adoucirBordsPeau(d, w, h, 3, (px, i) => {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      return !(r > g * 1.36 && (r - b) > 42);
    });
  } else if (cat === 'chaussures') {
    // Supprimer l'ombre noire/grise entre les deux chaussures et sous les semelles
    const midX = w * 0.5;
    const gapHalf = w * 0.085;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = d[i + 3];
        if (a === 0) continue;
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const sat = (mx - mn) / Math.max(1, mx);
        const inCenterGap = Math.abs(x - midX) <= gapHalf;
        if ((mx < 40 && a < 225) || (inCenterGap && sat < 0.09 && a < 245)) {
          d[i + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  if (cat === 'haut') {
    const backCollar = separerColArriereHaut(base);
    if (backCollar) return { canvas: base, backCollarCanvas: backCollar };
  }
  return base;
}

export function rognerTransparent(sourceCanvas, pad = 2) {
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0 || y1 < y0) return sourceCanvas;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = nw; out.height = nh;
  out.getContext('2d').drawImage(sourceCanvas, x0, y0, nw, nh, 0, 0, nw, nh);
  return out;
}

/**
 * Synthétise un corps nu complet et sans couture à partir de `gabarit-natif.png` (tenue magenta)
 * ou d'un corps neutre (tenue grise), en préservant 100% de la silhouette extérieure.
 */
export function synthetiserCorpsNu(img, { cropHeadAtY = null, stripSuitMode = 'magenta', cleanOlive = false } = {}) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // 1. Mesurer la couleur médiane de la peau (jambes/bras hors tenue)
  const skinRs = [], skinGs = [], skinBs = [], skinLs = [];
  for (let y = Math.floor(h * 0.22); y < Math.floor(h * 0.92); y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 220) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, r, g, b);
      const isMagenta = (r - g) > 20 && (b - g) > 14;
      const isGrey = sat < 0.20;
      if (!isMagenta && !isGrey && r > g * 1.06 && g > b * 1.05 && r < 248) {
        skinRs.push(r); skinGs.push(g); skinBs.push(b);
        skinLs.push(0.299 * r + 0.587 * g + 0.114 * b);
      }
    }
  }
  const pct = (arr, q, def) => {
    if (!arr.length) return def;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * q))];
  };
  const sr = pct(skinRs, 0.72, 238), sg = pct(skinGs, 0.72, 192), sb = pct(skinBs, 0.72, 160);
  const refSkinLum = pct(skinLs, 0.72, 196);

  if (stripSuitMode === 'magenta' || stripSuitMode === 'grey') {
    const mask = new Uint8Array(w * h);
    let suitCount = 0;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (d[i + 3] < 80) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, r, g, b);
      const isSuit = stripSuitMode === 'magenta'
        ? ((r - g) > 14 && (b - g) > 9) || (r > 125 && b > 115 && g < Math.min(r, b) * 0.90)
        : (sat < 0.24 && r > 55 && r < 235);
      if (isSuit) {
        mask[p] = 1;
        suitCount++;
      }
    }
    if (suitCount > 0) {
      const suitVal = (r, g, b) => (stripSuitMode === 'magenta' ? (0.62 * r + 0.38 * b) : (0.299 * r + 0.587 * g + 0.114 * b));
      let suitValSum = 0;
      for (let p = 0; p < w * h; p++) {
        if (!mask[p]) continue;
        const i = p * 4;
        suitValSum += suitVal(d[i], d[i + 1], d[i + 2]);
      }
      const meanSuitVal = Math.max(60, suitValSum / suitCount);

      // Profil couleur réel juste en dessous de la tenue (par colonne x) pour raccorder les cuisses sans aucune démarcation
      const colBottomY = new Int16Array(w).fill(-1);
      const colSkinR = new Float32Array(w).fill(sr);
      const colSkinG = new Float32Array(w).fill(sg);
      const colSkinB = new Float32Array(w).fill(sb);
      for (let x = 0; x < w; x++) {
        let lastSuitY = -1;
        for (let y = Math.floor(h * 0.45); y < Math.floor(h * 0.72); y++) {
          if (mask[y * w + x]) lastSuitY = y;
        }
        if (lastSuitY > 0) {
          colBottomY[x] = lastSuitY;
          let ar = 0, ag = 0, ab = 0, an = 0;
          for (let y = lastSuitY + 3; y <= Math.min(h - 1, lastSuitY + 14); y++) {
            const p = y * w + x;
            if (mask[p] || d[p * 4 + 3] < 200) continue;
            ar += d[p * 4]; ag += d[p * 4 + 1]; ab += d[p * 4 + 2]; an++;
          }
          if (an > 0) {
            colSkinR[x] = ar / an;
            colSkinG[x] = ag / an;
            colSkinB[x] = ab / an;
          }
        }
      }

      const dil = new Uint8Array(w * h);
      for (let p = 0; p < w * h; p++) if (mask[p]) dil[p] = 3;
      for (let step = 2; step >= 1; step--) {
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const p = y * w + x;
            if (dil[p]) continue;
            if (dil[p - 1] > step || dil[p + 1] > step || dil[p - w] > step || dil[p + w] > step) {
              dil[p] = step;
            }
          }
        }
      }
      const exponent = stripSuitMode === 'grey' ? 0.28 : 0.34;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          const m = dil[p];
          if (!m) continue;
          const i = p * 4;
          if (d[i + 3] < 20) continue;
          const v = suitVal(d[i], d[i + 1], d[i + 2]);
          const shade = Math.pow(Math.max(0.84, Math.min(1.08, v / meanSuitVal)), exponent);
          // Aux cuisses, rejoindre doucement la teinte + modelé exact de la jambe nue juste dessous
          let tr = sr * shade, tg = sg * shade, tb = sb * shade;
          const botY = colBottomY[x];
          if (botY > 0 && y <= botY + 2) {
            const distFromHem = Math.max(0, botY - y);
            const thighK = Math.max(0, Math.min(1, 1 - distFromHem / 85));
            tr = tr * (1 - thighK) + colSkinR[x] * (0.94 + 0.06 * shade) * thighK;
            tg = tg * (1 - thighK) + colSkinG[x] * (0.94 + 0.06 * shade) * thighK;
            tb = tb * (1 - thighK) + colSkinB[x] * (0.94 + 0.06 * shade) * thighK;
          }
          const blend = m === 3 ? 1.0 : m === 2 ? 0.88 : 0.55;
          d[i] = Math.min(255, Math.round(d[i] * (1 - blend) + tr * blend));
          d[i + 1] = Math.min(255, Math.round(d[i + 1] * (1 - blend) + tg * blend));
          d[i + 2] = Math.min(255, Math.round(d[i + 2] * (1 - blend) + tb * blend));
        }
      }

      // Lissage local large (rayon 5 px) sur toutes les frontières tenue/peau pour effacer ourlets & bretelles
      const seamMask = new Uint8Array(w * h);
      for (let y = 5; y < h - 5; y++) {
        for (let x = 5; x < w - 5; x++) {
          const p = y * w + x;
          if (d[p * 4 + 3] < 160) continue;
          const m = dil[p];
          const nearBorder =
            dil[p - 3] !== m || dil[p + 3] !== m || dil[p - 4 * w] !== m || dil[p + 4 * w] !== m ||
            dil[p - 6 * w] !== m || dil[p + 6 * w] !== m;
          if (nearBorder) seamMask[p] = 1;
        }
      }
      const snap = new Uint8ClampedArray(d);
      for (let y = 5; y < h - 5; y++) {
        for (let x = 5; x < w - 5; x++) {
          const p = y * w + x;
          if (!seamMask[p]) continue;
          let ar = 0, ag = 0, ab = 0, an = 0;
          for (let dy = -5; dy <= 5; dy += 2) {
            for (let dx = -5; dx <= 5; dx += 2) {
              const q = (y + dy) * w + (x + dx);
              if (snap[q * 4 + 3] < 200) continue;
              const weight = seamMask[q] ? 0.40 : 1.0;
              ar += snap[q * 4] * weight;
              ag += snap[q * 4 + 1] * weight;
              ab += snap[q * 4 + 2] * weight;
              an += weight;
            }
          }
          if (an > 0) {
            const i = p * 4;
            d[i] = Math.round(ar / an);
            d[i + 1] = Math.round(ag / an);
            d[i + 2] = Math.round(ab / an);
          }
        }
      }
    }
  }

  // Supprimer la tête intégrée tout en conservant le cou anatomique complet jusqu'à l'intérieur de la mâchoire
  if (cropHeadAtY !== null && cropHeadAtY > 0) {
    const yCut = Math.round(cropHeadAtY);
    for (let y = 0; y < Math.min(h, yCut + 10); y++) {
      const fade = y < yCut ? 0 : (y - yCut) / 10;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        d[i + 3] = Math.round(d[i + 3] * fade);
      }
    }
  }

  defringeVert(d, true);
  if (cleanOlive) nettoyerContourOlive(d, w, h);
  ctx.putImageData(imgData, 0, 0);
  return { canvas: c, skinRgb: [sr, sg, sb], lumPeau: refSkinLum };
}

// ---------- Chargement du catalogue complet ----------
export async function chargerCatalogueComplet() {
  const [placement, base2, pieces2] = await Promise.all([
    fetch('/atelier3/placement.json').then((r) => r.json()),
    fetch('/atelier2/base.json').then((r) => r.json()),
    fetch('/atelier2/pieces.json').then((r) => r.json()),
  ]);

  const parCategorie = Object.fromEntries(CATEGORIES.map((c) => [c.id, []]));

  // 1. Silhouettes : atelier3 (mains/pieds nets, sans marque de short gris) + atelier2 (silhouettes complémentaires)
  for (const [id, info] of Object.entries(ANCRES_SILHOUETTES_ATELIER3)) {
    const pl = placement.silhouettes[id];
    parCategorie.corps.push({
      id: `a3:${id}`,
      nom: info.nom,
      source: 'atelier3',
      silId: id,
      genre: info.genre,
      gabarit: info.gabarit,
      src: `/atelier3/corps/${id}/gabarit-natif.png`,
      thumbSrc: `/atelier3/corps/${id}/gabarit-natif.png`,
      stripSuitMode: 'magenta',
      placement: pl,
      buste: placement.buste,
      landmarks: info.landmarks,
      proportions3d: info.proportions3d,
      hasAttachedHead: false,
      defaultTint: 'skin',
    });
  }
  for (const [id, info] of Object.entries(ANCRES_SILHOUETTES_ATELIER2)) {
    parCategorie.corps.push({
      id: `a2:${id}`,
      nom: info.nom,
      source: 'atelier2',
      silId: id,
      genre: info.genre,
      gabarit: info.gabarit,
      src: `/atelier2/corps/${id}.png`,
      thumbSrc: `/atelier2/corps/${id}.png`,
      stripSuitMode: 'grey',
      a2Meta: pieces2.corps?.[id] ?? null,
      landmarks: info.landmarks,
      proportions3d: info.proportions3d,
      hasAttachedHead: false,
      defaultTint: 'skin',
    });
  }

  // 2. Têtes haute qualité (Pixar etape2 en premier, puis formes complémentaires atelier2)
  for (const e of ETAPE2_PIECES.tete) {
    parCategorie.tete.push({
      id: e.id,
      nom: e.nom,
      source: 'etape2',
      src: e.src,
      thumbSrc: e.src,
      rect: e.rect,
      mentonRatio: e.mentonRatio,
      faceWFrac: e.faceWFrac,
      featureFracs: e.featureFracs,
      defaultTint: e.defaultTint,
    });
  }
  for (const v of base2.categories.tete.variantes) {
    const f = v.calques?.[0]?.fichier;
    if (!f) continue;
    parCategorie.tete.push({
      id: `a2:tete:${v.id}`,
      nom: `${v.nom} (simple)`,
      source: 'atelier2',
      src: `/atelier2/${f}`,
      thumbSrc: `/atelier2/${f}`,
      a2Meta: pieces2.tete?.[v.id] ?? null,
      defaultTint: 'skin',
    });
  }

  // 3. Visage, Pilosité & Coiffures (pièces Pixar etape2 en premier + complémentaires atelier2)
  for (const cat of ['yeux', 'sourcils', 'nez', 'bouche', 'pilosite', 'cheveux']) {
    if (cat === 'pilosite') {
      parCategorie.pilosite.push({
        id: 'pilosite:aucun',
        nom: 'Aucune pilosité',
        source: 'builtin-none',
        src: null,
        thumbSrc: null,
        defaultTint: 'none',
      });
    }
    for (const e of ETAPE2_PIECES[cat] ?? []) {
      parCategorie[cat].push({
        id: e.id,
        nom: e.nom,
        source: 'etape2',
        src: e.src,
        thumbSrc: e.src,
        rect: e.rect,
        wFrac: e.wFrac,
        yFrac: e.yFrac,
        wRel: e.wRel,
        topRel: e.topRel,
        splitBackYFrac: e.splitBackYFrac,
        defaultTint: e.defaultTint,
      });
    }
    if (cat === 'pilosite') continue;
    for (const v of base2.categories[cat]?.variantes ?? []) {
      const f = v.calques?.[0]?.fichier;
      if (!f) continue;
      parCategorie[cat].push({
        id: `a2:${cat}:${v.id}`,
        nom: v.nom,
        pieceKey: v.id,
        source: 'atelier2',
        genre: v.genre ?? '*',
        src: `/atelier2/${f}`,
        thumbSrc: `/atelier2/${f}`,
        a2Meta: pieces2[cat]?.[v.id] ?? null,
        defaultTint: cat === 'cheveux' ? 'hair' : cat === 'nez' ? 'skin' : cat === 'yeux' ? 'eyelids' : cat === 'bouche' ? 'mouth' : 'none',
      });
    }
  }

  // 4. Vêtements & Chaussures propres d'atelier2 (pièces complètes, sans découpe cuisse ou chaussure cassée)
  for (const catId of ['haut', 'bas', 'chaussures']) {
    for (const v of base2.categories[catId]?.variantes ?? []) {
      const f = v.calques?.[0]?.fichier;
      if (!f) continue;
      parCategorie[catId].push({
        id: `a2:${catId}:${v.id}`,
        nom: v.nom,
        pieceKey: v.id,
        source: 'atelier2',
        genre: v.genre ?? '*',
        src: `/atelier2/${f}`,
        thumbSrc: `/atelier2/${f}`,
        a2Meta: pieces2[catId]?.[v.id] ?? null,
        defaultTint: v.id === 'paille' ? 'none' : 'cloth',
      });
    }
  }

  // 5. Chapeaux & Lunettes (atelier2, option « Aucun » en premier)
  for (const catId of ['chapeau', 'lunettes']) {
    parCategorie[catId].push({
      id: `${catId}:aucun`,
      nom: catId === 'chapeau' ? 'Aucun chapeau' : 'Aucune lunette',
      source: 'builtin-none',
      src: null,
      thumbSrc: null,
      defaultTint: 'none',
    });
    for (const v of base2.categories[catId]?.variantes ?? []) {
      const f = v.calques?.[0]?.fichier;
      if (!f) continue;
      parCategorie[catId].push({
        id: `a2:${catId}:${v.id}`,
        nom: v.nom,
        pieceKey: v.id,
        source: 'atelier2',
        src: `/atelier2/${f}`,
        thumbSrc: `/atelier2/${f}`,
        defaultTint: v.id === 'paille' ? 'none' : (catId === 'chapeau' ? 'cloth' : 'none'),
      });
    }
  }

  // 6. Charger les assets personnalisés importés par l'utilisateur depuis IndexedDB
  const persos = await listerAssetsPerso();
  for (const a of persos) {
    if (parCategorie[a.categorie]) {
      parCategorie[a.categorie].unshift({ ...a, source: 'custom' });
    }
  }

  const glbsPerso = await listerGlbsPerso();

  return {
    placement,
    parCategorie,
    glbsPerso,
  };
}
