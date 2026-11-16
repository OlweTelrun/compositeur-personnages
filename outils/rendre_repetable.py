#!/usr/bin/env python3
"""Rend une image répétable (sans couture visible) : fondu croisé entre l'image et sa copie décalée d'un demi-côté (les bords de la copie décalée
sont le MILIEU de l'original, donc continus entre eux). Mesure la couture avant/après (différence moyenne entre bord gauche et bord droit, haut et bas).
Usage : rendre_repetable.py <entrée.png> <sortie.png> [--taille 512]"""
import sys, argparse
import numpy as np
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--taille', type=int, default=512)
a = ap.parse_args()
im = Image.open(a.src).convert('RGB'); n = min(im.size)
im = im.crop(((im.width - n) // 2, (im.height - n) // 2, (im.width + n) // 2, (im.height + n) // 2)).resize((a.taille, a.taille), Image.LANCZOS)
x = np.asarray(im, dtype=np.float32) / 255
def couture(t): return float((np.abs(t[:, 0] - t[:, -1]).mean() + np.abs(t[0] - t[-1]).mean()) / 2)
avant = couture(x)
dec = np.roll(x, (a.taille // 2, a.taille // 2), axis=(0, 1))
w1 = 0.5 - 0.5 * np.cos(2 * np.pi * (np.arange(a.taille) + 0.5) / a.taille)  # 0 aux bords, 1 au centre
w = (w1[:, None] * w1[None, :])[..., None]
w = np.clip(w * 3.2, 0, 1)  # fenêtre resserrée : le fondu n'occupe que la bande proche des bords (moins d'images fantômes au centre)
y = x * w + dec * (1 - w)
apres = couture(y)
Image.fromarray((y * 255).astype(np.uint8)).save(a.dst)
print(f'couture : {avant:.3f} → {apres:.3f}')
