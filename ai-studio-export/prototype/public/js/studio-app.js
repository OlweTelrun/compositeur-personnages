import {
  CATEGORIES,
  PALETTE_PEAU,
  PALETTE_CHEVEUX,
  PALETTE_VETEMENTS,
  TETES_3D_DISPONIBLES,
  MATIERES_3D,
  chargerCatalogueComplet,
  sauverAssetPerso,
  supprimerAssetPerso,
  sauverGlbPerso,
  chargerImage,
  imageVersCanvas,
  nettoyerFondCanvas,
  rognerTransparent,
  synthetiserCorpsNu,
} from './studio-assets.js';
import {
  SCENE_W,
  SCENE_H,
  dessinerScene2D,
  exporterSpriteJeu256,
  viderCacheRendu2D,
} from './studio2d.js';
import {
  GABARIT_SPEC,
  telechargerGabaritPng,
  telechargerGabaritSvg,
} from './studio-gabarit.js';
import { Studio3DViewer } from './studio3d.js';

const $ = (id) => document.getElementById(id);
const STATE_KEY = 'compositeur-studio-state-v2';

let catalogue = await chargerCatalogueComplet();
let activeCat = 'corps';
let viewMode = 'split'; // '2d' | '3d' | 'split'
let showGuides = false;
let calibratingSil = false;
let showGamePreview = true;
let bgMode = 'checker'; // 'checker' | 'studio'
let verrous = {};
let planche = [];
let viewer3d = null;
let matiereHaut = 'uni';
let matiereBas = 'uni';
let head3dMode = 'portrait-2d';
let selectedCustomGlbId = null;

function creerEtatParDefaut() {
  const pick = (cat, prefId) => {
    const list = catalogue.parCategorie[cat] ?? [];
    return (prefId && list.find((a) => a.id === prefId)?.id) || list[0]?.id || null;
  };
  return {
    personne: {
      peau: PALETTE_PEAU[2],
      cheveux: PALETTE_CHEVEUX[2][1],
    },
    layers: {
      corps: { assetId: pick('corps', 'a3:moyenne'), tintMode: 'skin', color: PALETTE_PEAU[2], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      tete: { assetId: pick('tete', 'e2:tete:roux2'), tintMode: 'skin', color: PALETTE_PEAU[2], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      yeux: { assetId: pick('yeux', 'e2:yeux:roux2'), tintMode: 'none', color: PALETTE_PEAU[2], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      sourcils: { assetId: pick('sourcils', 'e2:sourcils:elements'), tintMode: 'hair', color: PALETTE_CHEVEUX[2][1], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      nez: { assetId: pick('nez', 'e2:nez:elements'), tintMode: 'skin', color: PALETTE_PEAU[2], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      bouche: { assetId: pick('bouche', 'e2:bouche:roux2'), tintMode: 'mouth', color: '#c85b5b', offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      pilosite: { assetId: pick('pilosite', 'pilosite:aucun'), tintMode: 'hair', color: PALETTE_CHEVEUX[2][1], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      cheveux: { assetId: pick('cheveux', 'e2:cheveux:roux2'), tintMode: 'hair', color: PALETTE_CHEVEUX[2][1], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      haut: { assetId: pick('haut', 'a2:haut:tshirt'), tintMode: 'cloth', color: PALETTE_VETEMENTS[0], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      bas: { assetId: pick('bas', 'a2:bas:short'), tintMode: 'cloth', color: PALETTE_VETEMENTS[3], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      chaussures: { assetId: pick('chaussures', 'a2:chaussures:baskets'), tintMode: 'cloth', color: PALETTE_VETEMENTS[4], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      chapeau: { assetId: pick('chapeau', 'chapeau:aucun'), tintMode: 'cloth', color: PALETTE_VETEMENTS[1], offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
      lunettes: { assetId: pick('lunettes', 'lunettes:aucun'), tintMode: 'none', color: '#1f2937', offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, opacity: 1, zOffset: 0, visible: true },
    },
  };
}

let etat = creerEtatParDefaut();
try {
  const saved = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null');
  if (saved?.etat?.layers?.corps && saved?.etat?.personne) {
    const defaut = creerEtatParDefaut();
    etat = saved.etat;
    verrous = saved.verrous ?? {};
    planche = saved.planche ?? [];
    if (saved.viewMode) viewMode = saved.viewMode;
    // Migrer automatiquement d'anciens IDs retirés vers les pièces propres équivalentes
    for (const cat of Object.keys(defaut.layers)) {
      const l = etat.layers[cat];
      const list = catalogue.parCategorie[cat] ?? [];
      if (!l || !l.assetId || !list.some((a) => a.id === l.assetId)) {
        etat.layers[cat] = { ...(l ?? defaut.layers[cat]), assetId: defaut.layers[cat].assetId };
      }
    }
    if (etat.layers.bouche?.tintMode === 'none') {
      etat.layers.bouche.tintMode = 'mouth';
    }
  }
} catch {
  // stockage indisponible
}

function sauverLocal() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ etat, verrous, planche, viewMode }));
  } catch {
    // quota ou mode privé
  }
}

function setStatus(msg) {
  $('statusLine').textContent = msg;
}

// ---------- Initialisation 3D ----------
function init3DIfVisible() {
  if (viewMode === '2d') return;
  if (!viewer3d) {
    viewer3d = new Studio3DViewer($('canvas3d'), setStatus);
  }
}

let sync3dTimer = null;
function schedule3DSync() {
  if (viewMode === '2d') return;
  init3DIfVisible();
  clearTimeout(sync3dTimer);
  sync3dTimer = setTimeout(() => {
    const customGlb = catalogue.glbsPerso.find((g) => g.id === selectedCustomGlbId) ?? null;
    viewer3d?.syncFromState(catalogue, etat, {
      headMode: head3dMode,
      customGlb,
      matiereHaut,
      matiereBas,
    });
  }, 60);
}

// ---------- Rendu 2D ----------
let render2dToken = 0;
async function rendre2D() {
  const tok = ++render2dToken;
  const cv = $('canvas2d');
  const { geo } = await dessinerScene2D(cv, catalogue, etat, {
    showGuides,
    selectedCat: activeCat,
    calibratingSil,
  });
  if (tok !== render2dToken) return;

  const list = catalogue.parCategorie;
  const activeCount = Object.values(etat.layers).filter((l) => l.visible !== false && l.assetId && !l.assetId.endsWith(':aucun')).length;
  $('metaLine').textContent = `${geo.silAsset.nom} · ${Math.round(geo.bodyRect.w)}×${Math.round(geo.bodyRect.h)} px · ${activeCount} calques actifs`;

  if (showGamePreview) {
    const sprite = await exporterSpriteJeu256(catalogue, etat);
    if (tok !== render2dToken) return;
    for (const [id, size] of [['game40', 40], ['game128', 128]]) {
      const c = $(id);
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(sprite, 0, 0, size, size);
    }
  }
}

function majTout() {
  sauverLocal();
  rendre2D();
  schedule3DSync();
  renderInspector();
  renderAssetGrid();
  renderPlanche();
}

// ---------- Interface : Catégories & Grille d'assets ----------
function renderCategories() {
  const el = $('catGrid');
  el.textContent = '';
  for (const cat of CATEGORIES) {
    const b = document.createElement('button');
    b.className = 'cat-btn';
    b.textContent = cat.nom;
    b.setAttribute('aria-pressed', String(activeCat === cat.id));
    b.onclick = () => {
      activeCat = cat.id;
      calibratingSil = false;
      renderCategories();
      renderAssetGrid();
      renderInspector();
      rendre2D();
    };
    el.append(b);
  }
}

function choisirAsset(cat, asset) {
  const layer = etat.layers[cat];
  const prevAsset = (catalogue.parCategorie[cat] ?? []).find((a) => a.id === layer.assetId);
  layer.assetId = asset.id;
  if (asset.defaultTint) {
    if (asset.source === 'custom' && asset.defaultTint === 'none') {
      layer.tintMode = 'none';
    } else if (!prevAsset || prevAsset.source !== 'custom') {
      layer.tintMode = asset.defaultTint;
    }
  }
  majTout();
}

function renderAssetGrid() {
  const catDef = CATEGORIES.find((c) => c.id === activeCat);
  const list = catalogue.parCategorie[activeCat] ?? [];
  const curId = etat.layers[activeCat]?.assetId;

  $('catCurrentTitle').textContent = `${catDef.nom} (${list.length})`;
  const lockBtn = $('btnLockCat');
  lockBtn.setAttribute('aria-pressed', String(!!verrous[activeCat]));
  lockBtn.textContent = verrous[activeCat] ? 'Verrouillé' : 'Verrouiller';

  const grid = $('assetGrid');
  grid.textContent = '';

  // Filtrage intelligent optionnel : pour haut/bas/chaussures, afficher en priorité ceux de la silhouette active + universels/perso
  const silAsset = catalogue.parCategorie.corps.find((a) => a.id === etat.layers.corps.assetId);
  const sorted = [...list].sort((a, b) => {
    const score = (x) => {
      if (x.source === 'custom') return 0;
      if (x.source === 'builtin-none') return 1;
      if (x.source === 'etape2') return 2;
      if (silAsset?.silId && x.nativeSil === silAsset.silId) return 3;
      if (x.source === 'atelier2') return 4;
      return 5;
    };
    return score(a) - score(b);
  });

  for (const asset of sorted) {
    const card = document.createElement('button');
    card.className = 'asset-card';
    card.type = 'button';
    card.setAttribute('aria-pressed', String(curId === asset.id));
    card.onclick = () => choisirAsset(activeCat, asset);

    const thumb = document.createElement('div');
    thumb.className = 'asset-thumb';
    if (asset.source === 'etape2' && asset.rect && asset.src) {
      const tc = document.createElement('canvas');
      tc.width = 72; tc.height = 72;
      thumb.append(tc);
      chargerImage(asset.src).then((im) => {
        const [x0, y0, x1, y1] = asset.rect;
        const rw = x1 - x0, rh = y1 - y0;
        const sc = Math.min(64 / Math.max(1, rw), 64 / Math.max(1, rh));
        const dw = rw * sc, dh = rh * sc;
        tc.getContext('2d').drawImage(im, x0, y0, rw, rh, (72 - dw) / 2, (72 - dh) / 2, dw, dh);
      }).catch(() => {});
    } else if (asset.thumbSrc) {
      const im = document.createElement('img');
      im.src = asset.thumbSrc;
      im.alt = asset.nom;
      im.loading = 'lazy';
      thumb.append(im);
    } else {
      thumb.textContent = '—';
    }

    const name = document.createElement('span');
    name.className = 'asset-name';
    name.textContent = asset.nativeSil && silAsset?.silId !== asset.nativeSil
      ? `${asset.nom} (${asset.nativeSil})`
      : asset.nom;

    card.append(thumb, name);

    if (asset.source === 'custom') {
      const del = document.createElement('button');
      del.className = 'asset-del';
      del.type = 'button';
      del.title = 'Supprimer cet asset';
      del.textContent = '×';
      del.onclick = async (e) => {
        e.stopPropagation();
        await supprimerAssetPerso(asset.id);
        catalogue = await chargerCatalogueComplet();
        if (etat.layers[activeCat].assetId === asset.id) {
          etat.layers[activeCat].assetId = catalogue.parCategorie[activeCat][0]?.id ?? null;
        }
        majTout();
      };
      card.append(del);
    }

    grid.append(card);
  }
}

function renderSwatches() {
  const skinRow = $('skinSwatches');
  skinRow.textContent = '';
  for (const hex of PALETTE_PEAU) {
    const b = document.createElement('button');
    b.className = 'swatch-btn';
    b.style.background = hex;
    b.title = hex;
    b.setAttribute('aria-pressed', String(etat.personne.peau.toLowerCase() === hex.toLowerCase()));
    b.onclick = () => {
      etat.personne.peau = hex;
      $('skinPicker').value = hex;
      majTout();
    };
    skinRow.append(b);
  }
  $('skinPicker').value = etat.personne.peau;

  const hairRow = $('hairSwatches');
  hairRow.textContent = '';
  for (const [label, hex] of PALETTE_CHEVEUX) {
    const b = document.createElement('button');
    b.className = 'swatch-btn';
    b.style.background = hex;
    b.title = label;
    b.setAttribute('aria-pressed', String(etat.personne.cheveux.toLowerCase() === hex.toLowerCase()));
    b.onclick = () => {
      etat.personne.cheveux = hex;
      $('hairPicker').value = hex;
      majTout();
    };
    hairRow.append(b);
  }
  $('hairPicker').value = etat.personne.cheveux;
}

// ---------- Rail droit : Inspecteur de calque & calibration silhouette ----------
function renderInspector() {
  const catDef = CATEGORIES.find((c) => c.id === activeCat);
  const layer = etat.layers[activeCat];
  $('inspectorTitle').textContent = `Réglages : ${catDef.nom}`;

  $('layerVisible').checked = layer.visible !== false;
  $('layerTintMode').value = layer.tintMode ?? 'none';
  $('layerColor').value = layer.color || '#ff6f61';
  $('layerColor').disabled = !['cloth', 'hair', 'skin'].includes($('layerTintMode').value);

  const setRange = (id, valId, val, fmt = (v) => String(v)) => {
    $(id).value = String(val);
    $(valId).textContent = fmt(val);
  };
  setRange('rOffsetX', 'vOffsetX', layer.offsetX ?? 0, (v) => `${Math.round(v)} px`);
  setRange('rOffsetY', 'vOffsetY', layer.offsetY ?? 0, (v) => `${Math.round(v)} px`);
  setRange('rScale', 'vScale', layer.scaleX ?? 1, (v) => `${Number(v).toFixed(2)}×`);
  setRange('rRot', 'vRot', layer.rotation ?? 0, (v) => `${Math.round(v)}°`);
  $('layerFlipX').checked = !!layer.flipX;

  // Calibration de silhouette si activeCat === 'corps'
  const silBox = $('silCalibratorBox');
  const silAsset = catalogue.parCategorie.corps.find((a) => a.id === etat.layers.corps.assetId);
  if (activeCat === 'corps' && silAsset) {
    silBox.hidden = false;
    const lm = silAsset.landmarks;
    setRange('lmNeckY', 'vLmNeckY', lm.neckY, (v) => v.toFixed(2));
    setRange('lmShoulderY', 'vLmShoulderY', lm.shoulderY, (v) => v.toFixed(2));
    setRange('lmShoulderW', 'vLmShoulderW', lm.shoulderW, (v) => v.toFixed(2));
    setRange('lmWaistY', 'vLmWaistY', lm.waistY, (v) => v.toFixed(2));
    setRange('lmHipW', 'vLmHipW', lm.hipW, (v) => v.toFixed(2));
    setRange('lmFeetY', 'vLmFeetY', lm.feetY, (v) => v.toFixed(2));
  } else {
    silBox.hidden = true;
  }

  renderSwatches();
}

function bindInspectorEvents() {
  $('layerVisible').onchange = (e) => { etat.layers[activeCat].visible = e.target.checked; majTout(); };
  $('layerTintMode').onchange = (e) => { etat.layers[activeCat].tintMode = e.target.value; majTout(); };
  $('layerColor').oninput = (e) => {
    etat.layers[activeCat].color = e.target.value;
    if (activeCat === 'cheveux') etat.personne.cheveux = e.target.value;
    majTout();
  };
  $('layerFlipX').onchange = (e) => { etat.layers[activeCat].flipX = e.target.checked; majTout(); };

  $('rOffsetX').oninput = (e) => { etat.layers[activeCat].offsetX = Number(e.target.value); majTout(); };
  $('rOffsetY').oninput = (e) => { etat.layers[activeCat].offsetY = Number(e.target.value); majTout(); };
  $('rScale').oninput = (e) => {
    const v = Number(e.target.value);
    etat.layers[activeCat].scaleX = v;
    etat.layers[activeCat].scaleY = v;
    majTout();
  };
  $('rRot').oninput = (e) => { etat.layers[activeCat].rotation = Number(e.target.value); majTout(); };

  $('btnLayerZUp').onclick = () => { etat.layers[activeCat].zOffset = (etat.layers[activeCat].zOffset ?? 0) + 1; majTout(); };
  $('btnLayerZDown').onclick = () => { etat.layers[activeCat].zOffset = (etat.layers[activeCat].zOffset ?? 0) - 1; majTout(); };
  $('btnLayerReset').onclick = () => {
    Object.assign(etat.layers[activeCat], { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, zOffset: 0, visible: true });
    majTout();
  };

  $('btnLockCat').onclick = () => {
    verrous[activeCat] = !verrous[activeCat];
    renderAssetGrid();
    sauverLocal();
  };

  $('skinPicker').oninput = (e) => { etat.personne.peau = e.target.value; majTout(); };
  $('hairPicker').oninput = (e) => { etat.personne.cheveux = e.target.value; majTout(); };

  // Calibration de silhouette
  const bindLm = (id, key) => {
    $(id).oninput = async (e) => {
      const silAsset = catalogue.parCategorie.corps.find((a) => a.id === etat.layers.corps.assetId);
      if (!silAsset) return;
      calibratingSil = true;
      silAsset.landmarks[key] = Number(e.target.value);
      if (silAsset.source === 'custom') await sauverAssetPerso(silAsset);
      majTout();
    };
  };
  bindLm('lmNeckY', 'neckY');
  bindLm('lmShoulderY', 'shoulderY');
  bindLm('lmShoulderW', 'shoulderW');
  bindLm('lmWaistY', 'waistY');
  bindLm('lmHipW', 'hipW');
  bindLm('lmFeetY', 'feetY');
}

// ---------- Interaction directe sur le canevas 2D (glisser-déposer + zoom) ----------
function bindCanvas2DInteraction() {
  const cv = $('canvas2d');
  let dragging = false, lastX = 0, lastY = 0;

  cv.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    cv.setPointerCapture(e.pointerId);
  });

  cv.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = cv.getBoundingClientRect();
    const scaleX = SCENE_W / Math.max(1, rect.width);
    const scaleY = SCENE_H / Math.max(1, rect.height);
    const dx = (e.clientX - lastX) * scaleX;
    const dy = (e.clientY - lastY) * scaleY;
    lastX = e.clientX;
    lastY = e.clientY;
    etat.layers[activeCat].offsetX = (etat.layers[activeCat].offsetX ?? 0) + dx;
    etat.layers[activeCat].offsetY = (etat.layers[activeCat].offsetY ?? 0) + dy;
    rendre2D();
    renderInspector();
  });

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    sauverLocal();
    schedule3DSync();
  };
  cv.addEventListener('pointerup', stop);
  cv.addEventListener('pointercancel', stop);

  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.04 : -0.04;
    const next = Math.max(0.25, Math.min(2.5, (etat.layers[activeCat].scaleX ?? 1) + delta));
    etat.layers[activeCat].scaleX = next;
    etat.layers[activeCat].scaleY = next;
    majTout();
  }, { passive: false });
}

// ---------- Tirages aléatoires ----------
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

function tirerHasard(scope) {
  if (scope === 'personne' || scope === 'visage') {
    if (!verrous.corps && scope === 'personne') {
      const sil = rand(catalogue.parCategorie.corps);
      choisirAsset('corps', sil);
      etat.personne.peau = rand(PALETTE_PEAU);
    }
    for (const c of ['tete', 'yeux', 'sourcils', 'nez', 'bouche', 'cheveux']) {
      if (verrous[c]) continue;
      const list = catalogue.parCategorie[c];
      if (list.length) {
        const chosen = rand(list);
        etat.layers[c].assetId = chosen.id;
        if (chosen.defaultTint) etat.layers[c].tintMode = chosen.defaultTint;
      }
    }
    if (!verrous.pilosite) {
      const pList = catalogue.parCategorie.pilosite ?? [];
      const silAsset = catalogue.parCategorie.corps.find((a) => a.id === etat.layers.corps.assetId);
      const useFacialHair = silAsset?.genre === 'h' && Math.random() < 0.40 && pList.length > 1;
      etat.layers.pilosite.assetId = useFacialHair ? rand(pList.slice(1)).id : (pList[0]?.id ?? 'pilosite:aucun');
    }
    if (!verrous.cheveux) etat.personne.cheveux = rand(PALETTE_CHEVEUX)[1];
  }
  if (scope === 'personne' || scope === 'tenue') {
    const silAsset = catalogue.parCategorie.corps.find((a) => a.id === etat.layers.corps.assetId);
    for (const c of ['haut', 'bas', 'chaussures']) {
      if (verrous[c]) continue;
      let pool = (catalogue.parCategorie[c] ?? []).filter((a) => a.source === 'custom' || !a.nativeSil || a.nativeSil === silAsset?.silId);
      if (!pool.length) pool = catalogue.parCategorie[c];
      if (pool.length) {
        const chosen = rand(pool);
        etat.layers[c].assetId = chosen.id;
        etat.layers[c].color = rand(PALETTE_VETEMENTS);
        etat.layers[c].tintMode = chosen.defaultTint ?? 'cloth';
      }
    }
    for (const c of ['chapeau', 'lunettes']) {
      if (verrous[c]) continue;
      const list = catalogue.parCategorie[c] ?? [];
      if (Math.random() < 0.72) {
        etat.layers[c].assetId = list[0]?.id;
      } else {
        const chosen = rand(list.slice(1));
        if (chosen) {
          etat.layers[c].assetId = chosen.id;
          etat.layers[c].color = rand(PALETTE_VETEMENTS);
        }
      }
    }
  }
  majTout();
}

// ---------- Planche de tenues ----------
const copie = (x) => JSON.parse(JSON.stringify(x));
function tenueCourante() {
  return {
    haut: copie(etat.layers.haut),
    bas: copie(etat.layers.bas),
    chaussures: copie(etat.layers.chaussures),
    chapeau: copie(etat.layers.chapeau),
    lunettes: copie(etat.layers.lunettes),
  };
}

let plancheToken = 0;
async function renderPlanche() {
  const tok = ++plancheToken;
  const grid = $('plancheGrid');
  if (!planche.length) {
    grid.innerHTML = '<p class="muted">Aucune tenue enregistrée. Cliquez sur « + Garder » ou « + 6 tenues » pour constituer une planche avec ce personnage.</p>';
    return;
  }

  const rendered = await Promise.all(planche.map(async (tenue) => {
    const cv = document.createElement('canvas');
    cv.width = 192; cv.height = 288;
    const tempEtat = {
      personne: etat.personne,
      layers: { ...etat.layers, ...tenue },
    };
    await dessinerScene2D(cv, catalogue, tempEtat);
    return cv;
  }));
  if (tok !== plancheToken) return;

  grid.textContent = '';
  planche.forEach((tenue, idx) => {
    const card = document.createElement('div');
    card.className = 'look-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-current', String(JSON.stringify(tenue) === JSON.stringify(tenueCourante())));
    card.onclick = () => {
      Object.assign(etat.layers, copie(tenue));
      majTout();
    };
    const rm = document.createElement('button');
    rm.className = 'look-rm';
    rm.type = 'button';
    rm.textContent = '×';
    rm.title = 'Retirer de la planche';
    rm.onclick = (e) => {
      e.stopPropagation();
      planche.splice(idx, 1);
      sauverLocal();
      renderPlanche();
    };
    card.append(rendered[idx], rm);
    grid.append(card);
  });
}

// ---------- Modale d'import d'assets personnalisés ----------
let pendingFiles = [];

function bindImportModal() {
  const dlg = $('importDialog');
  const drop = $('importDropzone');
  const input = $('importFileInput');

  const updateCategoryHint = () => {
    const cat = $('importCat').value;
    const ruleMap = {
      corps: GABARIT_SPEC.reglesCategories[0].spec,
      tete: GABARIT_SPEC.reglesCategories[1].spec,
      yeux: GABARIT_SPEC.reglesCategories[2].spec,
      sourcils: GABARIT_SPEC.reglesCategories[2].spec,
      nez: GABARIT_SPEC.reglesCategories[2].spec,
      bouche: GABARIT_SPEC.reglesCategories[2].spec,
      pilosite: GABARIT_SPEC.reglesCategories[2].spec,
      cheveux: GABARIT_SPEC.reglesCategories[3].spec,
      chapeau: GABARIT_SPEC.reglesCategories[3].spec,
      lunettes: GABARIT_SPEC.reglesCategories[2].spec,
      haut: GABARIT_SPEC.reglesCategories[4].spec,
      bas: GABARIT_SPEC.reglesCategories[5].spec,
      chaussures: GABARIT_SPEC.reglesCategories[5].spec,
    };
    $('importSpecCategoryHint').textContent = ruleMap[cat] ?? 'Modèle 3D .glb / .gltf prêt à projeter sur le buste 3D.';
  };

  const syncTrimWithAlign = () => {
    const isGabarit = $('importAlignMode').value === 'gabarit';
    if (isGabarit) $('importTrim').checked = false;
    $('importTrim').disabled = isGabarit;
  };

  const refreshPreview = async (detectDimensions = false) => {
    const file = pendingFiles[0];
    if (!file || /\.(glb|gltf)$/i.test(file.name)) {
      $('importPreviewPair').hidden = true;
      return;
    }
    $('importPreviewPair').hidden = false;
    const url = URL.createObjectURL(file);
    try {
      const img = await chargerImage(url);
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (detectDimensions && iw >= GABARIT_SPEC.width && Math.abs(iw / Math.max(1, ih) - GABARIT_SPEC.width / GABARIT_SPEC.height) < 0.015) {
        $('importAlignMode').value = 'gabarit';
        syncTrimWithAlign();
      }
      const origCanvas = imageVersCanvas(img);
      const before = $('previewBefore');
      before.width = origCanvas.width; before.height = origCanvas.height;
      before.getContext('2d').drawImage(origCanvas, 0, 0);

      const bgModeVal = $('importBgMode').value;
      const tol = Number($('importTol').value);
      let cleaned = nettoyerFondCanvas(origCanvas, bgModeVal, tol, true);
      if ($('importCat').value === 'corps' && $('importStripMagenta').checked) {
        cleaned = synthetiserCorpsNu(cleaned, { stripSuitMode: 'magenta' }).canvas;
      } else if ($('importAlignMode').value !== 'gabarit' && $('importTrim').checked) {
        cleaned = rognerTransparent(cleaned, 2);
      }

      const after = $('previewAfter');
      after.width = cleaned.width; after.height = cleaned.height;
      after.getContext('2d').drawImage(cleaned, 0, 0);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const setFiles = (files) => {
    pendingFiles = [...files];
    $('importFileList').textContent = pendingFiles.length
      ? `${pendingFiles.length} fichier(s) prêt(s) : ${pendingFiles.map((f) => f.name).join(', ')}`
      : 'Aucun fichier sélectionné.';
    $('btnConfirmImport').disabled = pendingFiles.length === 0;
    if (pendingFiles.some((f) => /\.(glb|gltf)$/i.test(f.name))) {
      $('importCat').value = 'glb-3d';
    }
    $('importSilOptions').hidden = $('importCat').value !== 'corps';
    updateCategoryHint();
    refreshPreview(true);
  };

  $('btnDlGabaritPng').onclick = () => {
    telechargerGabaritPng();
    setStatus('Gabarit guide 560×840 PNG téléchargé.');
  };
  $('btnDlGabaritSvg').onclick = () => {
    telechargerGabaritSvg();
    setStatus('Gabarit guide 560×840 SVG téléchargé.');
  };

  $('btnOpenImport').onclick = () => {
    $('importCat').value = activeCat;
    $('importAlignMode').value = 'auto';
    syncTrimWithAlign();
    $('importSilOptions').hidden = activeCat !== 'corps';
    updateCategoryHint();
    setFiles([]);
    dlg.showModal();
  };
  $('btnCloseImport').onclick = () => dlg.close();
  drop.onclick = () => input.click();
  input.onchange = (e) => setFiles(e.target.files);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('dragover'); };
  drop.ondragleave = () => drop.classList.remove('dragover');
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
    if (e.dataTransfer?.files?.length) setFiles(e.dataTransfer.files);
  };

  $('importCat').onchange = () => {
    $('importSilOptions').hidden = $('importCat').value !== 'corps';
    updateCategoryHint();
    refreshPreview();
  };
  $('importAlignMode').onchange = () => {
    syncTrimWithAlign();
    refreshPreview();
  };
  $('importBgMode').onchange = () => refreshPreview();
  $('importTol').oninput = () => refreshPreview();
  $('importTrim').onchange = () => refreshPreview();
  $('importStripMagenta').onchange = () => refreshPreview();

  $('btnConfirmImport').onclick = async () => {
    const cat = $('importCat').value;
    const alignMode = $('importAlignMode').value;
    const bgModeVal = $('importBgMode').value;
    const tol = Number($('importTol').value);
    const shouldTrim = alignMode !== 'gabarit' && $('importTrim').checked;
    const tintMode = $('importTintMode').value;

    for (const file of pendingFiles) {
      if (cat === 'glb-3d' || /\.(glb|gltf)$/i.test(file.name)) {
        const buffer = await file.arrayBuffer();
        const id = `glb:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
        await sauverGlbPerso({ id, nom: file.name.replace(/\.(glb|gltf)$/i, ''), buffer });
        selectedCustomGlbId = id;
        head3dMode = 'custom-glb';
        continue;
      }

      const dataUrlRaw = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(file);
      });
      const img = await chargerImage(dataUrlRaw);
      let canvas = nettoyerFondCanvas(imageVersCanvas(img), bgModeVal, tol, true);
      if (cat !== 'corps' && shouldTrim) canvas = rognerTransparent(canvas, 2);

      const finalDataUrl = canvas.toDataURL('image/png');
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const id = `custom:${cat}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;

      const entry = {
        id,
        categorie: cat,
        nom: alignMode === 'gabarit' ? `${baseName} (gabarit)` : baseName,
        source: 'custom',
        alignMode,
        src: finalDataUrl,
        thumbSrc: finalDataUrl,
        bgMode: 'none',
        defaultTint: cat === 'corps' ? 'skin' : tintMode,
      };

      if (cat === 'corps') {
        entry.silId = id;
        entry.genre = $('importGenre').value;
        entry.stripSuitMode = $('importStripMagenta').checked ? 'magenta' : 'none';
        entry.hasAttachedHead = $('importHasHead').checked;
        entry.landmarks = alignMode === 'gabarit'
          ? {
              centerX: 0.50,
              neckY: 198 / 840,
              shoulderY: 224 / 840,
              torsoW: 148 / 560,
              shoulderW: 168 / 560,
              shoulderSpanW: 192 / 560,
              waistY: 342 / 840,
              waistW: 108 / 560,
              hipY: 408 / 840,
              hipW: 148 / 560,
              kneeY: 576 / 840,
              feetY: 812 / 840,
              feetW: 156 / 560,
            }
          : {
              centerX: 0.50,
              neckY: entry.hasAttachedHead ? 0.16 : 0.04,
              shoulderY: entry.hasAttachedHead ? 0.20 : 0.08,
              torsoW: 0.36,
              shoulderW: 0.44,
              shoulderSpanW: 0.52,
              waistY: 0.36,
              waistW: 0.28,
              hipY: 0.45,
              hipW: 0.38,
              kneeY: 0.70,
              feetY: 0.97,
              feetW: 0.42,
            };
        entry.proportions3d = {
          hauteur: 1.70,
          epaules: 0.38,
          taille: 0.27,
          hanches: 0.36,
          membres: 1.0,
        };
      }

      await sauverAssetPerso(entry);
    }

    viderCacheRendu2D();
    catalogue = await chargerCatalogueComplet();
    if (cat !== 'glb-3d') {
      activeCat = cat;
      const newest = catalogue.parCategorie[cat][0];
      if (newest) choisirAsset(cat, newest);
      if (cat === 'corps' && alignMode !== 'gabarit') calibratingSil = true;
    } else {
      refresh3DHeadSelect();
    }

    dlg.close();
    renderCategories();
    majTout();
    setStatus(`${pendingFiles.length} asset(s) importé(s) (${alignMode === 'gabarit' ? 'gabarit 560×840' : 'adaptatif'}).`);
  };
}

// ---------- Contrôles 3D ----------
function refresh3DHeadSelect() {
  const sel = $('selHead3D');
  sel.textContent = '';
  for (const t of TETES_3D_DISPONIBLES) {
    sel.add(new Option(t.nom, t.id));
  }
  for (const g of catalogue.glbsPerso) {
    sel.add(new Option(`GLB importé : ${g.nom}`, `custom:${g.id}`));
  }
  sel.value = head3dMode === 'custom-glb' && selectedCustomGlbId ? `custom:${selectedCustomGlbId}` : head3dMode;
}

function bind3DControls() {
  refresh3DHeadSelect();
  $('selHead3D').onchange = (e) => {
    const val = e.target.value;
    if (val.startsWith('custom:')) {
      head3dMode = 'custom-glb';
      selectedCustomGlbId = val.slice(7);
    } else {
      head3dMode = val;
    }
    schedule3DSync();
  };

  for (const [selId, setter] of [['selMatHaut', (v) => { matiereHaut = v; }], ['selMatBas', (v) => { matiereBas = v; }]]) {
    const s = $(selId);
    s.textContent = '';
    for (const m of MATIERES_3D) s.add(new Option(m.nom, m.id));
    s.onchange = (e) => { setter(e.target.value); schedule3DSync(); };
  }

  $('selAnim3D').onchange = (e) => {
    if (viewer3d) viewer3d.animMode = e.target.value;
  };
  $('selLight3D').onchange = (e) => {
    viewer3d?.setLightingMode(e.target.value);
  };
  document.querySelectorAll('[data-cam-az]').forEach((b) => {
    b.onclick = () => viewer3d?.setCameraPreset(Number(b.dataset.camAz));
  });
}

// ---------- Mode d'affichage & barre d'outils ----------
function setViewMode(mode) {
  viewMode = mode;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === mode)));
  $('viewports').dataset.mode = mode;
  $('box2d').hidden = mode === '3d';
  $('box3d').hidden = mode === '2d';
  $('controls3dBox').hidden = mode === '2d';
  sauverLocal();
  if (mode !== '2d') schedule3DSync();
}

function telechargerCanvas(cv, nom) {
  cv.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}

function bindToolbarAndExports() {
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => setViewMode(b.dataset.view);
  });

  $('btnGuides').onclick = () => {
    showGuides = !showGuides;
    $('btnGuides').setAttribute('aria-pressed', String(showGuides));
    rendre2D();
  };

  $('btnStageGabarit').onclick = () => {
    telechargerGabaritPng();
    setStatus('Gabarit guide 560×840 PNG téléchargé.');
  };

  $('btnBackdrop').onclick = () => {
    bgMode = bgMode === 'checker' ? 'studio' : 'checker';
    $('box2d').className = `viewport-box ${bgMode === 'checker' ? 'checker' : 'studio-bg'}`;
    $('box3d').className = `viewport-box ${bgMode === 'checker' ? 'checker' : 'studio-bg'}`;
  };

  $('btnRandAll').onclick = () => tirerHasard('personne');
  $('btnRandFace').onclick = () => tirerHasard('visage');
  $('btnRandOutfit').onclick = () => tirerHasard('tenue');

  $('btnKeepLook').onclick = () => {
    planche.push(tenueCourante());
    sauverLocal();
    renderPlanche();
  };
  $('btnSixLooks').onclick = () => {
    const sauve = copie(tenueCourante());
    for (let i = 0; i < 6; i++) {
      tirerHasard('tenue');
      planche.push(tenueCourante());
    }
    Object.assign(etat.layers, sauve);
    majTout();
  };
  $('btnClearLooks').onclick = () => {
    planche = [];
    sauverLocal();
    renderPlanche();
  };

  $('btnExport256').onclick = async () => {
    const cv = await exporterSpriteJeu256(catalogue, etat);
    telechargerCanvas(cv, 'personnage-256.png');
    setStatus('Sprite 256×256 exporté.');
  };
  $('btnTopExport').onclick = $('btnExport256').onclick;

  $('btnExportHD').onclick = async () => {
    const hd = document.createElement('canvas');
    hd.width = SCENE_W * 2; hd.height = SCENE_H * 2;
    await dessinerScene2D(hd, catalogue, etat);
    telechargerCanvas(hd, 'personnage-hd.png');
    setStatus('Image 2D haute résolution exportée.');
  };

  $('btnExport3DPng').onclick = () => {
    if (!viewer3d) { setStatus('Passez en vue 3D ou 2D + 3D pour exporter la 3D.'); return; }
    telechargerCanvas(viewer3d.capturePng(512, 512, true), 'personnage-3d.png');
    setStatus('Rendu 3D exporté.');
  };

  $('btnExport3DSheet').onclick = () => {
    if (!viewer3d) { setStatus('Passez en vue 3D ou 2D + 3D pour exporter la planche animée.'); return; }
    telechargerCanvas(viewer3d.captureWalkSheet(8, 256), 'personnage-3d-marche-8frames.png');
    setStatus('Planche animée 3D (8 images) exportée.');
  };

  $('btnExportPlanche').onclick = async () => {
    if (!planche.length) { setStatus('La planche de tenues est vide.'); return; }
    const w = 280, h = 420;
    const out = document.createElement('canvas');
    out.width = w * planche.length; out.height = h;
    const ctx = out.getContext('2d');
    for (let i = 0; i < planche.length; i++) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      await dessinerScene2D(cv, catalogue, { personne: etat.personne, layers: { ...etat.layers, ...planche[i] } });
      ctx.drawImage(cv, i * w, 0);
    }
    telechargerCanvas(out, 'planche-tenues.png');
  };

  $('btnCopyRecipe').onclick = async () => {
    const json = JSON.stringify(etat, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setStatus('Recette JSON copiée dans le presse-papiers.');
    } catch {
      const blob = new Blob([json], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'recette-personnage.json' });
      a.click();
      setStatus('Recette JSON téléchargée.');
    }
  };
}

// ---------- Démarrage ----------
renderCategories();
bindInspectorEvents();
bindCanvas2DInteraction();
bindImportModal();
bind3DControls();
bindToolbarAndExports();
setViewMode(viewMode);
majTout();
