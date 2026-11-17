// Spécifications canoniques du gabarit 2D maître (560 × 840 px) et générateur
// des fichiers guides téléchargeables (PNG transparent + SVG vectoriel par calques)
// ainsi que de la grille d'aide affichée dans le Studio.

export const GABARIT_SPEC = {
  width: 560,
  height: 840,
  portraitSize: 512,
  centerX: 280,
  faceBox: {
    x: 230,
    y: 66,
    width: 100,
    height: 120,
  },
  landmarks: [
    { key: 'hairTopY', label: 'Marge haute (coiffure / chapeau)', y: 24, width: 170, color: '#8b5cf6', dash: true },
    { key: 'crownY', label: 'Sommet du crâne', y: 66, width: 100, color: '#ec4899', dash: false },
    { key: 'browY', label: 'Axe des sourcils', y: 114, width: 84, color: '#6366f1', dash: true },
    { key: 'eyeY', label: 'Axe des yeux / lunettes', y: 128, width: 92, color: '#0ea5e9', dash: false },
    { key: 'noseY', label: 'Pointe du nez', y: 148, width: 46, color: '#14b8a6', dash: true },
    { key: 'mouthY', label: 'Axe de la bouche', y: 165, width: 64, color: '#f43f5e', dash: true },
    { key: 'chinY', label: 'Pointe du menton', y: 186, width: 68, color: '#ec4899', dash: false },
    { key: 'neckY', label: 'Base du cou / Col hauts', y: 198, width: 46, color: '#0284c7', dash: false },
    { key: 'shoulderY', label: 'Épaules (torse 148 · bras 192 px)', y: 224, width: 148, outerWidth: 192, color: '#2563eb', dash: false },
    { key: 'waistY', label: 'Taille / Ceinture des bas (108 px)', y: 342, width: 108, color: '#16a34a', dash: false },
    { key: 'hipY', label: 'Hanches / Bassin (148 px)', y: 408, width: 148, color: '#d97706', dash: false },
    { key: 'kneeY', label: 'Genoux / Ourlet robe (116 px)', y: 576, width: 116, color: '#ca8a04', dash: true },
    { key: 'feetY', label: 'Sol / Semelles chaussures (156 px)', y: 812, width: 156, color: '#dc2626', dash: false },
  ],
  reglesCategories: [
    { cat: 'Silhouettes (corps)', spec: 'Toile 560×840 RGBA. Cou de Y=176 à 210, épaules à Y=224, taille à Y=342, hanches à Y=408, pieds posés sur Y=812. Centré sur X=280.' },
    { cat: 'Têtes', spec: 'Crâne de Y=66 à Y=186 (100×120 px) centré X=280. Le haut du cou peut descendre jusqu’à Y=206 (il sera fondu au-dessus du col).' },
    { cat: 'Visage (yeux, sourcils, nez, bouche)', spec: 'Fond 100% transparent, centré X=280. Y sourcils=114, Y yeux=128, Y nez=148, Y bouche=165 (ou export serré sans halo vert/blanc).' },
    { cat: 'Cheveux & Chapeaux', spec: 'Coiffure calée entre Y=24 et Y=290 autour du crâne (66..186), sans coupe plate en haut. Fond transparent.' },
    { cat: 'Hauts / Robes', spec: 'Col autour de Y=198–218, couture épaules X=206..354 (148 px), manches jusqu’à 200 px, ourlet taille Y=342–395 (ou genoux Y=585 pour une robe).' },
    { cat: 'Bas & Chaussures', spec: 'Ceinture du bas à Y=342–360 (largeur ~108–150 px). Chaussures alignées sur les semelles Y=812 (écartement total ~156 px).' },
  ],
};

function drawGuideSilhouette(ctx) {
  const cx = GABARIT_SPEC.centerX;
  ctx.save();
  ctx.fillStyle = 'rgba(37, 99, 235, 0.065)';
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.28)';
  ctx.lineWidth = 1.5;

  // Ovale de tête (Y=66..186, R=50x60)
  ctx.beginPath();
  ctx.ellipse(cx, 126, 48, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tronc + cou + membres schématiques
  ctx.beginPath();
  // Cou
  ctx.moveTo(cx - 21, 180);
  ctx.lineTo(cx - 23, 202);
  // Épaule gauche -> bras gauche
  ctx.quadraticCurveTo(cx - 58, 210, cx - 84, 224);
  ctx.quadraticCurveTo(cx - 102, 260, cx - 106, 360);
  ctx.lineTo(cx - 104, 435);
  ctx.lineTo(cx - 84, 435);
  ctx.lineTo(cx - 72, 275);
  // Flanc gauche taille -> hanches -> jambe gauche -> pied
  ctx.lineTo(cx - 54, 342);
  ctx.quadraticCurveTo(cx - 78, 385, cx - 74, 425);
  ctx.lineTo(cx - 64, 576);
  ctx.lineTo(cx - 60, 792);
  ctx.lineTo(cx - 78, 812);
  ctx.lineTo(cx - 16, 812);
  ctx.lineTo(cx - 22, 576);
  ctx.lineTo(cx - 8, 452);
  // Entrejambe -> jambe droite -> pied droit
  ctx.lineTo(cx + 8, 452);
  ctx.lineTo(cx + 22, 576);
  ctx.lineTo(cx + 16, 812);
  ctx.lineTo(cx + 78, 812);
  ctx.lineTo(cx + 60, 792);
  ctx.lineTo(cx + 64, 576);
  ctx.lineTo(cx + 74, 425);
  ctx.quadraticCurveTo(cx + 78, 385, cx + 54, 342);
  // Bras droit -> épaule droite -> cou
  ctx.lineTo(cx + 72, 275);
  ctx.lineTo(cx + 84, 435);
  ctx.lineTo(cx + 104, 435);
  ctx.lineTo(cx + 106, 360);
  ctx.quadraticCurveTo(cx + 102, 260, cx + 84, 224);
  ctx.quadraticCurveTo(cx + 58, 210, cx + 23, 202);
  ctx.lineTo(cx + 21, 180);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Zone marge coiffure / chapeau
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.38)';
  ctx.beginPath();
  ctx.ellipse(cx, 114, 82, 90, 0, Math.PI * 0.9, Math.PI * 2.1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Génère un canevas PNG transparent de 560 × 840 px servant de gabarit de dessin exact.
 */
export function genererGabaritGuideCanvas(avecCartouche = true) {
  const { width: W, height: H, centerX: cx } = GABARIT_SPEC;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Cadre extérieur & grille 40px légère
  ctx.save();
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 40; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 40; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  ctx.restore();

  // Règle verticale graduée à gauche
  ctx.save();
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
  ctx.font = '10px "JetBrains Mono", monospace';
  for (let y = 0; y <= H; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(10, y); ctx.stroke();
    if (y > 0 && y < H - 10) ctx.fillText(String(y), 13, y + 3);
  }
  ctx.restore();

  // Axe vertical central X=280
  ctx.save();
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, 8);
  ctx.lineTo(cx, H - 8);
  ctx.stroke();
  ctx.fillStyle = '#1d4ed8';
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillText('AXE X=280', cx + 5, 16);
  ctx.restore();

  // Silhouette guide schématique
  drawGuideSilhouette(ctx);

  // Lignes de repères exactes
  ctx.save();
  ctx.font = '500 10px "Plus Jakarta Sans", sans-serif';
  for (const lm of GABARIT_SPEC.landmarks) {
    const span = lm.outerWidth ?? lm.width;
    ctx.strokeStyle = lm.color;
    ctx.lineWidth = 1.25;
    ctx.setLineDash(lm.dash ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(cx - span / 2, lm.y);
    ctx.lineTo(cx + span / 2, lm.y);
    ctx.stroke();

    // Petits marqueurs d'extrémité
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx - span / 2, lm.y - 4);
    ctx.lineTo(cx - span / 2, lm.y + 4);
    ctx.moveTo(cx + span / 2, lm.y - 4);
    ctx.lineTo(cx + span / 2, lm.y + 4);
    ctx.stroke();

    if (lm.outerWidth && lm.width !== lm.outerWidth) {
      ctx.beginPath();
      ctx.moveTo(cx - lm.width / 2, lm.y - 5);
      ctx.lineTo(cx - lm.width / 2, lm.y + 5);
      ctx.moveTo(cx + lm.width / 2, lm.y - 5);
      ctx.lineTo(cx + lm.width / 2, lm.y + 5);
      ctx.stroke();
    }

    ctx.fillStyle = lm.color;
    const tx = Math.min(W - 185, cx + span / 2 + 8);
    ctx.fillText(`Y=${lm.y} · ${lm.label}`, tx, lm.y + 3);
  }
  ctx.restore();

  if (avecCartouche) {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('GABARIT MAÎTRE 560 × 840 px · PNG RGBA TRANSPARENT', 16, H - 10);
    ctx.restore();
  }
  return cv;
}

/**
 * Génère le fichier SVG vectoriel du gabarit maître (calques séparés pour logiciels 2D).
 */
export function genererGabaritSvg() {
  const { width: W, height: H, centerX: cx } = GABARIT_SPEC;
  const linesSvg = GABARIT_SPEC.landmarks.map((lm) => {
    const span = lm.outerWidth ?? lm.width;
    const x1 = cx - span / 2;
    const x2 = cx + span / 2;
    const dash = lm.dash ? ' stroke-dasharray="4 3"' : '';
    const tx = Math.min(W - 190, x2 + 8);
    return `    <line x1="${x1}" y1="${lm.y}" x2="${x2}" y2="${lm.y}" stroke="${lm.color}" stroke-width="1.25"${dash}/>
    <line x1="${x1}" y1="${lm.y - 4}" x2="${x1}" y2="${lm.y + 4}" stroke="${lm.color}" stroke-width="1.25"/>
    <line x1="${x2}" y1="${lm.y - 4}" x2="${x2}" y2="${lm.y + 4}" stroke="${lm.color}" stroke-width="1.25"/>
    <text x="${tx}" y="${lm.y + 3}" fill="${lm.color}" font-family="sans-serif" font-size="10">Y=${lm.y} · ${lm.label}</text>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <g id="cadre-560x840">
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#2563eb" stroke-opacity="0.35"/>
    <line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke="#2563eb" stroke-opacity="0.5" stroke-dasharray="6 4"/>
    <text x="${cx + 6}" y="16" fill="#1d4ed8" font-family="monospace" font-size="10">AXE X=${cx}</text>
  </g>
  <g id="silhouette-guide" fill="#2563eb" fill-opacity="0.06" stroke="#2563eb" stroke-opacity="0.28" stroke-width="1.5">
    <ellipse cx="${cx}" cy="126" rx="48" ry="60"/>
    <path d="M ${cx - 21} 180 L ${cx - 23} 202 Q ${cx - 58} 210 ${cx - 84} 224 Q ${cx - 102} 260 ${cx - 106} 360 L ${cx - 104} 435 L ${cx - 84} 435 L ${cx - 72} 275 L ${cx - 54} 342 Q ${cx - 78} 385 ${cx - 74} 425 L ${cx - 64} 576 L ${cx - 60} 792 L ${cx - 78} 812 L ${cx - 16} 812 L ${cx - 22} 576 L ${cx - 8} 452 L ${cx + 8} 452 L ${cx + 22} 576 L ${cx + 16} 812 L ${cx + 78} 812 L ${cx + 60} 792 L ${cx + 64} 576 L ${cx + 74} 425 Q ${cx + 78} 385 ${cx + 54} 342 L ${cx + 72} 275 L ${cx + 84} 435 L ${cx + 104} 435 L ${cx + 106} 360 Q ${cx + 102} 260 ${cx + 84} 224 Q ${cx + 58} 210 ${cx + 23} 202 L ${cx + 21} 180 Z"/>
  </g>
  <g id="reperes-anatomiques">
${linesSvg}
  </g>
  <g id="zone-dessin-libre">
    <!-- Dessinez vos calques dans ce groupe (ou importez en calques PNG 560x840) -->
  </g>
</svg>`;
}

export function telechargerGabaritPng() {
  const cv = genererGabaritGuideCanvas(true);
  cv.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gabarit-guide-560x840.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}

export function telechargerGabaritSvg() {
  const svg = genererGabaritSvg();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gabarit-guide-560x840.svg';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * Superpose les repères dynamiques du personnage + l'axe et les axes faciaux sur la scène 2D.
 */
export function dessinerGrilleGabaritSurCanvas(ctx, scale, geo, calibratingSil = false) {
  const a = geo.anchors;
  const hr = geo.headRect;
  ctx.save();

  // Axe central de symétrie
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
  ctx.lineWidth = Math.max(1, scale);
  ctx.setLineDash([4 * scale, 4 * scale]);
  ctx.beginPath();
  ctx.moveTo(a.cx * scale, 12 * scale);
  ctx.lineTo(a.cx * scale, 828 * scale);
  ctx.stroke();

  // Boîte crâne & repères visage actifs
  if (hr) {
    const fh = hr.chinY - hr.topY;
    const fr = hr.featureFracs ?? { brow: 0.375, eye: 0.495, nose: 0.655, mouth: 0.82 };
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
    ctx.strokeRect((hr.cx - hr.faceW / 2) * scale, hr.topY * scale, hr.faceW * scale, fh * scale);
    const faceLines = [
      ['Sourcils', hr.topY + fh * fr.brow, '#6366f1'],
      ['Yeux', hr.topY + fh * fr.eye, '#0ea5e9'],
      ['Nez', hr.topY + fh * fr.nose, '#14b8a6'],
      ['Bouche', hr.topY + fh * fr.mouth, '#f43f5e'],
      ['Menton', hr.chinY, '#ec4899'],
    ];
    ctx.font = `${Math.round(10 * scale)}px "JetBrains Mono", monospace`;
    for (const [lbl, fy, col] of faceLines) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo((hr.cx - hr.faceW * 0.55) * scale, fy * scale);
      ctx.lineTo((hr.cx + hr.faceW * 0.55) * scale, fy * scale);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillText(lbl, (hr.cx + hr.faceW * 0.58) * scale, (fy + 3) * scale);
    }
  }

  // Lignes de repères corporels
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  const lines = [
    ['Cou', a.neckY, Math.max(46, a.torsoW * 0.45), '#0284c7'],
    ['Épaules', a.shoulderY, a.shoulderSpanW ?? a.shoulderW, '#2563eb'],
    ['Taille', a.waistY, a.waistW, '#16a34a'],
    ['Hanches', a.hipY, a.hipW, '#d97706'],
    ['Pieds', a.feetY, a.feetW ?? a.hipW * 0.9, '#dc2626'],
  ];
  ctx.font = `${Math.round(11 * scale)}px "Plus Jakarta Sans", sans-serif`;
  for (const [label, y, w, col] of lines) {
    ctx.strokeStyle = col;
    ctx.setLineDash(calibratingSil ? [] : [5 * scale, 4 * scale]);
    ctx.beginPath();
    ctx.moveTo((a.cx - w / 2) * scale, y * scale);
    ctx.lineTo((a.cx + w / 2) * scale, y * scale);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillText(label, (a.cx + w / 2 + 8) * scale, (y + 4) * scale);
  }
  ctx.restore();
}
