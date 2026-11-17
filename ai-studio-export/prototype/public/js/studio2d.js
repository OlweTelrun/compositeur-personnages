// Moteur de composition 2D haute qualité :
// - Toile maître canonique 560 × 840 px alignée sur studio-gabarit.js
// - Synthèse de corps nu sans trous ni traces de tenue sous-jacente
// - Dégraissage olive strict et adoucissement peau sur yeux / nez / bouche
// - Placement exact par repères de silhouette (corps atelier3/atelier2, gabarit strict 560×840, imports perso)
// - Rendu de texture visage isolée pour la projection 3D + export sprite 256×256

import {
  chargerImage,
  extrairePieceEtape2,
  imageVersCanvas,
  nettoyerFondCanvas,
  nettoyerPieceAtelier2,
  synthetiserCorpsNu,
} from './studio-assets.js';
import { dessinerGrilleGabaritSurCanvas } from './studio-gabarit.js';

export const SCENE_W = 560;
export const SCENE_H = 840;
export const SOL_Y = 812;

const processedCache = new Map();
const tintCache = new Map();

export function viderCacheRendu2D() {
  processedCache.clear();
  tintCache.clear();
}

function hexToRgb(hex) {
  const clean = (hex || '#888888').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function mesurerCouleurPeauMoyenne(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  const d = ctx.getImageData(0, 0, w, h).data;
  const rs = [], gs = [], bs = [];
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] < 200) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    if (L > 85 && L < 245 && r >= g && g >= b * 0.92) {
      rs.push(r); gs.push(g); bs.push(b);
    }
  }
  if (!rs.length) return [232, 182, 146];
  const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  return [med(rs), med(gs), med(bs)];
}

async function obtenirSourcePropre(asset, cat = null) {
  if (!asset || !asset.src) return null;
  const key = `${asset.id}|${cat || ''}|${asset.src}|${asset.stripSuitMode || ''}|${asset.bgMode || ''}`;
  if (processedCache.has(key)) return processedCache.get(key);

  const img = await chargerImage(asset.src);

  if (asset.source === 'etape2' && asset.rect) {
    const extracted = extrairePieceEtape2(img, asset.rect, cat, asset);
    const canvas = extracted?.canvas ?? extracted;
    const backHairCanvas = extracted?.backHairCanvas ?? null;
    const skinRgb = mesurerCouleurPeauMoyenne(canvas);
    const lumPeau = mesurerLuminancePeau(canvas);
    const lum = mesurerLuminanceMoyenne(canvas);
    const res = { canvas, backHairCanvas, lum, lumPeau, skinRgb };
    processedCache.set(key, res);
    return res;
  }

  if (asset.source === 'atelier3' && asset.silId) {
    const menton = asset.buste?.menton ?? 525;
    const cropY = asset.placement ? Math.max(0, asset.placement.oy + (menton - 145) * asset.placement.echelle_tete) : null;
    const res = synthetiserCorpsNu(img, {
      stripSuitMode: asset.stripSuitMode ?? 'magenta',
      cropHeadAtY: cropY,
      cleanOlive: false,
    });
    processedCache.set(key, res);
    return res;
  }

  if (asset.source === 'atelier2' && asset.silId) {
    const res = synthetiserCorpsNu(img, {
      stripSuitMode: asset.stripSuitMode ?? 'grey',
      cropHeadAtY: null,
      cleanOlive: true,
    });
    processedCache.set(key, res);
    return res;
  }

  if (asset.source === 'atelier2') {
    const cleaned = nettoyerPieceAtelier2(img, cat, asset.a2Meta ?? null);
    const canvas = cleaned?.canvas ?? cleaned;
    const backCollarCanvas = cleaned?.backCollarCanvas ?? null;
    const lumPeau = asset.a2Meta?.lum_peau ?? mesurerLuminancePeau(canvas);
    const lum = asset.a2Meta?.lum ?? mesurerLuminanceMoyenne(canvas);
    const skinRgb = (cat === 'tete' || cat === 'nez') ? mesurerCouleurPeauMoyenne(canvas) : null;
    const res = { canvas, backCollarCanvas, lum, lumPeau, skinRgb };
    processedCache.set(key, res);
    return res;
  }

  if (asset.source === 'custom' && asset.silId) {
    const cleaned = nettoyerFondCanvas(imageVersCanvas(img), asset.bgMode ?? 'auto', 42, true);
    if (asset.stripSuitMode && asset.stripSuitMode !== 'none') {
      const res = synthetiserCorpsNu(cleaned, {
        stripSuitMode: asset.stripSuitMode,
        cropHeadAtY: asset.hasAttachedHead ? null : (asset.landmarks?.neckY ?? 0.16) * cleaned.height,
        cleanOlive: true,
      });
      processedCache.set(key, res);
      return res;
    }
    const res = { canvas: cleaned, lumPeau: mesurerLuminancePeau(cleaned), skinRgb: mesurerCouleurPeauMoyenne(cleaned) };
    processedCache.set(key, res);
    return res;
  }

  const canvas = nettoyerFondCanvas(imageVersCanvas(img), asset.bgMode ?? 'auto', 42, true);
  const lumPeau = mesurerLuminancePeau(canvas);
  const lum = mesurerLuminanceMoyenne(canvas);
  const res = { canvas, lum, lumPeau, skinRgb: mesurerCouleurPeauMoyenne(canvas) };
  processedCache.set(key, res);
  return res;
}

function mesurerLuminancePeau(canvas, region = null, minL = 70) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  const d = ctx.getImageData(0, 0, w, h).data;
  const x0 = region ? Math.max(0, region.x0) : 0;
  const y0 = region ? Math.max(0, region.y0) : 0;
  const x1 = region ? Math.min(w, region.x1) : w;
  const y1 = region ? Math.min(h, region.y1) : h;
  const ls = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 200) {
        const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (L >= minL) ls.push(L);
      }
    }
  }
  if (!ls.length) return 180;
  ls.sort((a, b) => a - b);
  return ls[Math.floor(ls.length / 2)];
}

function mesurerLuminanceMoyenne(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] > 180) {
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++;
    }
  }
  return n ? sum / n : 140;
}

export function teinterCanvas(sourceCanvas, hex, mode, lumRef = 170, cacheKey = '', srcSkinRgb = null) {
  if (!mode || mode === 'none') return sourceCanvas;
  const fullKey = cacheKey ? `${cacheKey}|${hex}|${mode}|${Math.round(lumRef)}` : '';
  if (fullKey && tintCache.has(fullKey)) return tintCache.get(fullKey);

  const w = sourceCanvas.width, h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const [tr, tg, tb] = hexToRgb(hex);

  if (mode === 'skin') {
    const ref = Math.max(80, lumRef || 180);
    const [sr, sg, sb] = srcSkinRgb ?? [ref, ref * 0.80, ref * 0.66];
    const rr = tr / Math.max(40, sr);
    const rg = tg / Math.max(35, sg);
    const rb = tb / Math.max(30, sb);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      const f = Math.pow(L / ref, 0.90);
      const lr = tr * f, lg = tg * f, lb = tb * f;
      const cr = r * rr, cg = g * rg, cb = b * rb;
      // Préserver le fard des joues et les nuances chaudes du nez/oreilles tout en suivant le teint choisi
      d[i] = Math.max(0, Math.min(255, Math.round(lr * 0.35 + cr * 0.65)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(lg * 0.35 + cg * 0.65)));
      d[i + 2] = Math.max(0, Math.min(255, Math.round(lb * 0.35 + cb * 0.65)));
    }
  } else if (mode === 'eyelids') {
    const ref = Math.max(80, lumRef || 180);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = (mx - mn) / Math.max(mx, 1);
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      const isSkin = sat > 0.12 && sat < 0.72 && r > g * 1.06 && g >= b && L > 0.34 * ref;
      if (!isSkin) continue;
      const f = Math.pow(L / ref, 0.9);
      d[i] = Math.min(255, Math.round(tr * f));
      d[i + 1] = Math.min(255, Math.round(tg * f));
      d[i + 2] = Math.min(255, Math.round(tb * f));
    }
  } else if (mode === 'mouth') {
    const ref = Math.max(80, lumRef || 180);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = (mx - mn) / Math.max(mx, 1);
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      const isLip = r > g * 1.18 && (r - b) > 24;
      const isTeeth = sat < 0.20 && L > 145;
      const isDarkInner = L < 65;
      const isSkinHalo = !isLip && !isTeeth && !isDarkInner && sat > 0.12 && r > g * 1.06 && g > b && L > 0.42 * ref;
      if (!isSkinHalo) continue;
      const f = Math.pow(L / ref, 0.9);
      d[i] = Math.min(255, Math.round(tr * f));
      d[i + 1] = Math.min(255, Math.round(tg * f));
      d[i + 2] = Math.min(255, Math.round(tb * f));
    }
  } else if (mode === 'hair' || mode === 'cloth') {
    const ref = Math.max(46, lumRef || 140);
    const exp = mode === 'hair' ? 0.80 : 0.88;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = (mx - mn) / Math.max(mx, 1);
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      const wNeutral = mode === 'cloth'
        ? Math.max(0.30, Math.min(1, 1 - (sat - 0.12) / 0.25))
        : 1;
      const f = Math.pow(L / ref, exp);
      const nr = Math.min(255, tr * f);
      const ng = Math.min(255, tg * f);
      const nb = Math.min(255, tb * f);
      d[i] = Math.round(r * (1 - wNeutral) + nr * wNeutral);
      d[i + 1] = Math.round(g * (1 - wNeutral) + ng * wNeutral);
      d[i + 2] = Math.round(b * (1 - wNeutral) + nb * wNeutral);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  if (fullKey) {
    if (tintCache.size > 240) tintCache.clear();
    tintCache.set(fullKey, out);
  }
  return out;
}

/**
 * Calcule les rectangles et repères anatomiques du personnage actif sur 560 × 840 px.
 */
async function calculerGeometrieScene(catalogue, etat) {
  const silAsset = catalogue.parCategorie.corps.find((a) => a.id === etat.layers.corps.assetId)
    ?? catalogue.parCategorie.corps[0];
  const silSrc = await obtenirSourcePropre(silAsset, 'corps');
  const bw = silSrc.canvas.width, bh = silSrc.canvas.height;
  const lm = silAsset.landmarks;

  let bodyScale, bodyX, bodyY;
  if (silAsset.alignMode === 'gabarit') {
    bodyScale = SCENE_W / bw;
    bodyX = 0;
    bodyY = 0;
  } else if (silAsset.source === 'atelier3') {
    const targetTotalH = 748;
    bodyScale = targetTotalH / bh;
    bodyX = SCENE_W / 2 - (bw * bodyScale) * lm.centerX;
    bodyY = SOL_Y - bh * bodyScale * lm.feetY;
  } else {
    const span = Math.max(0.3, lm.feetY - lm.neckY);
    const targetBodySpan = 610;
    bodyScale = targetBodySpan / (bh * span);
    bodyX = SCENE_W / 2 - (bw * bodyScale) * lm.centerX;
    bodyY = SOL_Y - bh * bodyScale * lm.feetY;
  }

  const bodyW = bw * bodyScale;
  const bodyH = bh * bodyScale;
  const ptX = (nx) => bodyX + nx * bodyW;
  const ptY = (ny) => bodyY + ny * bodyH;

  // Géométrie de la tête (centrée sur le haut du cou, au-dessus du col des hauts)
  const headAsset = catalogue.parCategorie.tete.find((a) => a.id === etat.layers.tete.assetId)
    ?? catalogue.parCategorie.tete[0];
  const headSrc = await obtenirSourcePropre(headAsset, 'tete');

  let headRect;
  if (headAsset.alignMode === 'gabarit') {
    headRect = {
      x: 0,
      y: 0,
      w: SCENE_W,
      h: SCENE_H,
      sc: SCENE_W / headSrc.canvas.width,
      cx: SCENE_W / 2,
      topY: 66,
      chinY: 186,
      faceW: 100,
      featureFracs: { brow: 0.375, eye: 0.495, nose: 0.655, mouth: 0.82 },
    };
  } else {
    const hw = headSrc.canvas.width, hh = headSrc.canvas.height;
    const meta = headAsset.a2Meta;
    const targetFaceH = headAsset.source === 'etape2' ? 118 : 114;
    const hfaceNative = headAsset.source === 'etape2'
      ? Math.round(hh * (headAsset.mentonRatio ?? 0.74))
      : (meta?.hface ?? Math.round(hh * 0.76));
    const sc = targetFaceH / hfaceNative;
    const drawW = hw * sc;
    const drawH = hh * sc;
    const cx = ptX(lm.centerX);
    const cxLocal = meta?.cx_tete ? meta.cx_tete * sc : drawW / 2;
    const faceW = headAsset.source === 'etape2'
      ? drawW * (headAsset.faceWFrac ?? 0.85)
      : (meta?.wmax ? meta.wmax * sc : drawW * 0.88);

    // Positionner le menton ~13 px au-dessus de la ligne cou/col pour dégager le cou tout en chevauchant le cou du corps
    const anchorNeckY = silAsset.source === 'atelier3' && silAsset.placement
      ? (bodyY + (silAsset.placement.oy + (silAsset.buste?.menton ?? 525) * silAsset.placement.echelle_tete) * bodyScale)
      : ptY(lm.neckY);
    const neckClearance = silAsset.source === 'atelier3' ? 13 : 10;
    const hy = anchorNeckY - targetFaceH - neckClearance;

    headRect = {
      x: cx - cxLocal,
      y: hy,
      w: drawW,
      h: drawH,
      sc,
      cx,
      topY: hy + targetFaceH * 0.02,
      chinY: hy + targetFaceH,
      faceW,
      featureFracs: headAsset.featureFracs ?? { brow: 0.375, eye: 0.495, nose: 0.655, mouth: 0.82 },
    };
  }

  return {
    silAsset,
    silSrc,
    bodyScale,
    bodyRect: { x: bodyX, y: bodyY, w: bodyW, h: bodyH },
    anchors: {
      cx: ptX(lm.centerX),
      neckY: ptY(lm.neckY),
      shoulderY: ptY(lm.shoulderY),
      torsoW: (lm.torsoW ?? lm.shoulderW * 0.76) * bodyW,
      shoulderW: lm.shoulderW * bodyW,
      shoulderSpanW: (lm.shoulderSpanW ?? lm.shoulderW * 1.15) * bodyW,
      waistY: ptY(lm.waistY),
      waistW: lm.waistW * bodyW,
      hipY: ptY(lm.hipY),
      hipW: lm.hipW * bodyW,
      kneeY: ptY(lm.kneeY),
      feetY: ptY(lm.feetY),
      feetW: (lm.feetW ?? lm.hipW * 1.05) * bodyW,
    },
    headAsset,
    headSrc,
    headRect,
  };
}

/**
 * Calcule le rectangle [x, y, w, h] par défaut d'un calque avant les décalages manuels.
 */
function calculerRectBaseCalque(cat, asset, srcCanvas, geo) {
  const { bodyRect, anchors, headRect } = geo;
  const iw = srcCanvas.width, ih = srcCanvas.height;
  const ratio = ih / Math.max(1, iw);

  // Calque dessiné directement sur le gabarit maître 560 × 840 px : 0 décalage
  if (asset.alignMode === 'gabarit') {
    return { x: 0, y: 0, w: SCENE_W, h: SCENE_H };
  }

  if (cat === 'corps') return { ...bodyRect };
  if (cat === 'tete') return { x: headRect.x, y: headRect.y, w: headRect.w, h: headRect.h };

  // Pièces de visage, pilosité & coiffures
  if (['yeux', 'sourcils', 'nez', 'bouche', 'pilosite', 'cheveux'].includes(cat)) {
    const faceH = headRect.chinY - headRect.topY;
    const faceW = headRect.faceW;
    const fr = headRect.featureFracs ?? { brow: 0.375, eye: 0.495, nose: 0.655, mouth: 0.82 };

    if (asset.source === 'etape2') {
      if (cat === 'cheveux') {
        const w = faceW * (asset.wRel ?? 1.24);
        const h = w * ratio;
        return {
          x: headRect.cx - w / 2,
          y: headRect.topY - h * (asset.topRel ?? 0.14),
          w,
          h,
        };
      }
      const keyMap = { yeux: 'eye', sourcils: 'brow', nez: 'nose', bouche: 'mouth', pilosite: 'mouth' };
      let w = faceW * (asset.wFrac ?? 0.44);
      let h = w * ratio;
      if (cat === 'nez' && h > faceH * 0.20) {
        h = faceH * 0.20;
        w = h / ratio;
      }
      const yFrac = asset.yFrac ?? fr[keyMap[cat]] ?? 0.5;
      return {
        x: headRect.cx - w / 2,
        y: headRect.topY + faceH * yFrac - h / 2,
        w,
        h,
      };
    }

    if (asset.source === 'atelier2') {
      if (cat === 'cheveux') {
        const headRefScale = (faceW / 205) * 0.96 + (headRect.sc * 0.04);
        const w = iw * Math.min(headRefScale, faceW / 182);
        const h = w * ratio;
        return {
          x: headRect.cx - w / 2,
          y: headRect.topY - faceH * 0.125,
          w,
          h,
        };
      }
      const wFracs = { yeux: 0.39, sourcils: 0.43, nez: 0.19, bouche: 0.27 };
      const yFracs = { yeux: fr.eye, sourcils: fr.brow, nez: fr.nose, bouche: fr.mouth };
      let w = faceW * (wFracs[cat] ?? 0.39);
      let h = w * ratio;
      if (cat === 'nez' && h > faceH * 0.19) {
        h = faceH * 0.19;
        w = h / ratio;
      }
      return {
        x: headRect.cx - w / 2,
        y: headRect.topY + faceH * (yFracs[cat] ?? 0.5) - h / 2,
        w,
        h,
      };
    }

    // Assets importés librement (mode Auto/rogné)
    const presets = {
      yeux: { wFrac: 0.44, yFrac: fr.eye },
      sourcils: { wFrac: 0.46, yFrac: fr.brow },
      nez: { wFrac: 0.21, yFrac: fr.nose },
      bouche: { wFrac: 0.29, yFrac: fr.mouth },
      pilosite: { wFrac: 0.65, yFrac: 0.78 },
      cheveux: { wFrac: 1.25, yFrac: 0.30 },
    };
    const p = presets[cat] ?? { wFrac: 0.45, yFrac: 0.5 };
    const w = faceW * p.wFrac;
    const h = w * ratio;
    return {
      x: headRect.cx - w / 2,
      y: headRect.topY + faceH * p.yFrac - h / 2,
      w,
      h,
    };
  }

  // Hauts & Robes (calés sur le rapport réel épaules/largeur de chaque patron atelier2)
  if (cat === 'haut') {
    const key = asset.pieceKey ?? '';
    const isRobe = key === 'robe';
    const isSleeveless = key === 'debardeur' || key === 'bikini' || isRobe;
    const shoulderMultByKey = {
      chemise: 1.48,
      sweat: 1.62,
      pull: 1.44,
      blouse: 1.42,
      tshirt: 1.28,
      polo: 1.28,
    };

    let w;
    if (isSleeveless) {
      w = anchors.torsoW * (key === 'bikini' ? 1.18 : 1.12);
    } else {
      w = anchors.shoulderSpanW * (shoulderMultByKey[key] ?? 1.34);
    }
    const targetH = isRobe
      ? (anchors.kneeY - anchors.shoulderY) * 1.04
      : key === 'bikini'
        ? w * ratio
        : Math.max(w * ratio, (anchors.hipY - anchors.shoulderY) * 0.90);
    const shoulderStartByKey = {
      blouse: 0.055,
      debardeur: 0.06,
      robe: 0.06,
      tshirt: 0.085,
      pull: 0.105,
      polo: 0.12,
      chemise: 0.145,
      sweat: 0.185,
    };
    const drawW = isRobe ? targetH / ratio : w;
    return {
      x: anchors.cx - drawW / 2,
      y: anchors.shoulderY - targetH * (shoulderStartByKey[key] ?? 0.105),
      w: drawW,
      h: targetH,
    };
  }

  // Bas, Shorts, Jupes & Pantalons
  if (cat === 'bas') {
    const key = asset.pieceKey ?? '';
    const isLongPant = key === 'pantalon' || key === 'jean' || key === 'legging';
    const isLongSkirt = key === 'jupe-longue';
    const targetW = isLongPant
      ? Math.max(anchors.hipW * 1.12, (anchors.feetW ?? anchors.hipW) * 0.88)
      : isLongSkirt
        ? anchors.hipW * 1.16
        : anchors.hipW * 1.12;
    const maxH = isLongPant
      ? (anchors.feetY - anchors.waistY - 12)
      : (anchors.feetY - anchors.waistY) * 0.92;
    const w = targetW;
    const h = Math.min(w * ratio, maxH);
    return {
      x: anchors.cx - w / 2,
      y: anchors.waistY + (isLongPant ? 2 : 6),
      w,
      h,
    };
  }

  // Chaussures (proportionnées à la taille réelle des pieds, sans remonter sur le tibia)
  if (cat === 'chaussures') {
    const key = asset.pieceKey ?? '';
    const isTallBoot = key === 'bottines' || key === 'hautes';
    const w = (anchors.feetW ?? anchors.hipW) * 0.96;
    const h = Math.min(w * ratio * (isTallBoot ? 0.68 : 0.56), isTallBoot ? 92 : 68);
    return {
      x: anchors.cx - w / 2,
      y: anchors.feetY + 8 - h,
      w,
      h,
    };
  }

  if (cat === 'chapeau') {
    const isLarge = asset.pieceKey === 'paille' || asset.pieceKey === 'capeline';
    const w = headRect.faceW * (isLarge ? 1.76 : 1.28);
    const h = w * ratio;
    return {
      x: headRect.cx - w / 2,
      y: headRect.topY - h * 0.65,
      w,
      h,
    };
  }

  if (cat === 'lunettes') {
    const w = headRect.faceW * 0.86;
    const h = w * ratio;
    const fr = headRect.featureFracs ?? { eye: 0.495 };
    const eyeY = headRect.topY + (headRect.chinY - headRect.topY) * fr.eye;
    return {
      x: headRect.cx - w / 2,
      y: eyeY - h / 2,
      w,
      h,
    };
  }

  return { x: anchors.cx - 80, y: anchors.waistY - 80, w: 160, h: 160 * ratio };
}

const ORDRE_DEFAUT = [
  'haut-col', 'corps', 'chaussures', 'bas', 'haut', 'cheveux-arriere', 'tete',
  'nez', 'bouche', 'pilosite', 'yeux', 'sourcils', 'cheveux', 'lunettes', 'chapeau',
];

/**
 * Calcule tous les calques résolus avec leurs boîtes finales (pour le rendu ET la sélection interactive).
 */
export async function resoudreCalques(catalogue, etat) {
  const geo = await calculerGeometrieScene(catalogue, etat);
  const ordre = [...ORDRE_DEFAUT].sort((a, b) => {
    const keyA = a === 'haut-col' ? 'haut' : a === 'cheveux-arriere' ? 'cheveux' : a;
    const keyB = b === 'haut-col' ? 'haut' : b === 'cheveux-arriere' ? 'cheveux' : b;
    const za = ORDRE_DEFAUT.indexOf(a) + (etat.layers[keyA]?.zOffset ?? 0);
    const zb = ORDRE_DEFAUT.indexOf(b) + (etat.layers[keyB]?.zOffset ?? 0);
    return za - zb;
  });

  const resolved = [];
  for (const cat of ordre) {
    const isBackCollar = cat === 'haut-col';
    const isBackHair = cat === 'cheveux-arriere';
    const baseCat = isBackCollar ? 'haut' : isBackHair ? 'cheveux' : cat;
    const layerState = etat.layers[baseCat];
    if (!layerState || layerState.visible === false) continue;
    const list = catalogue.parCategorie[baseCat] ?? [];
    const asset = list.find((a) => a.id === layerState.assetId);
    if (!asset || !asset.src) continue;
    if (baseCat === 'tete' && geo.silAsset.hasAttachedHead) continue;

    const srcInfo = baseCat === 'corps' ? geo.silSrc : baseCat === 'tete' ? geo.headSrc : await obtenirSourcePropre(asset, baseCat);
    const chosenCanvas = isBackCollar
      ? srcInfo?.backCollarCanvas
      : isBackHair
        ? srcInfo?.backHairCanvas
        : srcInfo?.canvas;
    if (!chosenCanvas) continue;

    const tintMode = layerState.tintMode ?? asset.defaultTint ?? 'none';
    let targetHex = layerState.color;
    let lumRef = srcInfo.lum ?? srcInfo.lumPeau ?? 175;
    let srcSkinRgb = srcInfo.skinRgb ?? geo.headSrc.skinRgb ?? null;
    if (tintMode === 'skin' || tintMode === 'eyelids' || tintMode === 'mouth') {
      targetHex = etat.personne.peau;
      if (baseCat === 'corps') {
        lumRef = geo.silSrc.lumPeau;
        srcSkinRgb = geo.silSrc.skinRgb;
      } else if (baseCat === 'tete') {
        lumRef = geo.headSrc.lumPeau;
        srcSkinRgb = geo.headSrc.skinRgb;
      } else if (baseCat === 'nez') {
        lumRef = srcInfo.lum || geo.headSrc.lumPeau;
        srcSkinRgb = srcInfo.skinRgb || geo.headSrc.skinRgb;
      } else {
        lumRef = geo.headSrc.lumPeau;
      }
    } else if (tintMode === 'hair') {
      targetHex = etat.personne.cheveux;
    }

    const tintedCanvas = teinterCanvas(
      chosenCanvas,
      targetHex,
      tintMode,
      lumRef,
      `${asset.id}|${cat}|${geo.silAsset.id}`,
      srcSkinRgb,
    );

    const baseRect = calculerRectBaseCalque(baseCat, asset, tintedCanvas, geo);
    const sx = layerState.scaleX ?? 1;
    const sy = layerState.scaleY ?? 1;
    const w = baseRect.w * sx;
    const h = baseRect.h * sy;
    const cx = baseRect.x + baseRect.w / 2 + (layerState.offsetX ?? 0);
    const cy = baseRect.y + baseRect.h / 2 + (layerState.offsetY ?? 0);

    resolved.push({
      cat,
      asset,
      canvas: tintedCanvas,
      rect: { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy },
      rotation: layerState.rotation ?? 0,
      flipX: !!layerState.flipX,
      opacity: layerState.opacity ?? 1,
    });
  }

  return { geo, calques: resolved };
}

export async function dessinerScene2D(canvas, catalogue, etat, options = {}) {
  const { showGuides = false, selectedCat = null, calibratingSil = false } = options;
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / SCENE_W;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { geo, calques } = await resoudreCalques(catalogue, etat);
  const shoeItem = calques.find((c) => c.cat === 'chaussures');
  const isClosedShoe = shoeItem && !['tongs', 'sandales'].includes(shoeItem.asset.pieceKey);

  for (const item of calques) {
    if (item.cat === 'chaussures' && isClosedShoe) {
      // Masquer intégralement la pointe et le bord externe des pieds nus sous la chaussure fermée
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      const rx = (shoeItem.rect.x - 10) * scale;
      const rw = (shoeItem.rect.w + 20) * scale;
      const ry = (shoeItem.rect.y + shoeItem.rect.h * 0.44) * scale;
      const rh = (shoeItem.rect.h * 0.68 + 18) * scale;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();
    }
    const { rect, rotation, flipX, opacity } = item;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(rect.cx * scale, rect.cy * scale);
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(item.canvas, (-rect.w / 2) * scale, (-rect.h / 2) * scale, rect.w * scale, rect.h * scale);
    ctx.restore();
  }

  if (showGuides || calibratingSil) {
    dessinerGrilleGabaritSurCanvas(ctx, scale, geo, calibratingSil);
  }
  if (selectedCat && !calibratingSil) {
    const sel = calques.find((c) => c.cat === selectedCat);
    if (sel) {
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = Math.max(1.5, 2 * scale);
      ctx.setLineDash([6 * scale, 4 * scale]);
      ctx.strokeRect(sel.rect.x * scale, sel.rect.y * scale, sel.rect.w * scale, sel.rect.h * scale);
      ctx.restore();
    }
  }

  return { geo, calques };
}

/**
 * Rendu isolé des traits du visage (sourcils, yeux, nez, bouche, pilosité) sur fond transparent
 * pour projection sans couture sur le crâne 3D.
 */
export async function genererTextureVisage2D(catalogue, etat, size = 512) {
  const etatVisage = {
    personne: etat.personne,
    layers: {
      corps: etat.layers.corps,
      tete: etat.layers.tete,
      nez: etat.layers.nez,
      bouche: etat.layers.bouche,
      pilosite: etat.layers.pilosite,
      yeux: etat.layers.yeux,
      sourcils: etat.layers.sourcils,
    },
  };
  const { geo, calques } = await resoudreCalques(catalogue, etatVisage);
  const featuresOnly = calques.filter((c) => ['nez', 'bouche', 'pilosite', 'yeux', 'sourcils'].includes(c.cat));

  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const ctx = out.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const hr = geo.headRect;
  const faceH = hr.chinY - hr.topY;
  const fr = hr.featureFracs ?? { brow: 0.375, eye: 0.495, nose: 0.655, mouth: 0.82 };
  const cy = hr.topY + faceH * ((fr.brow + fr.mouth) * 0.5 + 0.02);
  const span = Math.max(hr.faceW * 1.18, faceH * 0.78);
  const sc = (size * 0.72) / span;

  for (const item of featuresOnly) {
    const { rect, rotation, flipX, opacity } = item;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(size / 2 + (rect.cx - hr.cx) * sc, size / 2 + (rect.cy - cy) * sc);
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(item.canvas, (-rect.w / 2) * sc, (-rect.h / 2) * sc, rect.w * sc, rect.h * sc);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const rad = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.48);
  rad.addColorStop(0, 'rgba(0,0,0,1)');
  rad.addColorStop(0.75, 'rgba(0,0,0,0.92)');
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  return out;
}

/**
 * Exporte le personnage au cadrage exact du jeu (256×256 transparent, pieds à y=247, hauteur ~225 px).
 */
export async function exporterSpriteJeu256(catalogue, etat) {
  const hd = document.createElement('canvas');
  hd.width = SCENE_W * 2;
  hd.height = SCENE_H * 2;
  await dessinerScene2D(hd, catalogue, etat);

  const ctx = hd.getContext('2d', { willReadFrequently: true });
  const { data, width, height } = ctx.getImageData(0, 0, hd.width, hd.height);
  let x0 = width, x1 = 0, y0 = height, y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const out = document.createElement('canvas');
  out.width = 256; out.height = 256;
  if (x1 >= x0 && y1 >= y0) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const ech = Math.min(225 / h, 248 / w);
    out.getContext('2d').drawImage(hd, x0, y0, w, h, 128 - (w * ech) / 2, 247 - h * ech, w * ech, h * ech);
  }
  return out;
}
