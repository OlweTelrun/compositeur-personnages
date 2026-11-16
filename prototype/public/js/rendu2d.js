// Rendu 2D par couches (canvas) à partir de la géométrie partagée. Procédural :
// sert à valider le CONTRAT (couches, masquage, emplacements, ancrage), pas le style.
import { KIT, geometrie, segmentsJambe, pointsBras as pointsBrasKit, demiLargeur, pointEmplacement, tenueResolue, placementsVisage, ROLES_PEAU, teinter, hexVersRgb } from './kit.js';
import { chargerMatieres, motifMatiere } from './matieres.js';

export function dessinerMotif(ctx, type, cx, cy, r, couleur) {
  ctx.fillStyle = couleur;
  ctx.strokeStyle = couleur;
  if (type === 'coeur') {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r);
    ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.7, cy - r * 1.3, cx, cy - r * 0.35);
    ctx.bezierCurveTo(cx + r * 0.7, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r);
    ctx.fill();
  } else if (type === 'soleil') {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
      ctx.lineTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
      ctx.stroke();
    }
  }
}

// Images des visages « en pièces » : chargées d'avance (preparerImages), jamais en cours de dessin.
const images = new Map();
export function preparerImages(kit = KIT) {
  const srcs = new Set();
  const matieres = chargerMatieres(kit); // matières des vêtements, chargées avec les images de visage
  for (const d of Object.values(kit.visagesImage ?? {})) {
    d.calques.forEach((c) => srcs.add(c.src));
    srcs.add(d.cheveux.src);
  }
  return Promise.all([matieres, ...[...srcs].map((src) => images.has(src) ? null : new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => { images.set(src, i); ok(); };
    i.onerror = () => ko(new Error(`image de visage introuvable : ${src}`));
    i.src = src;
  }))]);
}
const image = (src) => {
  const i = images.get(src);
  if (!i) throw new Error(`image non chargée (appeler preparerImages avant dessiner2D) : ${src}`);
  return i;
};
// Couleur d'origine de la peau d'une planche : médiane des pixels opaques de la zone de référence.
const refs = new Map();
function peauOrigine(src, zone) {
  const cle = `${src}|${zone}`;
  if (refs.has(cle)) return refs.get(cle);
  const [x0, y0, x1, y1] = zone;
  const c = document.createElement('canvas');
  c.width = x1 - x0; c.height = y1 - y0;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(image(src), x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  const d = cx.getImageData(0, 0, c.width, c.height).data;
  const canaux = [[], [], []];
  for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 250) for (let j = 0; j < 3; j++) canaux[j].push(d[i + j]);
  const med = canaux.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
  refs.set(cle, med);
  return med;
}
// Pièce de peau recolorée (mise en cache par planche, zone et teint)
const teintees = new Map();
function pieceTeintee(p, def, teint) {
  const cle = `${p.src}|${p.rect}|${teint}`;
  if (teintees.has(cle)) return teintees.get(cle);
  const [x0, y0, x1, y1] = p.rect;
  const c = document.createElement('canvas');
  c.width = x1 - x0; c.height = y1 - y0;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(image(p.src), x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  const im = cx.getImageData(0, 0, c.width, c.height);
  const ref = peauOrigine(p.src, def.peauRef[p.src]);
  const cible = hexVersRgb(teint);
  for (let i = 0; i < im.data.length; i += 4) {
    const [r, g, b] = teinter([im.data[i], im.data[i + 1], im.data[i + 2]], ref, cible);
    im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b;
  }
  cx.putImageData(im, 0, 0);
  teintees.set(cle, c);
  return c;
}
function dessinerPiece(ctx, p, ox, oy, def, teint) {
  const [x0, y0, x1, y1] = p.rect;
  const coupe = p.coupeBas ?? 1;
  const h = (y1 - y0) * coupe;
  if (teint && ROLES_PEAU.includes(p.role) && def.peauRef?.[p.src]) {
    ctx.drawImage(pieceTeintee(p, def, teint), 0, 0, x1 - x0, h, ox + p.dx, oy + p.dy, p.dw, p.dh * coupe);
  } else {
    ctx.drawImage(image(p.src), x0, y0, x1 - x0, h, ox + p.dx, oy + p.dy, p.dw, p.dh * coupe);
  }
}

/**
 * Visage image complet (oreilles, crâne, traits, cheveux) sur son propre canvas transparent, pour le rendu 3D
 * (décalque de face). `largeurCranePx` = largeur du crâne dans ce canvas ; (ox, oy) = coin haut-gauche du crâne.
 */
export function visageEnCanvas(face, largeurCranePx, teint) {
  const pl = placementsVisage(face, largeurCranePx);
  const tous = [...pl.calques, pl.cheveux];
  const x0 = Math.min(...tous.map((p) => p.dx)), y0 = Math.min(...tous.map((p) => p.dy));
  const x1 = Math.max(...tous.map((p) => p.dx + p.dw)), y1 = Math.max(...tous.map((p) => p.dy + p.dh * (p.coupeBas ?? 1)));
  const c = document.createElement('canvas');
  c.width = Math.ceil(x1 - x0) + 2; c.height = Math.ceil(y1 - y0) + 2;
  const ctx = c.getContext('2d');
  const ox = -x0 + 1, oy = -y0 + 1;
  for (const p of pl.calques) dessinerPiece(ctx, p, ox, oy, face, teint);
  dessinerPiece(ctx, pl.cheveux, ox, oy, face, null);
  return { canvas: c, ox, oy, hauteurMenton: pl.hauteurMenton };
}

export function dessiner2D(canvas, recette, kit = KIT) {
  const S = canvas.width;
  const k = S / kit.rendu.cadre;
  const X = (x) => S / 2 + x * k;
  const Y = (y) => S * kit.rendu.sol - y * k;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const g = geometrie(recette, kit);
  const id = recette.identite;
  const { pieces } = tenueResolue(recette, kit);
  const par = (cat) => pieces.find((p) => p.def.categorie === cat);

  const capsule = (x1, y1, x2, y2, r, couleur) => {
    ctx.strokeStyle = couleur;
    ctx.lineWidth = r * 2 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(x1), Y(y1));
    ctx.lineTo(X(x2), Y(y2));
    ctx.stroke();
  };
  // Pose : angles [bras, avant-bras] du côté ; absente ou `repos` → bras droit historique.
  const poseCourante = kit.poses?.[recette.apparence?.pose ?? 'repos'] ?? kit.poses?.repos;
  const pointsBras = (cote) => pointsBrasKit(g, poseCourante, cote);
  const bras = (cote, t0, t1, r, couleur) => {
    const pts = pointsBras(cote);
    if (pts) {
      // t ∈ [0,1] le long de l'épaule → coude (0–0,5) puis coude → main (0,5–1)
      const lerp = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
      if (t0 < 0.5) {
        const u0 = lerp(pts.epaule, pts.coude, t0 * 2), u1 = lerp(pts.epaule, pts.coude, Math.min(t1, 0.5) * 2);
        capsule(u0[0], u0[1], u1[0], u1[1], r, couleur);
      }
      if (t1 > 0.5) {
        const v0 = lerp(pts.coude, pts.main, (Math.max(t0, 0.5) - 0.5) * 2), v1 = lerp(pts.coude, pts.main, (t1 - 0.5) * 2);
        capsule(v0[0], v0[1], v1[0], v1[1], r, couleur);
      }
      return;
    }
    const ax = cote * g.demiEpaules * 0.98, ay = g.epaulesY - g.H * 0.02;
    const bx = cote * (g.demiEpaules + g.H * 0.05), by = ay - g.brasLong;
    capsule(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, r, couleur);
  };
  const torse = (yHaut, yBas, marge = 0, evase = 0) => {
    ctx.beginPath();
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const y = yHaut + ((yBas - yHaut) * i) / n;
      const w = demiLargeur(g, y) + marge + Math.max(0, g.hanchesY - y) * evase;
      i === 0 ? ctx.moveTo(X(-w), Y(y)) : ctx.lineTo(X(-w), Y(y));
    }
    for (let i = n; i >= 0; i--) {
      const y = yHaut + ((yBas - yHaut) * i) / n;
      const w = demiLargeur(g, y) + marge + Math.max(0, g.hanchesY - y) * evase;
      ctx.lineTo(X(w), Y(y));
    }
    ctx.closePath();
  };
  const jambes = (yHaut, yBas, couleur, marge = 0) => {
    for (const c of [-1, 1]) for (const s of segmentsJambe(g, yHaut, yBas)) capsule(c * g.ecartJambes, s.y1, c * g.ecartJambes, s.y2, s.r + marge, couleur);
  };
  const motif = (e, yHaut, yBas) => {
    if (!e.motif) return;
    const m = e.motif;
    ctx.save();
    torse(yHaut, yBas);
    ctx.clip();
    if (m.type === 'rayures') {
      ctx.fillStyle = m.couleur;
      const pas = g.H * 0.05;
      for (let y = yBas; y < yHaut; y += pas) ctx.fillRect(0, Y(y + pas * 0.5), S, pas * 0.5 * k);
    } else {
      const p = pointEmplacement(g, m.emplacement, kit, yBas);
      dessinerMotif(ctx, m.type, X(p.x), Y(p.y), g.H * 0.045 * (m.echelle ?? 1) * k, m.couleur);
    }
    ctx.restore();
  };

  // 0 — cheveux longs derrière le corps
  const face = kit.visagesImage?.[id.visage] ?? null; // visage en pièces : porte ses propres cheveux
  const cheveux = !face && id.cheveux && kit.pieces[id.cheveux.piece] ? id.cheveux : null;
  if (cheveux?.piece === 'cheveux.long@1') {
    ctx.fillStyle = cheveux.couleur;
    const w = g.teteR * 1.15;
    ctx.beginPath();
    ctx.roundRect(X(-w), Y(g.teteY + g.teteR * 0.2), 2 * w * k, (g.teteY - g.epaulesY + g.teteR * 0.7) * k, g.teteR * 0.5 * k);
    ctx.fill();
  }

  // Corps de base : jambes, pieds, torse, bras, cou, tête (couche « peau »)
  jambes(g.hanchesY, g.jambeR, id.teint);
  const chaussures = recette.apparence?.chaussures; // { couleur?, matiere? } ; absent = noires unies comme avant
  ctx.fillStyle = chaussures?.matiere ? motifMatiere(ctx, kit.matieres[chaussures.matiere], chaussures.couleur ?? '#2b2b33', k, X(0), Y(0)) : (chaussures?.couleur ?? '#2b2b33');
  for (const c of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(X(c * g.ecartJambes), Y(g.H * 0.015), g.jambeR * 1.5 * k, g.H * 0.02 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = id.teint;
  torse(g.epaulesY, g.hanchesY - g.H * 0.04);
  ctx.fill();
  for (const c of [-1, 1]) bras(c, 0, 1, g.brasR, id.teint);
  capsule(0, g.epaulesY, 0, g.cou + g.teteR * 0.3, g.teteR * 0.35 * g.couR, id.teint);
  // Placement du visage image : crâne centré sur la tête procédurale (même largeur, même hauteur au menton)
  let pl = null, ox = 0, oy = 0;
  if (face) {
    const largeur = 2 * g.teteR * k;
    pl = placementsVisage(face, largeur);
    ox = X(0) - largeur / 2;
    oy = Y(g.teteY) - pl.hauteurMenton / 2;
  } else {
    ctx.beginPath();
    ctx.ellipse(X(0), Y(g.teteY), g.teteR * k, g.teteR * 1.08 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vêtements par couche croissante
  for (const e of pieces) {
    const c = e.couleurs ?? {};
    // Matière de la pièce : motif ancré sur le personnage (origine = pied, centre), k = px par mètre ; col et bordures suivent la même matière.
    const mc = (v) => (e.matiere ? motifMatiere(ctx, kit.matieres[e.matiere], v, k, X(0), Y(0)) : v);
    const corps = mc(c.corps);
    const hem = g.hanchesY - g.H * 0.02;
    switch (e.piece) {
      case 'sous.slip@1':
        ctx.fillStyle = corps;
        torse(g.hanchesY + g.H * 0.01, g.hanchesY - g.H * 0.05, 0.004);
        ctx.fill();
        break;
      case 'haut.tshirt@1':
        for (const s of [-1, 1]) bras(s, 0, 0.42, g.brasR * 1.2, corps);
        ctx.fillStyle = corps;
        torse(g.epaulesY, hem, 0.004);
        ctx.fill();
        motif(e, g.epaulesY, hem);
        capsule(0, g.epaulesY + g.H * 0.012, 0, g.epaulesY + g.H * 0.014, g.teteR * 0.42, mc(c.col));
        break;
      case 'haut.chemise@1':
        for (const s of [-1, 1]) bras(s, 0, 1, g.brasR * 1.18, corps);
        ctx.fillStyle = corps;
        torse(g.epaulesY, hem - g.H * 0.02, 0.004);
        ctx.fill();
        motif(e, g.epaulesY, hem - g.H * 0.02);
        capsule(0, g.epaulesY + g.H * 0.012, 0, g.epaulesY + g.H * 0.014, g.teteR * 0.42, mc(c.col));
        break;
      case 'haut.pull@1':
        for (const s of [-1, 1]) bras(s, 0, 0.93, g.brasR * 1.22, corps);
        ctx.fillStyle = corps;
        torse(g.epaulesY, hem - g.H * 0.02, 0.006);
        ctx.fill();
        motif(e, g.epaulesY, hem - g.H * 0.02);
        ctx.fillStyle = mc(c.bordure); // bord côtelé
        torse(hem - g.H * 0.01, hem - g.H * 0.03, 0.007);
        ctx.fill();
        for (const s of [-1, 1]) bras(s, 0.84, 0.93, g.brasR * 1.27, mc(c.bordure)); // poignets (la main dépasse)
        capsule(0, g.epaulesY + g.H * 0.012, 0, g.epaulesY + g.H * 0.014, g.teteR * 0.44, mc(c.col));
        break;
      case 'haut.gilet@1': {
        ctx.fillStyle = corps;
        torse(g.epaulesY, hem - g.H * 0.03, 0.006);
        ctx.fill();
        const chemise = par('haut') ? par('haut').couleurs.corps : id.teint;
        ctx.fillStyle = chemise; // encolure en V : la chemise reste visible dessous
        ctx.beginPath();
        ctx.moveTo(X(-g.demiEpaules * 0.28), Y(g.epaulesY));
        ctx.lineTo(X(g.demiEpaules * 0.28), Y(g.epaulesY));
        ctx.lineTo(X(0), Y(g.epaulesY - g.H * 0.16));
        ctx.fill();
        ctx.strokeStyle = mc(c.bordure);
        ctx.lineWidth = Math.max(1, 0.012 * k);
        torse(g.epaulesY, hem - g.H * 0.03, 0.006);
        ctx.stroke();
        break;
      }
      case 'haut.manteau@1': {
        const bas = g.hanchesY * 0.52;
        for (const s of [-1, 1]) bras(s, 0, 1, g.brasR * 1.4, corps);
        ctx.fillStyle = corps;
        torse(g.epaulesY, bas, 0.014, 0.35);
        ctx.fill();
        // ouverture centrale : montre gilet/chemise (ou le corps si rien dessous)
        const dessous = par('gilet')?.couleurs.corps ?? par('haut')?.couleurs.corps ?? '#00000000';
        ctx.fillStyle = dessous;
        ctx.beginPath();
        ctx.moveTo(X(-g.H * 0.02), Y(g.epaulesY));
        ctx.lineTo(X(g.H * 0.02), Y(g.epaulesY));
        ctx.lineTo(X(g.H * 0.026), Y(bas));
        ctx.lineTo(X(-g.H * 0.026), Y(bas));
        ctx.fill();
        ctx.fillStyle = c.revers; // revers
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(X(s * g.H * 0.02), Y(g.epaulesY + g.H * 0.01));
          ctx.lineTo(X(s * g.demiEpaules * 0.7), Y(g.epaulesY));
          ctx.lineTo(X(s * g.H * 0.03), Y(g.epaulesY - g.H * 0.17));
          ctx.fill();
        }
        ctx.strokeStyle = mc(c.bordure); // galon le long de l'ouverture
        ctx.lineWidth = Math.max(1, 0.012 * k);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(X(s * g.H * 0.02), Y(g.epaulesY - g.H * 0.17));
          ctx.lineTo(X(s * g.H * 0.026), Y(bas));
          ctx.stroke();
        }
        ctx.fillStyle = c.boutons;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(X(g.H * 0.045), Y(g.epaulesY - g.H * (0.2 + i * 0.09)), Math.max(1, g.H * 0.008 * k), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'bas.short@1':
        ctx.fillStyle = corps;
        torse(g.hanchesY + g.H * 0.02, g.hanchesY - g.H * 0.07, 0.006);
        ctx.fill();
        jambes(g.hanchesY, g.hanchesY * 0.68, corps, 0.006);
        break;
      case 'bas.jupe@1': {
        const bas = g.hanchesY - g.H * 0.17;
        ctx.fillStyle = corps;
        torse(g.hanchesY + g.H * 0.02, bas, 0.006, 0.6);
        ctx.fill();
        ctx.fillStyle = mc(c.bordure);
        torse(bas + g.H * 0.022, bas, 0.006, 0.6);
        ctx.fill();
        break;
      }
      case 'bas.pantalon@1':
        ctx.fillStyle = corps;
        torse(g.hanchesY + g.H * 0.02, g.hanchesY - g.H * 0.07, 0.006);
        ctx.fill();
        jambes(g.hanchesY, g.jambeR + 0.002, corps, 0.006);
        break;
    }
  }

  // Accessoires tenus en main (par-dessus les vêtements, sous le visage)
  for (const o of poseCourante?.objets ?? []) {
    const pts = pointsBras(o.cote);
    if (!pts) continue;
    const [hx, hy] = pts.main;
    if (o.type === 'canne') {
      const haut = hy + g.H * 0.05;
      capsule(hx, haut, hx, g.H * 0.008, g.H * 0.006, '#6b4a2b');
      capsule(hx, haut, hx + g.H * 0.035, haut, g.H * 0.006, '#6b4a2b'); // poignée
      continue;
    }
    if (o.type === 'cocktail') {
      const u = g.H * 0.05; // unité de taille
      ctx.save();
      ctx.translate(X(hx), Y(hy + u * 0.4));
      ctx.fillStyle = '#e8f1f5'; // verre
      ctx.strokeStyle = '#7d8c93';
      ctx.lineWidth = Math.max(1, 0.006 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.9 * k, -u * 1.6 * k);
      ctx.lineTo(u * 0.9 * k, -u * 1.6 * k);
      ctx.lineTo(u * 0.55 * k, -u * 0.2 * k);
      ctx.lineTo(-u * 0.55 * k, -u * 0.2 * k);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff6b3d'; // boisson
      ctx.beginPath();
      ctx.moveTo(-u * 0.8 * k, -u * 1.25 * k);
      ctx.lineTo(u * 0.8 * k, -u * 1.25 * k);
      ctx.lineTo(u * 0.55 * k, -u * 0.2 * k);
      ctx.lineTo(-u * 0.55 * k, -u * 0.2 * k);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2e8b57'; // paille
      ctx.lineWidth = Math.max(1, 0.008 * k);
      ctx.beginPath();
      ctx.moveTo(u * 0.2 * k, -u * 0.8 * k);
      ctx.lineTo(u * 0.7 * k, -u * 2.2 * k);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Chapeau (au-dessus de tout, visage et cheveux compris)
  const chapeau = () => {
    const h = par('tete');
    if (!h) return;
    const c = h.couleurs ?? {};
    const R = g.teteR, cx = X(0), yb = Y(g.teteY + R * 0.5);
    const tissu = h.matiere ? motifMatiere(ctx, kit.matieres[h.matiere], c.corps, k, X(0), Y(0)) : c.corps;
    ctx.fillStyle = tissu; // bord
    ctx.beginPath();
    ctx.ellipse(cx, yb, R * 1.7 * k, R * 0.26 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save(); // calotte (demi-ellipse) et ruban
    ctx.beginPath();
    ctx.ellipse(cx, yb, R * 1.0 * k, R * 0.62 * k, 0, Math.PI, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = c.ruban;
    ctx.fillRect(cx - R * 1.1 * k, yb - R * 0.24 * k, R * 2.2 * k, R * 0.2 * k);
    ctx.restore();
  };

  // Visage puis cheveux courts (au-dessus de tout)
  if (face) {
    // le visage image est dessiné APRÈS les vêtements : le menton passe devant le col
    for (const c of pl.calques) dessinerPiece(ctx, c, ox, oy, face, id.teint); // oreilles, crâne, traits
    dessinerPiece(ctx, pl.cheveux, ox, oy, face, null);
    chapeau();
    return;
  }
  const f = g.visage;
  ctx.fillStyle = '#20150f';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(X(s * g.teteR * f.ecartYeux), Y(g.teteY + g.teteR * 0.05), Math.max(1, g.teteR * 0.1 * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#7a3b2e';
  ctx.lineWidth = Math.max(1, g.teteR * 0.07 * k);
  ctx.beginPath();
  if (f.bouche === 'sourire') ctx.arc(X(0), Y(g.teteY - g.teteR * 0.3), g.teteR * 0.28 * k, 0.15 * Math.PI, 0.85 * Math.PI);
  else { ctx.moveTo(X(-g.teteR * 0.2), Y(g.teteY - g.teteR * 0.38)); ctx.lineTo(X(g.teteR * 0.2), Y(g.teteY - g.teteR * 0.38)); }
  ctx.stroke();
  if (cheveux) {
    ctx.fillStyle = cheveux.couleur;
    ctx.beginPath();
    ctx.ellipse(X(0), Y(g.teteY + g.teteR * 0.25), g.teteR * 1.08 * k, g.teteR * 0.95 * k, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
  }
  chapeau();
}
