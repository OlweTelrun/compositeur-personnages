#!/usr/bin/env python3
"""Assemble des personnages à partir des calques du gabarit (prototype/public/atelier3/) : référence du rendu + préparation de l'atelier.

  python3 outils/gabarit_composer.py demo <image_sortie.png> [graine]   # planche de 8 personnages au hasard
  python3 outils/gabarit_composer.py preparer                            # écrit corps-nu.png, tete.png et placement.json (lus par l'atelier web)

Ordre : corps lissé → chaussures → bas → haut → tête du buste (avec cou) → nez, bouche, yeux, sourcils → cheveux.
Vêtements et cheveux = calques gris / bruns re-teintés (couleur cible × luminance du pixel / luminance moyenne) ; peau = luminance relative à la peau du gabarit.
"""
import sys, json, glob, random
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, str(Path(__file__).parent))
import gabarit_extraire as g

RACINE = Path(__file__).resolve().parent.parent
D = RACINE / 'prototype' / 'public' / 'atelier3'
BIB = '/Users/jeremy/Antigravity/bibliotheque/fichiers/image/2026-11/'
CFG = json.loads((RACINE / 'outils' / 'gabarits.json').read_text())
VETEMENTS = ['#ff6f61', '#ffd23f', '#1fb5c4', '#1f3a6b', '#f4f4f2', '#26262b', '#3aa05b', '#ff8fb3', '#ff9442', '#7a56c9', '#d9383a', '#c9b79c']
CHEVEUX = ['#1e1a1a', '#4a3020', '#7a5233', '#d9b36c', '#b5502a', '#9a9a9e', '#e75a9a', '#3b7fd9']
RATIO_TETE = 0.162   # hauteur sommet→menton de la tête, en fraction de la hauteur de la figure (valeur de la silhouette « moyenne »)
PEAUX = ['#fbe0cc', '#f5cba7', '#e8b48a', '#d39a6b', '#b9794a', '#8d5a3b', '#6b4128', '#4a2c1b']


def _lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def teinter(im, hexa):
    """calque gris/brun → couleur cible ; les pixels saturés (peau, reflets chauds) ne sont pas touchés."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    lum = _lum(a); ref = float(lum[a[..., 3] > 200].mean()) if (a[..., 3] > 200).any() else 128.0
    t = np.array([int(hexa[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
    f = (lum / ref) ** 0.9
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1); sat = (mx - mn) / np.maximum(mx, 1)
    w = np.clip(1 - (sat - 0.07) / 0.12, 0, 1)[..., None]
    a[..., :3] = np.clip(w * (t[None, None, :] * f[..., None]) + (1 - w) * a[..., :3], 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def teinter_peau(im, hexa, lum_ref):
    """peau : couleur cible × (luminance du pixel / luminance de la peau du gabarit) — on garde les ombres du rendu."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    t = np.array([int(hexa[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
    f = (_lum(a) / lum_ref) ** 0.9
    a[..., :3] = np.clip(t[None, None, :] * f[..., None], 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def teinter_paupieres(im, hexa, lum_ref):
    """yeux : seuls les pixels de PEAU (paupières, halo) sont re-teintés ; globe, iris et cils gardent leurs couleurs."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32); rgb = a[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1); sat = (mx - mn) / np.maximum(mx, 1); lum = _lum(a)
    peau = (sat > 0.16) & (sat < 0.65) & (rgb[..., 0] > rgb[..., 1] * 1.08) & (rgb[..., 1] > rgb[..., 2]) & (lum > 0.62 * lum_ref)
    t = np.array([int(hexa[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
    f = (lum / lum_ref) ** 0.9
    w = ndimage.gaussian_filter(peau.astype(np.float32), 0.8)[..., None]
    a[..., :3] = np.clip(w * (t[None, None, :] * f[..., None]) + (1 - w) * rgb, 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def metriques_tete(a, frac):
    """sommet, menton, centre et largeur de la tête (composante de peau du haut de la figure)."""
    ys, _ = np.where(a[..., 3] > 200); ya, yb = ys.min(), ys.max()
    t = (a[..., 3] > 200); t[ya + int(0.1 * (yb - ya)):] = False
    peau = np.median(a[ndimage.binary_erosion(t, iterations=6)][:, :3].astype(np.float32), 0)
    x0, y0, x1, y1 = g.boite_tete(a, peau, frac)
    sk = (a[..., 3] > 200) & (np.abs(a[..., :3].astype(np.float32) - peau).max(-1) < 40)
    larg = [int(np.ptp(np.where(sk[y])[0])) + 1 if sk[y, x0:x1].any() else 0 for y in range(y0, y1)]
    cou = float(np.median(larg[-10:])); menton = None
    for k in (1.35, 1.2, 1.1):                                                  # cou épais (hommes) : seuil plus bas
        c = [i for i, w in enumerate(larg) if w > k * cou]
        if c: menton = y0 + max(c); break
    if menton is None: menton = y0 + int(0.85 * (y1 - y0))
    return {'haut': int(y0), 'menton': int(menton), 'cx': float((x0 + x1) / 2), 'larg': int(x1 - x0), 'cou': cou, 'peau': peau}


def corps_nu(natif):
    """corps lissé : le magenta du gabarit est remplacé par de la peau (couleur du voisinage, grandes ombres du vêtement conservées)."""
    a = np.asarray(natif.convert('RGBA')).astype(np.float32)
    mag0 = (a[..., 3] > 128) & ((a[..., 0] - a[..., 1]) > 40) & ((a[..., 2] - a[..., 1]) > 40)
    mag = ndimage.binary_dilation(mag0, iterations=6)
    ref = np.median(a[(a[..., 3] > 200) & ~mag & (np.arange(a.shape[0])[:, None] > 0.62 * a.shape[0])][:, :3], 0)
    valide = (a[..., 3] > 200) & ~ndimage.binary_dilation(mag, iterations=4) & (np.abs(a[..., :3] - ref).max(-1) < 60)
    num = np.dstack([ndimage.gaussian_filter(a[..., i] * valide, 22) for i in range(3)]); den = ndimage.gaussian_filter(valide.astype(np.float32), 22)[..., None]
    peau = np.where(den > 1e-4, num / np.maximum(den, 1e-4), ref[None, None, :])
    lum = _lum(a)
    mod = np.clip((lum / lum[mag0].mean()) ** 0.45, 0.8, 1.15)               # grandes ombres du vêtement = forme du corps
    remplissage = np.clip(peau * mod[..., None], 0, 255)
    w = ndimage.gaussian_filter(mag.astype(np.float32), 2.0)[..., None]
    a[..., :3] = a[..., :3] * (1 - w) + remplissage * w
    # le gabarit ne garde de la zone remplie que l'intérieur : sinon elle déborde du corps réel des cases (largeurs légèrement différentes)
    H_ = a.shape[0]; ys_, xs_ = np.where(a[..., 3] > 128); cx_ = int(xs_.mean())
    fourche = next((r for r in range(int(.45 * H_), H_) if a[r, cx_, 3] < 128), int(.6 * H_))       # entrejambe : on n'érode pas en dessous
    bord = mag0 & ~ndimage.binary_erosion(a[..., 3] > 128, iterations=10); bord[fourche - 8:] = False
    a[..., 3] = np.where(bord, 0, a[..., 3])
    return Image.fromarray(a.astype(np.uint8))


def buste():
    eid = '20261116-101854-20jeu9'
    return Image.fromarray(g.detourer(Image.open(glob.glob(BIB + eid + '-*.png')[0])))


def preparer():
    """pour chaque silhouette : corps-nu.png + placement de la tête ; une fois : tete.png (tête du buste avec cou)."""
    b = buste(); mt = metriques_tete(np.asarray(b), 0.7)
    coupe = int(mt['menton'] + 0.10 * (mt['menton'] - mt['haut']))
    tete = np.asarray(b.crop((0, 0, b.width, coupe))).copy()
    xs = np.arange(tete.shape[1])[None, :]; ys_ = np.arange(tete.shape[0])[:, None]
    hors_cou = (ys_ > mt['menton'] - 0.02 * (mt['menton'] - mt['haut'])) & (np.abs(xs - mt['cx']) > 0.62 * mt['cou'])   # sous le menton : le cou seulement
    tete[..., 3] = np.where(hors_cou, 0, tete[..., 3])
    Image.fromarray(tete).save(D / 'tete.png', optimize=True)
    lum_ref = float(_lum(np.asarray(b).astype(np.float32))[np.asarray(b)[..., 3] > 200][:1].mean()) if False else None
    out = {'buste': {'haut': mt['haut'], 'menton': mt['menton'], 'cx': mt['cx'], 'coupe': coupe}, 'silhouettes': {}}
    for sil in CFG['silhouettes']:
        natif = Image.open(D / 'corps' / sil / 'gabarit-natif.png').convert('RGBA')
        nu = corps_nu(natif); arr = np.asarray(nu)
        ys_, xs_ = np.where(arr[..., 3] > 200); haut_f, bas_f = ys_.min(), ys_.max(); hf = bas_f - haut_f
        mb = metriques_tete(arr, 0.2)
        tete_h = RATIO_TETE * hf                                           # même proportion de tête pour toutes les silhouettes
        sc = tete_h / (mt['menton'] - mt['haut'])
        ox, oy = mb['cx'] - mt['cx'] * sc, haut_f - mt['haut'] * sc
        mb['menton'] = int(oy + mt['menton'] * sc); mb['haut'] = int(haut_f)
        a = np.asarray(nu).copy(); a[:int(mb['menton'] - 0.02 * (mb['menton'] - mb['haut'])), :, 3] = 0       # retire la tête du corps (garde le cou)
        res = Image.fromarray(a); res.save(D / 'corps' / sil / 'corps-nu.png', optimize=True)
        lum_peau = float(np.median(_lum(a.astype(np.float32))[(a[..., 3] > 200)]))
        out['silhouettes'][sil] = {'taille': list(res.size), 'echelle_tete': sc, 'ox': ox, 'oy': oy, 'lum_peau': lum_peau}
        print(sil, res.size, 'échelle tête', round(sc, 3))
    (D / 'placement.json').write_text(json.dumps(out, indent=1))


class Atelier:
    def __init__(self):
        self.pl = json.loads((D / 'placement.json').read_text())
        self.tete = Image.open(D / 'tete.png').convert('RGBA')
        self.rapv = {c: json.load(open(D / c / 'rapport.json')) for c in ['yeux', 'nez', 'bouche', 'sourcils', 'cheveux']}
        self.lum_tete = float(np.median(_lum(np.asarray(self.tete).astype(np.float32))[np.asarray(self.tete)[..., 3] > 200]))

    def personne(self, sil, p, taille=(560, 770)):
        pl = self.pl['silhouettes'][sil]; sc = pl['echelle_tete']
        corps = Image.open(D / 'corps' / sil / 'corps-nu.png').convert('RGBA')
        out = Image.new('RGBA', taille, (0, 0, 0, 0)); dx = (taille[0] - corps.width) // 2; dy = taille[1] - corps.height
        c = teinter_peau(corps, p['peau'], pl['lum_peau']); out.alpha_composite(c, (dx, dy))
        cats = (('chaussures', p['chaussures']), ('bas', p['bas']), ('hauts', p['hauts']))
        for cat, (k, col) in cats:
            r = json.load(open(D / 'corps' / sil / cat / 'rapport.json'))[k]
            im = Image.open(D / 'corps' / sil / cat / f"{r['case']}.png").convert('RGBA')
            out.alpha_composite(teinter(im, col), (dx + r['bbox'][0], dy + r['bbox'][1]))
        t = self.tete.resize((int(self.tete.width * sc), int(self.tete.height * sc)), Image.LANCZOS)
        out.alpha_composite(teinter_peau(t, p['peau'], self.lum_tete), (int(round(dx + pl['ox'])), int(round(dy + pl['oy']))))
        for cat in ('nez', 'bouche', 'yeux', 'sourcils', 'cheveux'):
            r = self.rapv[cat][p[cat]]; im = Image.open(D / cat / f"{r['case']}.png").convert('RGBA')
            if cat == 'cheveux': im = teinter(im, p['couleur_cheveux'])
            elif cat == 'nez': im = teinter_peau(im, p['peau'], self.lum_tete)
            elif cat == 'yeux': im = teinter_paupieres(im, p['peau'], self.lum_tete)
            im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)
            out.alpha_composite(im, (int(round(dx + pl['ox'] + r['bbox'][0] * sc)), int(round(dy + pl['oy'] + r['bbox'][1] * sc))))
        return out


def tirer(rnd, sil):
    p = {c: (rnd.randrange(8), rnd.choice(VETEMENTS)) for c in ('hauts', 'bas', 'chaussures')}
    p.update({c: rnd.randrange(9) for c in ('yeux', 'nez', 'bouche', 'sourcils', 'cheveux')})
    p.update({'couleur_cheveux': rnd.choice(CHEVEUX), 'peau': rnd.choice(PEAUX)})
    return p


if __name__ == '__main__':
    if sys.argv[1] == 'preparer': preparer()
    else:
        A = Atelier(); rnd = random.Random(int(sys.argv[3]) if len(sys.argv) > 3 else 3)
        sils = list(CFG['silhouettes']); W, H = 560, 770; out = Image.new('RGB', (W * 4, H * 2), (222, 215, 205))
        for i in range(8):
            sil = sils[i % len(sils)]; bg = Image.new('RGBA', (W, H), (222, 215, 205, 255)); bg.alpha_composite(A.personne(sil, tirer(rnd, sil)))
            out.paste(bg.convert('RGB'), ((i % 4) * W, (i // 4) * H))
        out.save(sys.argv[2]); print(out.size)
