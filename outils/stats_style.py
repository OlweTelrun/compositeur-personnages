#!/usr/bin/env python3
"""Statistiques de « look » d'un dossier de sprites RGBA (couleur, contraste, reflets, bords) pour comparer notre rendu aux sprites du jeu.
Chaque sprite est recadré sur son contenu puis ramené à 225 px de haut ; mesures sur les pixels opaques.
Usage : stats_style.py <glob ou dossier> [<glob> …]   (affiche médiane / min / max par métrique)"""
import sys, glob, colorsys
import numpy as np
from PIL import Image

def stats(path):
    im = Image.open(path).convert('RGBA')
    bb = im.getchannel('A').getbbox()
    if not bb: return None
    c = im.crop(bb); k = 225 / c.height
    c = c.resize((max(1, round(c.width * k)), 225), Image.LANCZOS)
    a = np.asarray(c, dtype=np.float32) / 255
    m = a[..., 3] > 0.9
    if m.sum() < 500: return None
    rgb = a[..., :3][m]
    mx, mn = rgb.max(1), rgb.min(1)
    v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lum = 0.2126 * rgb[:, 0] + 0.7152 * rgb[:, 1] + 0.0722 * rgb[:, 2]
    # bords : contraste local (gradient de luminance) sur l'intérieur du sprite
    L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    gy, gx = np.gradient(L); g = np.hypot(gx, gy)
    inner = m & (np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(__import__('PIL.ImageFilter', fromlist=['x']).MinFilter(7))) > 0)
    return {
        'saturation_moy': float(s.mean()), 'saturation_p90': float(np.percentile(s, 90)),
        'luminance_moy': float(lum.mean()), 'contraste_(ecart-type)': float(lum.std()),
        'reflets_(V>0.93)': float((v > 0.93).mean()), 'ombres_(V<0.2)': float((v < 0.2).mean()),
        'detail_(gradient_moy)': float(g[inner].mean()) if inner.any() else 0.0,
    }

for spec in sys.argv[1:]:
    fs = [f for f in sorted(glob.glob(spec if any(ch in spec for ch in '*?[') else spec.rstrip('/') + '/**/*.png', recursive=True)) if not f.endswith('lot-style.json')]
    rows = [r for r in (stats(f) for f in fs) if r]
    print(f'\n== {spec}  ({len(rows)} sprites)')
    for k in rows[0]:
        v = np.array([r[k] for r in rows])
        print(f'  {k:26s} médiane {np.median(v):.3f}   [{v.min():.3f} – {v.max():.3f}]')
