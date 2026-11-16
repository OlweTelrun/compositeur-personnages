#!/usr/bin/env python3
"""Recolore la texture d'un corps de base Meshy par CLASSES (peau / sous-vêtement gris / cheveux et traits sombres), en gardant l'ombrage.
Usage : recolorer_texture.py <texture.png> <sortie.png> --peau #hex --haut #hex --cheveux #hex   (les options omises laissent la classe inchangée)
Classes (HSV, valeurs mesurées sur le corps « ronde » de la bibliothèque) : sombre V<0,30 ; gris S<0,22 ; blanc (yeux) S<0,15 et V>0,85 ; sinon peau."""
import sys, argparse, colorsys
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--peau'); ap.add_argument('--haut'); ap.add_argument('--cheveux'); ap.add_argument('--masque-cheveux', help='PNG de masque_cheveux.py : cheveux définis par la géométrie')
a = ap.parse_args()
hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255
im = np.asarray(Image.open(a.src).convert('RGB'), dtype=np.float32) / 255
mx, mn = im.max(axis=2), im.min(axis=2)
v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
blanc = (s < 0.15) & (v > 0.85)
sombre = (v < 0.30) & ~blanc
gris = (s < 0.22) & ~sombre & ~blanc
if a.masque_cheveux:  # cheveux = masque géométrique, sauf les texels de peau (teinte chaude saturée) ; ils sortent des classes gris/blanc
    import json
    from PIL import ImageDraw
    H, W = im.shape[0], im.shape[1]
    mk = Image.new('L', (W, H), 0); dd = ImageDraw.Draw(mk)
    for poly in json.load(open(a.masque_cheveux))['polygones']:
        dd.polygon([(u * W, (1 - v) * H) for u, v in poly], fill=255)
    m = np.asarray(mk) > 127
    chaud = (s > 0.25) & (v > 0.45) & (im[..., 0] > im[..., 2])
    cheveux_m = m & ~chaud
    sombre = sombre | cheveux_m
    gris = gris & ~cheveux_m
    blanc = blanc & ~cheveux_m
peau = ~(sombre | gris | blanc)
out = im.copy()
if a.peau and peau.any():
    ref = np.median(im[peau], axis=0)
    out[peau] = np.clip(im[peau] * (hexrgb(a.peau) / np.maximum(ref, 1e-3)), 0, 1)
if a.haut and gris.any():
    ref = np.median(lum[gris])
    out[gris] = np.clip(hexrgb(a.haut)[None, :] * (lum[gris] / max(ref, 1e-3))[:, None], 0, 1)
if a.cheveux and sombre.any():
    t = hexrgb(a.cheveux)
    ref = max(float(np.median(lum[sombre])), 0.03)  # ombrage conservé, relatif à la luminosité médiane des cheveux d'origine (noirs, blancs ou gris)
    if a.masque_cheveux:  # ombrage aplati : le volume vient de la géométrie ; les boucles blanches/noires de la texture ne doivent pas ressortir en « résille »
        k = 0.8 + 0.2 * np.clip(lum[sombre] / ref, 0, 2)
    else:
        k = np.clip(lum[sombre] / ref, 0.4, 1.3) * 0.9
    out[sombre] = np.clip(t[None, :] * k[:, None], 0, 1)
Image.fromarray((out * 255).astype(np.uint8)).save(a.dst)
print(f'classes (%) : peau {peau.mean()*100:.0f}, gris {gris.mean()*100:.0f}, sombre {sombre.mean()*100:.0f}, blanc {blanc.mean()*100:.1f}')
