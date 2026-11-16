// Rendu 3D (three.js) depuis la MÊME géométrie que le 2D : primitives paramétrées.
// Caméra orthographique de face, sol à 97 % de la hauteur → même ancrage que le 2D.
import * as THREE from 'three';
import { GLTFLoader } from '/vendor/GLTFLoader.js';
import { KIT, geometrie, segmentsJambe, pointsBras as pointsBrasKit, demiLargeur, pointEmplacement, tenueResolue } from './kit.js';
import { dessinerMotif, visageEnCanvas } from './rendu2d.js';
import { imageMatiere } from './matieres.js';

// Modèles de tête (GLB) chargés d'avance : dessiner3D reste synchrone.
const modeles = new Map();
export function preparerModeles(kit = KIT) {
  const loader = new GLTFLoader();
  return Promise.all(Object.values(kit.visagesMaillage ?? {}).map((d) => modeles.has(d.src) ? null : new Promise((ok, ko) => {
    loader.load(d.src, (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      modeles.set(d.src, { scene: gltf.scene, boite: new THREE.Box3().setFromObject(gltf.scene) });
      ok();
    }, undefined, () => ko(new Error(`modèle de tête introuvable : ${d.src}`)));
  })));
}

let rendu;
function moteur(taille) {
  if (!rendu) {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setClearColor(0x000000, 0);
    r.localClippingEnabled = true; // plan de coupe des têtes maillage (épaules supprimées)
    rendu = r;
  }
  rendu.setSize(taille, taille, false);
  return rendu;
}

const mat = (couleur) => new THREE.MeshLambertMaterial({ color: couleur });

// Matière : `couleur` peut être { matiere, couleur } (pièce texturée, cf. kit.matieres) au lieu d'une couleur seule.
// Les textures sont partagées entre images (animation) : userData.partage les protège du dispose de fin de rendu.
const textures = new Map();
function texture(src, repU, repV, couleurSRGB) {
  const cle = `${src}|${repU}|${repV.toFixed(2)}`;
  let t = textures.get(cle);
  if (!t) {
    if (textures.size > 300) textures.clear();
    t = new THREE.Texture(imageMatiere(src));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repU, repV);
    if (couleurSRGB) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.userData.partage = true;
    t.needsUpdate = true;
    textures.set(cle, t);
  }
  return t;
}
// repU : nombre ENTIER de tuiles autour (sinon couture visible) ; repV : tuiles dans la hauteur.
function materiau(couleur, kit, circonference, hauteur) {
  if (typeof couleur === 'string') return mat(couleur);
  const def = kit.matieres[couleur.matiere];
  const repU = Math.max(1, Math.round(circonference / def.tuile)), repV = Math.max(0.25, hauteur / def.tuile);
  const m = new THREE.MeshLambertMaterial({ color: def.teintable ? couleur.couleur : '#ffffff', map: texture(def.src, repU, repV, true) });
  if (def.normale) { m.normalMap = texture(def.normale, repU, repV, false); m.normalScale.set(0.8, 0.8); }
  return m;
}

function texMotif(motif) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  dessinerMotif(ctx, motif.type, 64, 64, 46, motif.couleur);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// `anim` (facultatif) = pose d'articulations de anim.js (poseAnimee) ; absente → rendu statique inchangé.
export function dessiner3D(canvas, recette, kit = KIT, azimut = 0, anim = null) {
  const S = canvas.width;
  const g = geometrie(recette, kit);
  const id = recette.identite;
  const { pieces } = tenueResolue(recette, kit);
  const par = (cat) => pieces.find((p) => p.def.categorie === cat);
  const scene = new THREE.Scene();
  const groupe = new THREE.Group();
  scene.add(groupe, new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
  const soleil = new THREE.DirectionalLight(0xffffff, 1.6);
  soleil.position.set(-2, 4, 5);
  scene.add(soleil);

  const profondeur = g.profondeur; // le torse est une révolution aplatie en Z (0,72 × corps.profondeur)
  // Écartement des jambes (0 au repos, 1 à l'amplitude de la marche) : un vêtement long s'élargit en profondeur vers l'ourlet.
  const ecart = Math.min(1, 2 * Math.max(Math.abs(anim?.hanche?.[1] ?? 0), Math.abs(anim?.hanche?.[-1] ?? 0)));
  // `souple` (0…1) : élargissement maximal (fraction du rayon avant-arrière) de l'ourlet quand les jambes sont écartées.
  const lathe = (yHaut, yBas, marge, couleur, evase = 0, souple = 0) => {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const y = yBas + ((yHaut - yBas) * i) / 20;
      pts.push(new THREE.Vector2(demiLargeur(g, y) + marge + Math.max(0, g.hanchesY - y) * evase, y));
    }
    const geo = new THREE.LatheGeometry(pts, 32);
    if (souple && ecart) {
      const pos = geo.attributes.position, haut = g.hanchesY - yBas;
      for (let i = 0; i < pos.count; i++) {
        const u = Math.min(1, Math.max(0, (g.hanchesY - pos.getY(i)) / haut)); // 0 à la hanche → 1 à l'ourlet
        pos.setZ(i, pos.getZ(i) * (1 + souple * ecart * u * u));
      }
      pos.needsUpdate = true;
    }
    const rMoy = demiLargeur(g, (yHaut + yBas) / 2) + marge;
    const m = new THREE.Mesh(geo, materiau(couleur, kit, Math.PI * rMoy * (1 + profondeur), yHaut - yBas));
    m.scale.z = profondeur;
    groupe.add(m);
    return m;
  };
  // `parent` + (ox, oy) : capsule rattachée à une articulation (coordonnées données dans le repère monde, ramenées au pivot).
  const capsule = (x1, y1, x2, y2, r, couleur, parent = groupe, ox = 0, oy = 0) => {
    const L = Math.hypot(x2 - x1, y2 - y1);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, L), 6, 14), materiau(couleur, kit, 2 * Math.PI * r, L + 2 * r));
    m.position.set((x1 + x2) / 2 - ox, (y1 + y2) / 2 - oy, 0);
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    parent.add(m);
  };
  // Articulations animées : épaules (balancier avant/arrière des bras), hanches puis genoux (chaîne cuisse → mollet).
  const pivotEpaule = {}, pivotHanche = {}, pivotGenou = {};
  for (const c of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(c * g.demiEpaules * 0.98, g.epaulesY - g.H * 0.02, 0);
    e.rotation.x = anim?.epaule?.[c] ?? 0;
    const h = new THREE.Group();
    h.position.set(c * g.ecartJambes, g.hanchesY, 0);
    h.rotation.x = anim?.hanche?.[c] ?? 0;
    const k = new THREE.Group();
    k.position.set(0, g.genouY - g.hanchesY, 0);
    k.rotation.x = anim?.genou?.[c] ?? 0;
    h.add(k);
    groupe.add(e, h);
    pivotEpaule[c] = e; pivotHanche[c] = h; pivotGenou[c] = k;
  }
  groupe.position.y = anim?.dy ?? 0;
  // Pose (cf. kit.poses) : `repos` ou absente → bras droit historique ; sinon bras en deux segments épaule→coude→main.
  // Un clip peut imposer les angles des bras (danse) ; les objets tenus restent ceux de la pose de la recette.
  const poseBase = kit.poses?.[recette.apparence?.pose ?? 'repos'] ?? kit.poses?.repos;
  const poseCourante = anim?.bras ? { ...poseBase, bras: anim.bras } : poseBase;
  const pointsBras = (cote) => pointsBrasKit(g, poseCourante, cote);
  const bras = (cote, t0, t1, r, couleur) => {
    const ep = pivotEpaule[cote], ox = ep.position.x, oy = ep.position.y;
    const cap = (x1, y1, x2, y2) => capsule(x1, y1, x2, y2, r, couleur, ep, ox, oy);
    const pts = pointsBras(cote);
    if (pts) {
      const lerp = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
      if (t0 < 0.5) {
        const u0 = lerp(pts.epaule, pts.coude, t0 * 2), u1 = lerp(pts.epaule, pts.coude, Math.min(t1, 0.5) * 2);
        cap(u0[0], u0[1], u1[0], u1[1]);
      }
      if (t1 > 0.5) {
        const v0 = lerp(pts.coude, pts.main, (Math.max(t0, 0.5) - 0.5) * 2), v1 = lerp(pts.coude, pts.main, (t1 - 0.5) * 2);
        cap(v0[0], v0[1], v1[0], v1[1]);
      }
      return;
    }
    const ax = cote * g.demiEpaules * 0.98, ay = g.epaulesY - g.H * 0.02;
    const bx = cote * (g.demiEpaules + g.H * 0.05), by = ay - g.brasLong;
    cap(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1);
  };
  // Jambes : chaque tronçon est rattaché à la cuisse (hanche) ou au mollet (genou) selon son côté du genou, et coupé au genou.
  const jambes = (yHaut, yBas, couleur, marge = 0) => {
    for (const c of [-1, 1]) for (const s of segmentsJambe(g, yHaut, yBas)) {
      const morceaux = s.y1 > g.genouY && s.y2 < g.genouY ? [{ ...s, y2: g.genouY }, { ...s, y1: g.genouY }] : [s];
      for (const m of morceaux) {
        const haut = (m.y1 + m.y2) / 2 > g.genouY;
        capsule(c * g.ecartJambes, m.y1, c * g.ecartJambes, m.y2, m.r + marge, couleur,
          haut ? pivotHanche[c] : pivotGenou[c], c * g.ecartJambes, haut ? g.hanchesY : g.genouY);
      }
    }
  };

  // Corps de base
  jambes(g.hanchesY, g.jambeR, id.teint);
  for (const c of [-1, 1]) {
    const ch = recette.apparence?.chaussures; // { couleur?, matiere? } ; absent = noires unies
    const specPied = ch?.matiere ? { matiere: ch.matiere, couleur: ch.couleur ?? '#2b2b33' } : (ch?.couleur ?? '#2b2b33');
    const pied = new THREE.Mesh(new THREE.BoxGeometry(g.jambeR * 2.2, g.H * 0.03, g.jambeR * 3.4), materiau(specPied, kit, g.jambeR * 5.6, g.H * 0.03));
    // Rattaché au mollet ; contre-rotation partielle pour que le pied reste à peu près à plat.
    pied.position.set(0, g.H * 0.015 - g.genouY, g.jambeR * 0.6);
    pied.rotation.x = -0.7 * ((anim?.hanche?.[c] ?? 0) + (anim?.genou?.[c] ?? 0));
    pivotGenou[c].add(pied);
  }
  lathe(g.epaulesY, g.hanchesY - g.H * 0.04, 0, id.teint);
  for (const c of [-1, 1]) bras(c, 0, 1, g.brasR, id.teint);
  capsule(0, g.epaulesY, 0, g.cou + g.teteR * 0.3, g.teteR * 0.35 * g.couR, id.teint);
  const tete = new THREE.Mesh(new THREE.SphereGeometry(g.teteR, 24, 18), mat(id.teint));
  tete.position.set(0, g.teteY, 0);
  tete.scale.set(1, 1.08, 0.95);
  groupe.add(tete);

  // Vêtements : coques légèrement plus grandes que le corps, par couche
  for (const e of pieces) {
    const c = e.couleurs ?? {};
    const tex = (v) => (e.matiere ? { matiere: e.matiere, couleur: v } : v); // pièce texturée ou unie (bordures comprises)
    const corps = tex(c.corps);
    const hem = g.hanchesY - g.H * 0.02;
    const decal = (yHaut, yBas) => {
      if (!e.motif || e.motif.type === 'rayures') return;
      const p = pointEmplacement(g, e.motif.emplacement, kit, yBas);
      const r = g.H * 0.045 * (e.motif.echelle ?? 1) * 1.5;
      const plan = new THREE.Mesh(
        new THREE.PlaneGeometry(r * 2, r * 2),
        new THREE.MeshBasicMaterial({ map: texMotif(e.motif), transparent: true }),
      );
      plan.position.set(p.x, p.y, (demiLargeur(g, p.y) + 0.012) * profondeur + 0.002);
      groupe.add(plan);
    };
    switch (e.piece) {
      case 'sous.slip@1': lathe(g.hanchesY + g.H * 0.01, g.hanchesY - g.H * 0.05, 0.004, corps); break;
      case 'haut.tshirt@1':
        for (const s of [-1, 1]) bras(s, 0, 0.42, g.brasR * 1.2, corps);
        lathe(g.epaulesY, hem, 0.008, corps);
        decal(g.epaulesY, hem);
        break;
      case 'haut.chemise@1':
        for (const s of [-1, 1]) bras(s, 0, 1, g.brasR * 1.18, corps);
        lathe(g.epaulesY, hem - g.H * 0.02, 0.008, corps);
        if (e.motif?.type === 'rayures') {
          for (let y = g.epaulesY; y > hem; y -= g.H * 0.1) lathe(y, y - g.H * 0.05, 0.011, e.motif.couleur);
        }
        break;
      case 'haut.pull@1':
        for (const s of [-1, 1]) bras(s, 0, 0.93, g.brasR * 1.22, corps);
        lathe(g.epaulesY, hem - g.H * 0.02, 0.01, corps);
        lathe(hem - g.H * 0.01, hem - g.H * 0.03, 0.012, tex(c.bordure)); // bord côtelé
        for (const s of [-1, 1]) bras(s, 0.84, 0.93, g.brasR * 1.27, tex(c.bordure)); // poignets (la main dépasse)
        decal(g.epaulesY, hem - g.H * 0.02);
        break;
      case 'haut.gilet@1': lathe(g.epaulesY, hem - g.H * 0.03, 0.014, corps); break;
      case 'haut.manteau@1':
        // SIMPLIFICATION assumée : pas d'ouverture ni de revers en 3D (cf. spec §7)
        for (const s of [-1, 1]) bras(s, 0, 1, g.brasR * 1.4, corps);
        lathe(g.epaulesY, g.hanchesY * 0.52, 0.022, corps, 0.35, 0.3);
        break;
      case 'bas.short@1':
        lathe(g.hanchesY + g.H * 0.02, g.hanchesY - g.H * 0.07, 0.008, corps);
        jambes(g.hanchesY, g.hanchesY * 0.68, corps, 0.008);
        break;
      case 'bas.jupe@1': {
        const bas = g.hanchesY - g.H * 0.17;
        lathe(g.hanchesY + g.H * 0.02, bas, 0.01, corps, 0.6, 0.25);
        lathe(bas + g.H * 0.022, bas, 0.012, tex(c.bordure), 0.6, 0.25);
        break;
      }
      case 'bas.pantalon@1':
        lathe(g.hanchesY + g.H * 0.02, g.hanchesY - g.H * 0.07, 0.008, corps);
        jambes(g.hanchesY, g.jambeR + 0.002, corps, 0.008);
        break;
    }
  }

  // Chapeau : bord plat + calotte + ruban (posés sur la tête procédurale ; le maillage de tête garde ses propres cheveux dessous)
  {
    const h = par('tete');
    if (h) {
      const R = g.teteR, y = g.teteY + R * 0.5;
      const tissu = h.matiere ? { matiere: h.matiere, couleur: h.couleurs.corps } : h.couleurs.corps;
      const bord = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.7, R * 1.7, R * 0.07, 36), materiau(tissu, kit, 2 * Math.PI * R * 1.7, R * 0.4));
      bord.position.set(0, y, 0);
      const calotte = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), materiau(tissu, kit, 2 * Math.PI * R, R * 1.5));
      calotte.scale.y = 0.62;
      calotte.position.set(0, y, 0);
      const ruban = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.015, R * 1.04, R * 0.2, 28), mat(h.couleurs.ruban));
      ruban.position.set(0, y + R * 0.1, 0);
      groupe.add(bord, calotte, ruban);
    }
  }

  // Accessoires tenus en main (cocktail : verre conique, boisson, paille)
  for (const o of poseCourante?.objets ?? []) {
    const pts = pointsBras(o.cote);
    if (pts && o.type === 'canne') {
      const [cx, cy] = pts.main;
      const haut = cy + g.H * 0.05;
      const tige = new THREE.Mesh(new THREE.CylinderGeometry(g.H * 0.006, g.H * 0.006, haut, 10), mat('#6b4a2b'));
      tige.position.set(cx, haut / 2, g.brasR * 0.5);
      const poignee = new THREE.Mesh(new THREE.CylinderGeometry(g.H * 0.006, g.H * 0.006, g.H * 0.035, 10), mat('#6b4a2b'));
      poignee.rotation.z = Math.PI / 2;
      poignee.position.set(cx + g.H * 0.0175, haut, g.brasR * 0.5);
      groupe.add(tige, poignee);
      continue;
    }
    if (!pts || o.type !== 'cocktail') continue;
    const u = g.H * 0.05;
    const [hx, hy] = pts.main;
    const verre = new THREE.Group();
    verre.position.set(hx, hy + u * 0.4, g.brasR * 0.5);
    const cone = (rHaut, rBas, h, y, couleur, opacite = 1) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rHaut, rBas, h, 16), mat(couleur));
      if (opacite < 1) { m.material.transparent = true; m.material.opacity = opacite; }
      m.position.y = y;
      verre.add(m);
    };
    cone(u * 0.9, u * 0.55, u * 1.4, u * 0.9, '#e8f1f5', 0.55);
    cone(u * 0.8, u * 0.55, u * 1.05, u * 0.72, '#ff6b3d');
    const paille = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.06, u * 0.06, u * 1.6, 8), mat('#2e8b57'));
    paille.position.set(u * 0.45, u * 1.4, 0);
    paille.rotation.z = -0.35;
    verre.add(paille);
    groupe.add(verre);
  }

  // Visage et cheveux
  const f = g.visage;
  const face = kit.visagesImage?.[id.visage] ?? null;
  const maillage = kit.visagesMaillage?.[id.visage] ?? null;
  if (maillage) {
    // Vraie tête 3D : mise à l'échelle sur la hauteur crâne→menton de la tête procédurale, plan de coupe sous les cheveux.
    const m = modeles.get(maillage.src);
    if (!m) throw new Error(`modèle non chargé (appeler preparerModeles avant dessiner3D) : ${maillage.src}`);
    tete.visible = false;
    const taille = m.boite.getSize(new THREE.Vector3()), centre = m.boite.getCenter(new THREE.Vector3());
    const s = (2.16 * g.teteR) / (taille.y * maillage.hauteurMenton);
    const haut = g.teteY + 1.08 * g.teteR;
    const tete3d = m.scene.clone(true);
    tete3d.scale.setScalar(s);
    tete3d.position.set(-centre.x * s, haut - m.boite.max.y * s, -centre.z * s);
    const coupe = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(haut - taille.y * maillage.coupe * s));
    tete3d.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.clippingPlanes = [coupe];
      o.material.side = THREE.DoubleSide;
    });
    groupe.add(tete3d);
  } else if (face) {
    // Visage image : décalque de face (plan texturé devant la tête), même placement que le rendu 2D.
    // Valable pour la caméra de face seulement : pas de profil ni de dos (limite documentée, spec §9 ter).
    tete.visible = false; // comme en 2D : la tête procédurale n'est pas dessinée
    const LARG = 512; // largeur du crâne dans la texture (px)
    const v = visageEnCanvas(face, LARG, id.teint);
    const echelle = (2 * g.teteR) / LARG; // mètres par pixel
    const haut = g.teteY + (v.hauteurMenton * echelle) / 2; // haut du crâne, comme en 2D
    const tex = new THREE.CanvasTexture(v.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plan = new THREE.Mesh(
      new THREE.PlaneGeometry(v.canvas.width * echelle, v.canvas.height * echelle),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }),
    );
    plan.position.set(
      -g.teteR - v.ox * echelle + (v.canvas.width * echelle) / 2,
      haut + v.oy * echelle - (v.canvas.height * echelle) / 2,
      0.5,
    );
    groupe.add(plan);
  } else {
  for (const s of [-1, 1]) {
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(g.teteR * 0.1, 10, 8), mat('#20150f'));
    oeil.position.set(s * g.teteR * f.ecartYeux, g.teteY + g.teteR * 0.05, g.teteR * 0.9);
    groupe.add(oeil);
  }
  const cheveux = id.cheveux && kit.pieces[id.cheveux.piece] ? id.cheveux : null;
  if (cheveux) {
    const calotte = new THREE.Mesh(
      new THREE.SphereGeometry(g.teteR * 1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mat(cheveux.couleur),
    );
    calotte.position.set(0, g.teteY + g.teteR * 0.1, -g.teteR * 0.02);
    groupe.add(calotte);
    if (cheveux.piece === 'cheveux.long@1') {
      const nuque = new THREE.Mesh(new THREE.CapsuleGeometry(g.teteR * 0.95, g.teteY - g.epaulesY, 6, 14), mat(cheveux.couleur));
      nuque.position.set(0, (g.teteY + g.epaulesY) / 2, -g.teteR * 0.45);
      groupe.add(nuque);
    }
  }
  }

  groupe.rotation.y = azimut; // 0 = de face ; π/2 = profil (le décalque de visage image n'a pas de profil, le maillage si)
  const demi = kit.rendu.cadre / 2;
  const bas = -kit.rendu.cadre * (1 - kit.rendu.sol);
  const cam = new THREE.OrthographicCamera(-demi, demi, bas + kit.rendu.cadre, bas, 0.1, 20);
  cam.position.set(0, 0, 8);
  const r = moteur(S);
  r.render(scene, cam);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(r.domElement, 0, 0, S, S);
  scene.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) { if (!o.material.map?.userData.partage) o.material.map?.dispose(); o.material.dispose(); }
  });
}
