// Moteur de studio 3D (Three.js) synchronisé avec le compositeur 2D :
// - Proportions et morphologie pilotées par la silhouette 2D active
// - Projection du visage 2D composé sur une tête 3D sculptée + coiffure 3D accordée, ou maillage GLB
// - Vêtements et accessoires 3D accordés aux pièces, couleurs et matières sélectionnées
// - Éclairage studio trois points, rotation interactive, animations et export PNG / planche

import * as THREE from 'three';
import { GLTFLoader } from '/vendor/GLTFLoader.js';
import { MATIERES_3D, TETES_3D_DISPONIBLES } from './studio-assets.js';
import { genererTextureVisage2D } from './studio2d.js';

const glbCache = new Map();
const textureCache = new Map();
const loader = new GLTFLoader();

function chargerTextureUrl(url, isColor = true) {
  const key = `${url}|${isColor ? 'srgb' : 'lin'}`;
  if (textureCache.has(key)) return Promise.resolve(textureCache.get(key));
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      const tex = new THREE.Texture(im);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      textureCache.set(key, tex);
      resolve(tex);
    };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

async function chargerGlb(srcOrBuffer, cacheKey) {
  if (glbCache.has(cacheKey)) return glbCache.get(cacheKey);
  const p = new Promise((resolve, reject) => {
    if (srcOrBuffer instanceof ArrayBuffer) {
      loader.parse(srcOrBuffer, '', (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        resolve({ scene: gltf.scene, box: new THREE.Box3().setFromObject(gltf.scene) });
      }, reject);
    } else {
      loader.load(srcOrBuffer, (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        resolve({ scene: gltf.scene, box: new THREE.Box3().setFromObject(gltf.scene) });
      }, undefined, reject);
    }
  });
  glbCache.set(cacheKey, p);
  return p;
}

function devinerTypeCoiffure(nom = '') {
  const s = nom.toLowerCase();
  if (s.includes('chauve')) return 'chauve';
  if (s.includes('afro') || s.includes('boucl')) return 'afro';
  if (s.includes('chignon')) return 'chignon';
  if (s.includes('queue')) return 'queue';
  if (s.includes('long') && !s.includes('mi-long')) return 'long';
  if (s.includes('carr') || s.includes('mi-long') || s.includes('ondul')) return 'bob';
  return 'court';
}

function devinerTypeHaut(pieceKey = '', nom = '') {
  const s = `${pieceKey} ${nom}`.toLowerCase();
  if (s.includes('robe')) return 'robe';
  if (s.includes('bikini') || s.includes('maillot')) return 'bikini';
  if (s.includes('debardeur') || s.includes('débardeur')) return 'debardeur';
  if (s.includes('pull') || s.includes('sweat') || s.includes('manches-longues')) return 'pull';
  if (s.includes('chemise') || s.includes('blouse')) return 'chemise';
  return 'tshirt';
}

function devinerTypeBas(pieceKey = '', nom = '') {
  const s = `${pieceKey} ${nom}`.toLowerCase();
  if (s.includes('jupe-longue') || s.includes('jupe longue')) return 'jupe-longue';
  if (s.includes('jupe')) return 'jupe';
  if (s.includes('pantalon') || s.includes('jean') || s.includes('legging') || s.includes('jogging') || s.includes('chino')) return 'pantalon';
  if (s.includes('bermuda') || s.includes('cargo')) return 'bermuda';
  return 'short';
}

export class Studio3DViewer {
  constructor(canvas, onStatus = () => {}) {
    this.canvas = canvas;
    this.onStatus = onStatus;
    this.azimuth = 0.25;
    this.elevation = 0.08;
    this.zoom = 1.0;
    this.animMode = 'respiration';
    this.headMode = 'portrait-2d';
    this.lightingMode = 'studio';
    this.disposed = false;
    this.contextLost = false;
    this.rig = null;
    this.characterGroup = null;
    this.lastSyncToken = 0;

    this.initRenderer();
    this.initScene();
    this.bindInteraction();
    this.startLoop();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.localClippingEnabled = true;

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.onStatus('Contexte WebGL suspendu…');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.onStatus('');
    });
  }

  initScene() {
    this.scene = new THREE.Scene();
    const w = this.canvas.clientWidth || 560;
    const h = this.canvas.clientHeight || 680;
    this.camera = new THREE.PerspectiveCamera(32, w / Math.max(1, h), 0.1, 30);

    // Environnement studio PMREM procédural pour des reflets doux type rendu Pixar
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xeef2f7);
    const topBox = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    topBox.position.set(0, 4.5, 0);
    topBox.rotation.x = Math.PI / 2;
    const warmSide = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe6cc, side: THREE.DoubleSide }),
    );
    warmSide.position.set(4.5, 1.5, 2);
    warmSide.lookAt(0, 1, 0);
    const coolRim = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 5),
      new THREE.MeshBasicMaterial({ color: 0xdbeafe, side: THREE.DoubleSide }),
    );
    coolRim.position.set(-4.5, 2.2, -3);
    coolRim.lookAt(0, 1, 0);
    envScene.add(topBox, warmSide, coolRim);
    this.envRT = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
    topBox.geometry.dispose(); topBox.material.dispose();
    warmSide.geometry.dispose(); warmSide.material.dispose();
    coolRim.geometry.dispose(); coolRim.material.dispose();

    // Éclairage studio 3 points (Key, Fill, Rim)
    this.fillLight = new THREE.HemisphereLight(0xf6f9ff, 0x8f8278, 1.05);
    this.keyLight = new THREE.DirectionalLight(0xfff4e6, 1.75);
    this.keyLight.position.set(2.4, 3.6, 3.4);
    this.rimLight = new THREE.DirectionalLight(0xd9e8ff, 0.90);
    this.rimLight.position.set(-2.6, 2.8, -3.2);
    this.scene.add(this.fillLight, this.keyLight, this.rimLight);

    // Ombre de contact douce au sol
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    this.groundDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    this.groundDisc.rotation.x = -Math.PI / 2;
    this.groundDisc.position.y = 0.002;
    this.scene.add(this.groundDisc);
  }

  bindInteraction() {
    let dragging = false, lastX = 0, lastY = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this.azimuth += dx * 0.012;
      this.elevation = Math.max(-0.35, Math.min(0.65, this.elevation + dy * 0.008));
    });
    const end = () => { dragging = false; };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(0.65, Math.min(1.65, this.zoom + e.deltaY * 0.001));
    }, { passive: false });
  }

  resize() {
    const w = this.canvas.clientWidth || 560;
    const h = this.canvas.clientHeight || 680;
    if (this.canvas.width !== Math.round(w * (this.renderer.getPixelRatio())) ||
        this.canvas.height !== Math.round(h * (this.renderer.getPixelRatio()))) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    }
  }

  setCameraPreset(azDeg) {
    this.azimuth = (azDeg * Math.PI) / 180;
    this.elevation = 0.08;
  }

  setLightingMode(mode) {
    this.lightingMode = mode;
    if (mode === 'soleil') {
      this.fillLight.intensity = 1.0;
      this.keyLight.color.setHex(0xffe9c7);
      this.keyLight.intensity = 2.2;
      this.rimLight.intensity = 0.7;
    } else if (mode === 'doux') {
      this.fillLight.intensity = 1.65;
      this.keyLight.color.setHex(0xffffff);
      this.keyLight.intensity = 1.15;
      this.rimLight.intensity = 0.6;
    } else {
      this.fillLight.intensity = 1.15;
      this.keyLight.color.setHex(0xfff6ea);
      this.keyLight.intensity = 1.85;
      this.rimLight.intensity = 0.95;
    }
  }

  async syncFromState(catalogue, etat, options = {}) {
    const token = ++this.lastSyncToken;
    const { headMode = this.headMode, customGlb = null, matiereHaut = 'uni', matiereBas = 'uni' } = options;
    this.headMode = headMode;

    const silAsset = catalogue.parCategorie.corps.find((a) => a.id === etat.layers.corps.assetId)
      ?? catalogue.parCategorie.corps[0];
    const p3d = silAsset.proportions3d ?? {
      hauteur: 1.70,
      epaules: Math.max(0.32, Math.min(0.50, silAsset.landmarks.shoulderW * 1.35)),
      taille: Math.max(0.20, Math.min(0.45, silAsset.landmarks.waistW * 1.35)),
      hanches: Math.max(0.28, Math.min(0.48, silAsset.landmarks.hipW * 1.35)),
      membres: 1.0,
    };

    // Préparer la texture du visage 2D + les textures de tissus en parallèle
    const facePromise = genererTextureVisage2D(catalogue, etat, 512);
    const matHDef = MATIERES_3D.find((m) => m.id === matiereHaut);
    const matBDef = MATIERES_3D.find((m) => m.id === matiereBas);
    const [faceCanvas, texHaut, normHaut, texBas, normBas] = await Promise.all([
      facePromise,
      matHDef?.src ? chargerTextureUrl(matHDef.src, true) : null,
      matHDef?.normale ? chargerTextureUrl(matHDef.normale, false) : null,
      matBDef?.src ? chargerTextureUrl(matBDef.src, true) : null,
      matBDef?.normale ? chargerTextureUrl(matBDef.normale, false) : null,
    ]);

    let glbData = null;
    if (headMode === 'custom-glb' && customGlb) {
      glbData = await chargerGlb(customGlb.buffer, `custom-glb:${customGlb.id}`).catch(() => null);
    } else if (headMode !== 'portrait-2d') {
      const def = TETES_3D_DISPONIBLES.find((t) => t.id === headMode);
      if (def?.src) glbData = await chargerGlb(def.src, def.src).catch(() => null);
    }

    if (token !== this.lastSyncToken || this.disposed) return;

    if (this.characterGroup) {
      this.scene.remove(this.characterGroup);
      this.disposeObject(this.characterGroup);
    }

    const root = new THREE.Group();
    const skinHex = etat.personne.peau || '#e8b48a';
    const hairHex = etat.personne.cheveux || '#4a3020';
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: skinHex,
      roughness: 0.56,
      metalness: 0.01,
      sheen: 0.25,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(skinHex).lerp(new THREE.Color('#ffcabd'), 0.45),
    });
    const hairMat = new THREE.MeshPhysicalMaterial({
      color: hairHex,
      roughness: 0.58,
      metalness: 0.04,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ffffff'),
    });

    const makeClothMat = (hex, tex, norm, def, repU = 2, repV = 2) => {
      const m = new THREE.MeshStandardMaterial({
        color: def?.teintable === false ? '#ffffff' : hex,
        roughness: 0.82,
        metalness: 0.03,
      });
      if (tex) {
        const t = tex.clone();
        t.repeat.set(repU, repV);
        t.needsUpdate = true;
        m.map = t;
      }
      if (norm) {
        const n = norm.clone();
        n.repeat.set(repU, repV);
        n.needsUpdate = true;
        m.normalMap = n;
        m.normalScale.set(0.65, 0.65);
      }
      return m;
    };

    const H = p3d.hauteur;
    const isFemale = silAsset.genre === 'f';
    const shoulderHalf = p3d.epaules * 0.5;
    const waistHalf = p3d.taille * 0.5;
    const hipHalf = p3d.hanches * 0.5;
    const chestHalf = isFemale ? Math.max(waistHalf * 1.18, shoulderHalf * 0.88) : shoulderHalf * 0.94;
    const depthScale = isFemale ? 0.68 : 0.72;

    const footH = 0.055;
    const kneeY = H * 0.27;
    const hipY = H * 0.49;
    const waistY = H * 0.60;
    const chestY = H * 0.73;
    const shoulderY = H * 0.81;
    const neckTopY = H * 0.865;
    const headCenterY = H * 0.925;
    const headR = H * 0.072;

    // Fonction utilitaire pour révolution lisse du torse / vêtement
    const makeTorsoLathe = (yTop, yBot, margin, material, flare = 0) => {
      const profileRadius = (y) => {
        if (y >= chestY) {
          const u = (y - chestY) / Math.max(0.01, shoulderY - chestY);
          return chestHalf * (1 - u) + shoulderHalf * 0.78 * u;
        }
        if (y >= waistY) {
          const u = (y - waistY) / Math.max(0.01, chestY - waistY);
          return waistHalf * (1 - u) + chestHalf * u;
        }
        if (y >= hipY) {
          const u = (y - hipY) / Math.max(0.01, waistY - hipY);
          return hipHalf * (1 - u) + waistHalf * u;
        }
        return hipHalf + Math.max(0, hipY - y) * flare;
      };
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const y = yBot + ((yTop - yBot) * i) / 20;
        pts.push(new THREE.Vector2(Math.max(0.02, profileRadius(y) + margin), y));
      }
      const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), material);
      mesh.scale.z = depthScale;
      return mesh;
    };

    const makeCapsule = (x1, y1, x2, y2, r, mat, parent = root, ox = 0, oy = 0) => {
      const L = Math.hypot(x2 - x1, y2 - y1);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.005, L), 8, 16), mat);
      m.position.set((x1 + x2) / 2 - ox, (y1 + y2) / 2 - oy, 0);
      m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
      parent.add(m);
      return m;
    };

    // Corps de base + articulations (cou épousant la largeur de la silhouette jusqu'à la base du crâne)
    root.add(makeTorsoLathe(shoulderY, hipY - 0.05, 0, skinMat));
    const neckR = headR * 0.43 * Math.max(0.92, p3d.membres * 0.96);
    makeCapsule(0, shoulderY - 0.025, 0, neckTopY + 0.045, neckR, skinMat);

    const armR = 0.036 * p3d.membres;
    const legR = 0.056 * p3d.membres;
    const legX = hipHalf * 0.48;

    const shoulders = {};
    const hips = {};
    const knees = {};

    const shoeAsset = (catalogue.parCategorie.chaussures ?? []).find((a) => a.id === etat.layers.chaussures?.assetId);
    const shoeColor = etat.layers.chaussures?.color || '#2b2b33';
    const shoeMat = new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.48, metalness: 0.08 });

    for (const side of [-1, 1]) {
      const ep = new THREE.Group();
      ep.position.set(side * (shoulderHalf * 0.96), shoulderY - 0.02, 0);
      root.add(ep);
      shoulders[side] = ep;

      const elbowX = side * (shoulderHalf + 0.055);
      const elbowY = shoulderY - H * 0.16;
      const handX = side * (shoulderHalf + 0.075);
      const handY = shoulderY - H * 0.31;
      makeCapsule(ep.position.x, ep.position.y, elbowX, elbowY, armR, skinMat, ep, ep.position.x, ep.position.y);
      makeCapsule(elbowX, elbowY, handX, handY, armR * 0.86, skinMat, ep, ep.position.x, ep.position.y);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(armR * 0.95, 12, 10), skinMat);
      hand.position.set(handX - ep.position.x, handY - ep.position.y, 0);
      ep.add(hand);

      const hGrp = new THREE.Group();
      hGrp.position.set(side * legX, hipY, 0);
      root.add(hGrp);
      hips[side] = hGrp;
      makeCapsule(side * legX, hipY, side * legX, kneeY, legR * 1.12, skinMat, hGrp, side * legX, hipY);

      const kGrp = new THREE.Group();
      kGrp.position.set(0, kneeY - hipY, 0);
      hGrp.add(kGrp);
      knees[side] = kGrp;
      makeCapsule(side * legX, kneeY, side * legX, footH, legR * 0.82, skinMat, kGrp, side * legX, kneeY);

      // Chaussures sculptées (tige + semelle contrastée)
      const soleMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.65, metalness: 0.02 });
      const shoeUpper = new THREE.Mesh(new THREE.CapsuleGeometry(legR * 0.94, 0.088, 8, 14), shoeMat);
      shoeUpper.rotation.x = Math.PI / 2;
      shoeUpper.scale.set(1.02, 1.04, 0.58);
      shoeUpper.position.set(0, footH * 0.62 - kneeY, 0.036);
      kGrp.add(shoeUpper);
      const sole = new THREE.Mesh(new THREE.CapsuleGeometry(legR * 0.98, 0.092, 6, 14), soleMat);
      sole.rotation.x = Math.PI / 2;
      sole.scale.set(1.05, 1.06, 0.22);
      sole.position.set(0, footH * 0.22 - kneeY, 0.036);
      kGrp.add(sole);
      if (shoeAsset?.nom?.toLowerCase().includes('bott')) {
        makeCapsule(side * legX, footH + 0.12, side * legX, footH, legR * 0.92, shoeMat, kGrp, side * legX, kneeY);
      }
    }

    // Vêtements 3D synchronisés
    const hautLayer = etat.layers.haut;
    const hautAsset = (catalogue.parCategorie.haut ?? []).find((a) => a.id === hautLayer?.assetId);
    if (hautLayer?.visible !== false && hautAsset) {
      const hType = devinerTypeHaut(hautAsset.pieceKey, hautAsset.nom);
      const hMat = makeClothMat(hautLayer.color || '#ff6f61', texHaut, normHaut, matHDef, 2, 1.5);
      if (hType === 'bikini') {
        root.add(makeTorsoLathe(chestY + 0.04, chestY - 0.05, 0.011, hMat));
      } else if (hType === 'robe') {
        root.add(makeTorsoLathe(shoulderY, kneeY - 0.04, 0.014, hMat, 0.55));
      } else {
        const yHem = hType === 'pull' ? hipY - 0.04 : hipY - 0.02;
        root.add(makeTorsoLathe(shoulderY, yHem, 0.012, hMat));
        // Anneau de col propre autour de l'encolure
        const collar = new THREE.Mesh(new THREE.TorusGeometry(neckR * 1.18, 0.012, 10, 24), hMat);
        collar.rotation.x = Math.PI / 2 + 0.14;
        collar.scale.y = depthScale * 1.15;
        collar.position.set(0, shoulderY - 0.004, 0.005);
        root.add(collar);
        const sleeveEnd = hType === 'debardeur' ? 0 : hType === 'tshirt' ? 0.42 : 0.92;
        if (sleeveEnd > 0) {
          for (const side of [-1, 1]) {
            const ep = shoulders[side];
            const elbowX = side * (shoulderHalf + 0.055);
            const elbowY = shoulderY - H * 0.16;
            const handX = side * (shoulderHalf + 0.075);
            const handY = shoulderY - H * 0.31;
            if (sleeveEnd <= 0.5) {
              const t = sleeveEnd * 2;
              const mx = ep.position.x + (elbowX - ep.position.x) * t;
              const my = ep.position.y + (elbowY - ep.position.y) * t;
              makeCapsule(ep.position.x, ep.position.y, mx, my, armR * 1.24, hMat, ep, ep.position.x, ep.position.y);
            } else {
              makeCapsule(ep.position.x, ep.position.y, elbowX, elbowY, armR * 1.24, hMat, ep, ep.position.x, ep.position.y);
              const t = (sleeveEnd - 0.5) * 2;
              const mx = elbowX + (handX - elbowX) * t;
              const my = elbowY + (handY - elbowY) * t;
              makeCapsule(elbowX, elbowY, mx, my, armR * 1.15, hMat, ep, ep.position.x, ep.position.y);
            }
          }
        }
      }
    }

    const basLayer = etat.layers.bas;
    const basAsset = (catalogue.parCategorie.bas ?? []).find((a) => a.id === basLayer?.assetId);
    if (basLayer?.visible !== false && basAsset) {
      const bType = devinerTypeBas(basAsset.pieceKey, basAsset.nom);
      const bMat = makeClothMat(basLayer.color || '#1f3a6b', texBas, normBas, matBDef, 2, 2);
      if (bType === 'jupe' || bType === 'jupe-longue') {
        const yBot = bType === 'jupe-longue' ? footH + 0.06 : kneeY + 0.06;
        root.add(makeTorsoLathe(waistY - 0.02, yBot, 0.015, bMat, bType === 'jupe-longue' ? 0.38 : 0.62));
      } else {
        root.add(makeTorsoLathe(waistY - 0.02, hipY - 0.06, 0.014, bMat));
        const len = bType === 'pantalon' ? 'full' : bType === 'bermuda' ? 'knee' : 'mid';
        for (const side of [-1, 1]) {
          const hGrp = hips[side];
          const kGrp = knees[side];
          const thighEnd = len === 'mid' ? hipY - (hipY - kneeY) * 0.55 : kneeY;
          makeCapsule(side * legX, hipY, side * legX, thighEnd, legR * 1.22, bMat, hGrp, side * legX, hipY);
          if (len === 'full') {
            makeCapsule(side * legX, kneeY, side * legX, footH + 0.04, legR * 0.96, bMat, kGrp, side * legX, kneeY);
          }
        }
      }
    }

    // Tête 3D (Portrait 2D projeté OU maillage GLB)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, headCenterY, 0);
    root.add(headGroup);

    if (glbData) {
      const size = glbData.box.getSize(new THREE.Vector3());
      const center = glbData.box.getCenter(new THREE.Vector3());
      const targetHeadH = headR * 2.25;
      const sc = targetHeadH / Math.max(0.01, size.y);
      const meshGroup = glbData.scene.clone(true);
      meshGroup.scale.setScalar(sc);
      meshGroup.position.set(-center.x * sc, -center.y * sc + headR * 0.05, -center.z * sc);
      if (headMode !== 'custom-glb') {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(headCenterY - headR * 1.05));
        meshGroup.traverse((o) => {
          if (!o.isMesh) return;
          o.material = o.material.clone();
          o.material.clippingPlanes = [plane];
          o.material.side = THREE.DoubleSide;
        });
      }
      headGroup.add(meshGroup);
    } else {
      // Crâne sculpté + oreilles 3D + projection frontale sans couture des traits 2D
      const cranium = new THREE.Mesh(new THREE.SphereGeometry(headR, 32, 24), skinMat);
      cranium.scale.set(0.95, 1.08, 0.96);
      headGroup.add(cranium);

      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.16, 12, 10), skinMat);
        ear.scale.set(0.42, 0.95, 0.65);
        ear.position.set(side * headR * 0.93, -headR * 0.04, -headR * 0.05);
        ear.rotation.y = side * 0.22;
        headGroup.add(ear);
      }

      const faceTex = new THREE.CanvasTexture(faceCanvas);
      faceTex.colorSpace = THREE.SRGBColorSpace;
      const faceShell = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 1.006, 32, 24, Math.PI / 2 - Math.PI * 0.28, Math.PI * 0.56, Math.PI * 0.22, Math.PI * 0.56),
        new THREE.MeshStandardMaterial({
          map: faceTex,
          roughness: 0.62,
          metalness: 0.02,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      faceShell.scale.set(0.95, 1.08, 0.96);
      headGroup.add(faceShell);

      // Coiffure 3D accordée au choix 2D (calotte remontée pour ne pas couper les sourcils)
      const hairAsset = (catalogue.parCategorie.cheveux ?? []).find((a) => a.id === etat.layers.cheveux?.assetId);
      const hairType = devinerTypeCoiffure(hairAsset?.nom);
      if (hairType !== 'chauve') {
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(headR * 1.075, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.50),
          hairMat,
        );
        cap.scale.set(0.96, 1.05, 0.98);
        cap.position.y = headR * 0.095;
        headGroup.add(cap);

        // Arrière du crâne couvert (-Z)
        const backHair = new THREE.Mesh(
          new THREE.SphereGeometry(headR * 1.07, 24, 16, Math.PI * 1.5 - Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.68),
          hairMat,
        );
        backHair.scale.set(0.96, 1.08, 0.98);
        headGroup.add(backHair);

        if (hairType === 'afro') {
          const afro = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.48, 24, 18), hairMat);
          afro.position.set(0, headR * 0.22, -headR * 0.14);
          headGroup.add(afro);
        } else if (hairType === 'chignon') {
          const bun = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.45, 18, 14), hairMat);
          bun.position.set(0, headR * 1.15, -headR * 0.25);
          headGroup.add(bun);
        } else if (hairType === 'queue') {
          makeCapsule(0, headR * 0.45, 0, -headR * 1.4, headR * 0.28, hairMat, headGroup, 0, 0).position.z = -headR * 0.95;
        } else if (hairType === 'long' || hairType === 'bob') {
          const len = hairType === 'long' ? headR * 2.4 : headR * 1.15;
          const drape = new THREE.Mesh(new THREE.CylinderGeometry(headR * 1.05, headR * 1.12, len, 20, 1, false, Math.PI * 0.62, Math.PI * 0.76), hairMat);
          drape.position.set(0, -len * 0.42, -headR * 0.16);
          drape.rotation.y = Math.PI;
          headGroup.add(drape);
        }
      }
    }

    // Chapeau et lunettes 3D si équipés
    const hatLayer = etat.layers.chapeau;
    const hatAsset = (catalogue.parCategorie.chapeau ?? []).find((a) => a.id === hatLayer?.assetId);
    if (hatLayer?.visible !== false && hatAsset?.src) {
      const hatMat = new THREE.MeshStandardMaterial({
        color: hatAsset.pieceKey === 'paille' ? '#e2c57e' : (hatLayer.color || '#2563eb'),
        roughness: 0.78,
      });
      const isWide = hatAsset.pieceKey === 'paille' || hatAsset.pieceKey === 'capeline';
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(headR * (isWide ? 1.85 : 1.35), headR * (isWide ? 1.92 : 1.38), headR * 0.08, 32), hatMat);
      brim.position.set(0, headR * 0.62, 0);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.95, headR * 1.04, headR * 0.68, 24), hatMat);
      crown.position.set(0, headR * 0.96, 0);
      headGroup.add(brim, crown);
    }

    const glassLayer = etat.layers.lunettes;
    const glassAsset = (catalogue.parCategorie.lunettes ?? []).find((a) => a.id === glassLayer?.assetId);
    if (glassLayer?.visible !== false && glassAsset?.src) {
      const frameMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.35 });
      const lensMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.78 });
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.23, headR * 0.23, 0.012, 18), lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(side * headR * 0.32, headR * 0.08, headR * 0.98);
        headGroup.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.24, 0.012, 0.012), frameMat);
      bridge.position.set(0, headR * 0.10, headR * 0.98);
      headGroup.add(bridge);
    }

    this.rig = { root, shoulders, hips, knees, headGroup, baseH: H };
    this.characterGroup = root;
    this.scene.add(root);
  }

  applyPose(timeSec) {
    if (!this.rig) return;
    const { root, shoulders, hips, knees, headGroup } = this.rig;
    root.position.y = 0;
    headGroup.rotation.set(0, 0, 0);
    for (const s of [-1, 1]) {
      shoulders[s].rotation.set(0, 0, 0);
      hips[s].rotation.set(0, 0, 0);
      knees[s].rotation.set(0, 0, 0);
    }

    if (this.animMode === 'respiration') {
      root.position.y = Math.sin(timeSec * 2.1) * 0.008;
      headGroup.rotation.y = Math.sin(timeSec * 0.9) * 0.05;
      shoulders[-1].rotation.z = -0.03 + Math.sin(timeSec * 2.1) * 0.015;
      shoulders[1].rotation.z = 0.03 - Math.sin(timeSec * 2.1) * 0.015;
    } else if (this.animMode === 'marche') {
      const p = timeSec * 4.4;
      root.position.y = Math.abs(Math.sin(p)) * 0.028;
      for (const s of [-1, 1]) {
        const legA = Math.sin(p) * 0.42 * s;
        hips[s].rotation.x = legA;
        knees[s].rotation.x = Math.max(0, -Math.cos(p * s)) * 0.52;
        shoulders[s].rotation.x = -legA * 0.85;
      }
    } else if (this.animMode === 'saluer') {
      shoulders[1].rotation.z = 2.25 + Math.sin(timeSec * 5.2) * 0.24;
      shoulders[1].rotation.x = -0.25;
      headGroup.rotation.z = -0.06;
    } else if (this.animMode === 'danse') {
      const p = timeSec * 5.2;
      root.position.y = Math.abs(Math.sin(p)) * 0.045;
      root.rotation.y = Math.sin(p * 0.5) * 0.25;
      shoulders[-1].rotation.z = -0.65 + Math.sin(p) * 0.35;
      shoulders[1].rotation.z = 0.65 + Math.sin(p) * 0.35;
      hips[-1].rotation.x = Math.sin(p) * 0.2;
      hips[1].rotation.x = -Math.sin(p) * 0.2;
    } else {
      root.rotation.y = 0;
    }
  }

  renderFrame(timeSec) {
    if (this.contextLost || this.disposed) return;
    this.resize();
    this.applyPose(timeSec);

    const targetY = (this.rig?.baseH ?? 1.7) * 0.52;
    const dist = 3.15 * this.zoom;
    this.camera.position.set(
      Math.sin(this.azimuth) * Math.cos(this.elevation) * dist,
      targetY + Math.sin(this.elevation) * dist,
      Math.cos(this.azimuth) * Math.cos(this.elevation) * dist,
    );
    this.camera.lookAt(0, targetY, 0);
    this.renderer.render(this.scene, this.camera);
  }

  startLoop() {
    const start = performance.now();
    const tick = (now) => {
      if (this.disposed) return;
      this.renderFrame((now - start) / 1000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  capturePng(width = 512, height = 512, gameFramed = false) {
    const offRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    offRenderer.setSize(width, height, false);
    offRenderer.outputColorSpace = THREE.SRGBColorSpace;
    offRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    offRenderer.toneMappingExposure = 1.08;
    offRenderer.localClippingEnabled = true;

    const prevGround = this.groundDisc.visible;
    this.groundDisc.visible = !gameFramed;

    const cam = this.camera.clone();
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    const targetY = (this.rig?.baseH ?? 1.7) * 0.52;
    const dist = gameFramed ? 3.55 : 3.15 * this.zoom;
    cam.position.set(
      Math.sin(this.azimuth) * Math.cos(this.elevation) * dist,
      targetY + Math.sin(this.elevation) * dist,
      Math.cos(this.azimuth) * Math.cos(this.elevation) * dist,
    );
    cam.lookAt(0, targetY, 0);
    offRenderer.render(this.scene, cam);

    const out = document.createElement('canvas');
    out.width = width; out.height = height;
    out.getContext('2d').drawImage(offRenderer.domElement, 0, 0);

    this.groundDisc.visible = prevGround;
    offRenderer.dispose();
    return out;
  }

  captureWalkSheet(frames = 8, frameSize = 256) {
    const sheet = document.createElement('canvas');
    sheet.width = frames * frameSize;
    sheet.height = frameSize;
    const sctx = sheet.getContext('2d');
    const prevAnim = this.animMode;
    this.animMode = 'marche';
    for (let i = 0; i < frames; i++) {
      this.applyPose((i / frames) * ((2 * Math.PI) / 4.4));
      const frameCanvas = this.capturePng(frameSize, frameSize, true);
      sctx.drawImage(frameCanvas, i * frameSize, 0);
    }
    this.animMode = prevAnim;
    this.applyPose(0);
    return sheet;
  }

  disposeObject(obj) {
    obj.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        if (o.material.map && !textureCache.has(o.material.map)) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  dispose() {
    this.disposed = true;
    this.envRT?.dispose();
    if (this.characterGroup) this.disposeObject(this.characterGroup);
    if (this.groundDisc) {
      this.groundDisc.geometry?.dispose();
      this.groundDisc.material?.map?.dispose();
      this.groundDisc.material?.dispose();
    }
    this.renderer.dispose();
  }
}
