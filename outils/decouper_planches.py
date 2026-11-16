#!/usr/bin/env python3
"""Découpe les PLANCHES du générateur d'images (grilles de pièces sur fond vert) en calques PNG transparents.

  python3 outils/decouper_planches.py            # lit outils/planches.json, écrit prototype/public/atelier2/
Une planche = une image du générateur, 1 pièce par case. Détourage par clé chromatique (vert pur #00FF00), puis rognage serré de
chaque case. Écrit aussi pieces.json : taille de chaque calque, luminance moyenne (pour re-teinter la pièce) et, pour les corps,
le profil de largeur (placement des vêtements).
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

RACINE = Path(__file__).resolve().parent.parent
BIBLIO = Path('/Users/jeremy/Antigravity/bibliotheque/fichiers/image')
SORTIE = RACINE / 'prototype' / 'public' / 'atelier2'


def detourer(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gd = g - np.maximum(r, b)                      # le fond vert pur a gd ≈ 255 ; un iris vert n'a que 40-110
    alpha = np.clip((200 - gd) / 80, 0, 1)
    g = np.where(gd > 0, np.maximum(r, b) + np.minimum(gd, 20) * 0.3, g)   # dé-débordement du vert sur les bords
    alpha = np.clip((alpha - 0.25) / 0.75, 0, 1)                           # resserre le bord : retire la frange mi-verte
    # couleur des pixels de bord = celle du pixel plein le plus proche (aucune contamination par le fond vert)
    coeur = alpha > 0.97
    if coeur.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~coeur, return_indices=True)
        bord = ~coeur
        r, g, b = np.where(bord, r[iy, ix], r), np.where(bord, g[iy, ix], g), np.where(bord, b[iy, ix], b)
    out = np.dstack([r, g, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return out


def composantes(rgba, p):
    """une boîte par silhouette, rangées ligne par ligne : composantes connexes du masque (dilaté pour recoller mains et bras),
    en ignorant les traits fins de la grille (peu de pixels)."""
    masque = rgba[..., 3] > 60
    # lignes de la grille : traînées droites d'au moins 60 px mais de moins de 8 px d'épaisseur (les corps, eux, sont épais)
    lignes = np.zeros_like(masque)
    for fin, epais in (((1, 60), (8, 60)), ((60, 1), (60, 8))):
        mince = ndimage.binary_opening(masque, structure=np.ones(fin, bool))
        gros = ndimage.binary_opening(masque, structure=np.ones(epais, bool))
        lignes |= mince & ~ndimage.binary_dilation(gros, iterations=2)
    lignes = ndimage.binary_dilation(lignes, iterations=2)
    masque = masque & ~lignes; rgba[..., 3][lignes] = 0
    # composantes brutes rattachées à leur case par leur centre de gravité (une silhouette = plusieurs morceaux : bras, mains…)
    lab, n = ndimage.label(masque)
    H, W = masque.shape; boites = {}
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        brut = lab[sl] == i
        if brut.sum() < 1500: continue                                  # débris
        ys, xs = np.where(brut); cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
        case = (min(p['rows'] - 1, int(cy / H * p['rows'])), min(p['cols'] - 1, int(cx / W * p['cols'])))
        x0, y0, x1, y1 = sl[1].start, sl[0].start, sl[1].stop, sl[0].stop
        o = boites.get(case, (x0, y0, x1, y1)); boites[case] = (min(o[0], x0), min(o[1], y0), max(o[2], x1), max(o[3], y1))
    if len(boites) != len(p['pieces']): sys.exit(f'composantes : {len(boites)} cases remplies, {len(p["pieces"])} attendues')
    liste = [boites[(r, c)] for r in range(p['rows']) for c in range(p['cols'])]
    return [(a, b, c, d) for a, b, c, d in liste]


def trouver(prefixe):
    c = sorted(BIBLIO.rglob(f'{prefixe}-*.png'))
    if not c: sys.exit(f'planche introuvable : {prefixe}')
    return c[0]


def profil_largeur(alpha, n=50):
    """largeur et centre de la silhouette à n hauteurs (fractions de la hauteur)."""
    h = alpha.shape[0]; larg, cx = [], []
    for i in range(n):
        y = min(h - 1, int((i + 0.5) / n * h))
        xs = np.where(alpha[y] > 90)[0]
        larg.append(int(xs.max() - xs.min() + 1) if len(xs) else 0)
        cx.append(int((xs.max() + xs.min()) / 2) if len(xs) else 0)
    return larg, cx


def main():
    cfg = json.loads((RACINE / 'outils' / 'planches.json').read_text())
    meta = {}
    for cat, p in cfg.items():
        img = Image.open(trouver(p['element'])); rgba = detourer(img)
        H, W = rgba.shape[:2]; cw, ch = W / p['cols'], H / p['rows']
        meta[cat] = {}
        boites = composantes(rgba, p) if p.get('composantes') else None
        for k, (pid, nom) in enumerate(p['pieces']):
            c, r = k % p['cols'], k // p['cols']
            x0, y0, x1, y1 = int(c * cw) + 8, int(r * ch) + 8, int((c + 1) * cw) - 8, int((r + 1) * ch) - 8
            if boites: x0, y0, x1, y1 = boites[k]                       # silhouettes qui débordent de leur case : on suit les formes
            cell = rgba[y0:y1, x0:x1].copy()
            # retire les traits fins (lignes de grille de la planche) : composantes très allongées et de 5 px d'épaisseur au plus
            lab, n = ndimage.label(cell[..., 3] > 30)
            for i, sl in enumerate(ndimage.find_objects(lab), 1):
                hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
                if min(hh, ww) <= 6 and max(hh, ww) > 60: cell[..., 3][lab == i] = 0
            ys, xs = np.where(cell[..., 3] > 60)
            if not len(xs): print('  case vide', cat, pid); continue
            bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            crop = cell[by0:by1, bx0:bx1]
            d = SORTIE / cat; d.mkdir(parents=True, exist_ok=True)
            Image.fromarray(crop).save(d / f'{pid}.png', optimize=True)
            opaque = crop[..., 3] > 200
            lum = float((0.299 * crop[..., 0] + 0.587 * crop[..., 1] + 0.114 * crop[..., 2])[opaque].mean())
            m = {'nom': nom, 'w': int(crop.shape[1]), 'h': int(crop.shape[0]), 'lum': round(lum, 1)}
            if 'genre' in p and pid in p['genre']: m['genre'] = p['genre'][pid]
            if cat in ('corps', 'tete'):
                rgb = crop[..., :3].astype(np.float32); mx, mn = rgb.max(-1), rgb.min(-1)
                peau = opaque & ((mx - mn) / np.maximum(mx, 1) >= 0.15)       # pixels de peau (les vêtements gris sont presque sans saturation)
                m['lum_peau'] = round(float((0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2])[peau].mean()), 1)
            if cat == 'corps': m['larg'], m['cx'] = profil_largeur(crop[..., 3])
            if cat == 'tete':
                larg, cx = profil_largeur(crop[..., 3], 100)
                wmax = max(larg); r_max = larg.index(wmax)
                cou_l = sorted(larg[-8:])[4]                                    # largeur du cou : médiane des dernières lignes
                cou = max(i for i, w in enumerate(larg) if w > 1.35 * cou_l)   # dernière ligne plus large que le cou = le menton
                m.update({'wmax': wmax, 'hface': int((cou + 1) / 100 * m['h']), 'cx_tete': cx[r_max]})
            meta[cat][pid] = m
        print(f'{cat}: {len(meta[cat])} pièces')
    (SORTIE / 'pieces.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
