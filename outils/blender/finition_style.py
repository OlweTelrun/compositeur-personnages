#!/usr/bin/env python3
"""Finition d'image des sprites rendus par Blender : réduction depuis un rendu suréchantillonné, saturation, courbe de contraste, netteté.
Valeurs PAR DÉFAUT = compromis choisi À L'ŒIL après une recherche automatique (outils/stats_style.py, médianes de 92 sprites du jeu) : l'optimum statistique
(saturation 0,85, contraste 1,3, gamma 1,2) ternit les peaux claires ; retenu : saturation 1,0, contraste 1,4, gamma 1,1, exposition automatique 0,78 plafonnée à ×1,35
(90e centile ; remplace un gain fixe qui brûlait les peaux claires), netteté 1,0.
Usage : finition_style.py <entrée.png> <sortie.png> [--res 256] [--sat 1.3] [--contraste 1.15] [--nettete 0.6]  (ou : --dossier <in> <out>)"""
import sys, argparse, glob, os
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--res', type=int, default=256); ap.add_argument('--sat', type=float, default=1.0)
ap.add_argument('--contraste', type=float, default=1.4); ap.add_argument('--nettete', type=float, default=1.0)
ap.add_argument('--gamma', type=float, default=1.1, help='> 1 assombrit les tons moyens et fait ressortir les noirs ; < 1 les éclaircit')
ap.add_argument('--expo', type=float, default=1.0, help='gain avant courbe (< 1 baisse les hautes lumières)')
ap.add_argument('--auto-expo', type=float, default=0.78, help='si > 0 : gain par sprite pour que le 90e centile de luminance des pixels opaques vaille cette valeur (peaux claires et foncées au même niveau)')
ap.add_argument('--dossier', action='store_true')
a = ap.parse_args()

def finir(src, dst):
    im = Image.open(src).convert('RGBA')
    if im.width != a.res: im = im.resize((a.res, a.res), Image.LANCZOS)
    arr = np.asarray(im, dtype=np.float32) / 255
    rgb, al = arr[..., :3], arr[..., 3:]
    gain = a.expo
    if a.auto_expo > 0:
        op = al[..., 0] > 0.9
        if op.sum() > 200:
            l0 = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
            gain = float(np.clip(a.auto_expo / max(float(np.percentile(l0[op], 90)), 1e-3), 0.6, 1.35))  # plafond 1,35 : au-delà les peaux foncées virent à l'orange
    rgb = np.clip(rgb * gain, 0, 1) ** a.gamma
    # saturation (autour de la luminance)
    lum = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2])[..., None]
    rgb = np.clip(lum + (rgb - lum) * a.sat, 0, 1)
    # contraste : courbe en S douce autour de 0,5 (le noir descend, le clair monte)
    rgb = np.clip(0.5 + (rgb - 0.5) * a.contraste, 0, 1)
    out = Image.fromarray((np.concatenate([rgb, al], -1) * 255).astype(np.uint8), 'RGBA')
    if a.nettete > 0:  # netteté sur la couleur seulement (pas sur le canal alpha)
        r, g, b, alpha = out.split()
        rgb_i = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1.2, percent=int(100 * a.nettete), threshold=2))
        out = Image.merge('RGBA', (*rgb_i.split(), alpha))
    out.save(dst)

if a.dossier:
    os.makedirs(a.dst, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(a.src, '*.png'))): finir(f, os.path.join(a.dst, os.path.basename(f)))
else:
    finir(a.src, a.dst)
