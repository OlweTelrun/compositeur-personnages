#!/usr/bin/env python3
"""Méthode « gabarit » : extrait des CALQUES alignés d'une grille de retouches d'un même gabarit.

  python3 outils/gabarit_extraire.py <gabarit.png> <grille.png> <colonnes> <lignes> <categorie> <dossier_sortie> [visage|libre]

1. détourage du fond vert ; 2. recalage de chaque case sur la TÊTE du gabarit (échelle + translation : IoU des silhouettes puis
corrélation de phase) ; 3. la différence de couleur avec le gabarit est le calque (alpha lissé) ; 4. mesures : IoU de silhouette,
dérive de couleur du générateur HORS de la zone retouchée (0-255), surface retouchée.
Les calques sont écrits rognés, avec leur boîte dans le repère du gabarit (rapport.json) : on les repose tels quels à ces coordonnées.
mode « visage » : la retouche est à l'intérieur de la tête (yeux, nez, bouche, sourcils) ; « libre » : elle peut déborder (cheveux, chapeau).
"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.registration import phase_cross_correlation
sys.path.insert(0, str(Path(__file__).parent))
from decouper_planches import detourer

TAILLE = 0.46         # hauteur de la taille (haut gris / short gris) en fraction de la hauteur de la figure du gabarit corps
HAUTEUR_NATIVE = 720   # hauteur de figure (px) du repère de travail des corps : identique pour toutes les grilles et toutes les silhouettes
TETE_Y = 610          # ligne du gabarit sous laquelle on ne s'occupe plus de la tête (menton à ~590) — gabarit 1024×1024
LIBRE_Y = 800         # limite basse pour les coiffures (au-delà : épaules, que le générateur recadre)


def aligner(G, cell, tm, zy1, peau=None):
    Hg, Wg = G.shape[:2]
    cm = (cell[..., 3] > 128).astype(np.float32)
    if peau is not None:                                              # coiffure : la silhouette change, on recale sur la PEAU visible
        cm = (np.abs(cell[..., :3].astype(np.float32) - peau).max(-1) < 28).astype(np.float32) * cm
    best = None
    for s in np.arange(0.28, 0.56, 0.004):
        tw, th = int(Wg * s), int(Hg * s)
        t = np.asarray(Image.fromarray((tm * 255).astype(np.uint8)).resize((tw, th), Image.BILINEAR)).astype(np.float32) / 255
        pad = np.zeros_like(cm); hh, ww = min(th, cm.shape[0]), min(tw, cm.shape[1]); pad[:hh, :ww] = t[:hh, :ww]
        lim = int(zy1 * s); a, b = cm.copy(), pad.copy(); a[lim:] = 0; b[lim:] = 0
        (dy, dx), _, _ = phase_cross_correlation(a, b, upsample_factor=4)
        iou = float((ndimage.shift(b, (dy, dx), order=1) * a).sum() / np.maximum(ndimage.shift(b, (dy, dx), order=1), a).sum())
        if best is None or iou > best[0]: best = (iou, s, dy, dx)
    iou, s, dy, dx = best; inv = 1 / s
    up = np.asarray(Image.fromarray(cell).resize((int(cell.shape[1] * inv), int(cell.shape[0] * inv)), Image.BICUBIC)).astype(np.float32)
    full = np.zeros((Hg, Wg, 4), np.float32)
    oy, ox = int(round(-dy * inv)), int(round(-dx * inv))
    ys, xs = max(0, oy), max(0, ox); ye, xe = min(Hg, oy + up.shape[0]), min(Wg, ox + up.shape[1])
    full[ys:ye, xs:xe] = up[ys - oy:ye - oy, xs - ox:xe - ox]
    return full, iou, s


def taille_gabarit(G):
    """ligne de la taille (jointure haut / short magenta) : creux de luminance le plus net sur la colonne centrale du magenta."""
    Gf = G.astype(np.float32)
    mag = (G[..., 3] > 200) & ((Gf[..., 0] - Gf[..., 1]) > 60) & ((Gf[..., 2] - Gf[..., 1]) > 60)
    ys, xs = np.where(G[..., 3] > 200); ya, yb = ys.min(), ys.max(); H = yb - ya; cx = int(xs.mean()); l = int(.07 * H)
    lum = 0.299 * Gf[..., 0] + 0.587 * Gf[..., 1] + 0.114 * Gf[..., 2]
    prof = np.array([lum[y, cx - l:cx + l][mag[y, cx - l:cx + l]].mean() if mag[y, cx - l:cx + l].sum() > 20 else np.nan for y in range(G.shape[0])])
    pf = ndimage.gaussian_filter1d(np.nan_to_num(prof, nan=np.nanmean(prof)), 3)
    rows = np.arange(ya + int(.36 * H), ya + int(.58 * H))
    return int(rows[np.argmin(pf[rows])])


def boite_tete(rgba, peau, frac=0.13):
    """boîte de la tête : composante de peau qui contient le sommet de la figure (la tête ne change pas d'une retouche à l'autre)."""
    m = (rgba[..., 3] > 128)
    ys, xs = np.where(m); top, bot = ys.min(), ys.max()
    sk = m & (np.abs(rgba[..., :3].astype(np.float32) - peau).max(-1) < 40)
    sk[int(top + frac * (bot - top)):] = False
    lab, n = ndimage.label(ndimage.binary_closing(sk, iterations=3))
    if n == 0: return None
    tailles = ndimage.sum(sk, lab, range(1, n + 1)); k = int(np.argmax(tailles)) + 1
    yy, xx = np.where(lab == k)
    return xx.min(), yy.min(), xx.max() + 1, yy.max() + 1


def aligner_tete(G, cell, peau):
    """recale une case sur le gabarit d'après la tête : échelle = rapport des tailles de tête, translation = coin haut-centre."""
    bt, bc = boite_tete(G, peau), boite_tete(cell, peau)
    hauteur = lambda r: (lambda y: y.max() - y.min() + 1)(np.where((r[..., 3] > 128).any(1))[0])
    s = hauteur(cell) / hauteur(G)                                                   # case = s × gabarit (hauteur totale tête → pieds : précis jusqu'aux chevilles)
    print('   tete gabarit', bt, 'case', bc, 'echelle', round(s, 3)) if '--debug' in sys.argv else None
    inv = 1 / s; Hg, Wg = G.shape[:2]
    up = np.asarray(Image.fromarray(cell).resize((int(cell.shape[1] * inv), int(cell.shape[0] * inv)), Image.BICUBIC)).astype(np.float32)
    # centre horizontal et sommet de la tête mis en coïncidence
    cxt, cxc = (bt[0] + bt[2]) / 2, (bc[0] + bc[2]) / 2 * inv; ytt, ytc = bt[1], bc[1] * inv
    ox, oy = int(round(cxt - cxc)), int(round(ytt - ytc))
    full = np.zeros((Hg, Wg, 4), np.float32)
    ys, xs = max(0, oy), max(0, ox); ye, xe = min(Hg, oy + up.shape[0]), min(Wg, ox + up.shape[1])
    full[ys:ye, xs:xe] = up[ys - oy:ye - oy, xs - ox:xe - ox]
    return full, 1.0, s


def raffiner(G, full, peau):
    """affine le recalage d'une case déjà posée dans le repère du gabarit : échelle (±2 %) puis translation, en minimisant l'écart
    sur la PEAU du gabarit (tête, bras, jambes : parties que la retouche ne change pas)."""
    Hg, Wg = G.shape[:2]
    sk = (G[..., 3] > 200) & (np.abs(G[..., :3].astype(np.float32) - peau).max(-1) < 45)
    sk = ndimage.binary_erosion(sk, iterations=4)
    if sk.sum() < 500: return full
    ys, xs = np.where(G[..., 3] > 200); ax, ay = (xs.min() + xs.max()) / 2, ys.min()           # ancre : haut-centre de la figure
    gris = lambda a: (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])
    Gg = gris(G.astype(np.float32)); meilleur = None
    for c in np.linspace(0.98, 1.02, 9):
        M = np.array([[1 / c, 0, ax - ax / c], [0, 1 / c, ay - ay / c]])
        f = np.dstack([ndimage.affine_transform(full[..., i], M[:, :2], offset=(M[1, 2], M[0, 2]), order=1, output_shape=(Hg, Wg)) for i in range(4)]) if False else None
        z = ndimage.zoom(full, (c, c, 1), order=1) if abs(c - 1) > 1e-6 else full
        oy, ox = int(round(ay - ay * c)), int(round(ax - ax * c))
        cadre = np.zeros_like(full); h, w = z.shape[:2]
        y0, x0 = max(0, oy), max(0, ox); y1, x1 = min(Hg, oy + h), min(Wg, ox + w)
        cadre[y0:y1, x0:x1] = z[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        e = float(np.abs(gris(cadre) - Gg)[sk].mean())
        if meilleur is None or e < meilleur[0]: meilleur = (e, cadre)
    cadre = meilleur[1]
    (dy, dx), _, _ = phase_cross_correlation(np.where(sk, Gg, 0), np.where(sk, gris(cadre), 0), upsample_factor=10)
    return np.dstack([ndimage.shift(cadre[..., i], (dy, dx), order=1) for i in range(4)])


def main(gab, grille, cols, rows, cat, sortie, mode='visage', f=1.0, zone_grise=None):
    global TETE_Y, LIBRE_Y
    G = detourer(Image.open(gab)); S = detourer(Image.open(grille)); H, W = S.shape[:2]; cw, ch = W / cols, H / rows
    if mode == 'corps':                                                 # gabarit ramené à l'échelle des cases : calques nets, sans agrandissement
        c0 = S[:int(ch), :int(cw)]; hv = lambda r: (lambda y: y.max() - y.min() + 1)(np.where((r[..., 3] > 128).any(1))[0])
        nat = HAUTEUR_NATIVE / hv(G)                                   # repère commun aux grilles hauts / bas / chaussures de cette silhouette
        G = np.asarray(Image.fromarray(G).resize((int(G.shape[1] * nat), int(G.shape[0] * nat)), Image.LANCZOS))
        Path(sortie).parent.mkdir(parents=True, exist_ok=True); Image.fromarray(G).save(Path(sortie).parent / 'gabarit-natif.png')
    Hg, Wg = G.shape[:2]
    tm = (G[..., 3] > 128).astype(np.float32)
    if mode == 'corps': TETE_Y = LIBRE_Y = G.shape[0]
    zy1 = TETE_Y if mode == 'visage' else LIBRE_Y
    sortie = Path(sortie); sortie.mkdir(parents=True, exist_ok=True)
    tete = (G[..., 3] > 200); tete[zy1:] = False
    interieur = ndimage.binary_erosion(tete, iterations=24)           # sans le contour ni les oreilles (le générateur les redessine un peu)
    peau = None; tm_al = tm
    if mode != 'visage':
        ys_, _ = np.where(G[..., 3] > 200); haut_ = ys_.min() + int(0.15 * (ys_.max() - ys_.min()))   # couleur de peau lue sur le haut de la figure (la tête)
        tete_ = (G[..., 3] > 200); tete_[haut_:] = False
        peau = np.median(G[ndimage.binary_erosion(tete_, iterations=10)][:, :3].astype(np.float32), 0)
        tm_al = ((np.abs(G[..., :3].astype(np.float32) - peau).max(-1) < 28) & (G[..., 3] > 128)).astype(np.float32)
    al = []
    for k in range(cols * rows):
        c, r = k % cols, k // cols
        cell = S[int(r * ch):int((r + 1) * ch), int(c * cw):int((c + 1) * cw)]
        if mode == 'corps':
            full, a_, s_ = aligner_tete(G, cell, peau); al.append((raffiner(G, full, peau), a_, s_))
        else: al.append(aligner(G, cell, tm_al, TETE_Y, peau))
    rapport = []
    for k, (full, iou, s) in enumerate(al):
        d = np.abs(full[..., :3] - G[..., :3].astype(np.float32)).max(-1)
        if mode == 'visage':
            zone = ndimage.binary_dilation((d > 70 * f) & interieur, iterations=16) & interieur
            alpha = np.clip((d - 30 * f) / (55 * f), 0, 1) * zone
            hors = interieur & ~zone
        elif mode == 'corps':
            # le vêtement REMPLACE celui du gabarit : calque opaque sur toute la zone (ancien vêtement gris + nouveau), contours lissés
            Gf = G.astype(np.float32)
            grise = (G[..., 3] > 200) & ((Gf[..., 0] - Gf[..., 1]) > 70) & ((Gf[..., 2] - Gf[..., 1]) > 70)   # vêtements de base du gabarit : magenta franc
            grise = ndimage.binary_opening(grise, iterations=2)
            ys_, _ = np.where(G[..., 3] > 200); ya_, yb_ = ys_.min(), ys_.max(); Hf_ = yb_ - ya_
            ysplit = taille_gabarit(G)                                                  # la taille : jointure haut / short du gabarit
            if zone_grise == 'haut': grise[ysplit:] = False
            elif zone_grise == 'bas': grise[:ysplit] = False
            else: grise[:] = False
            chg = ndimage.binary_opening(d > 45, iterations=3)
            zone = ndimage.binary_closing(chg | grise, iterations=4) | grise | chg
            zone = ndimage.binary_closing(zone, structure=np.ones((1, 21), bool)) | zone       # trous sur les jambes (tissu proche de la peau)
            zone = ndimage.binary_closing(zone, structure=np.ones((25, 1), bool)) | zone
            # chaque calque reste dans SA bande : le reste de l'image n'est que de la dérive du générateur (peau identique, légèrement décalée)
            ya, yb = np.where((G[..., 3] > 200).any(1))[0][[0, -1]]; Hf = yb - ya; xc = int(np.where(G[..., 3] > 200)[1].mean())
            y_taille = ysplit
            haut_b, bas_b = ((ya + int(.07 * Hf), y_taille + int(.07 * Hf)), (y_taille - int(.03 * Hf), yb)) if zone_grise else (None, None)
            bande = {'haut': haut_b, 'bas': bas_b}.get(zone_grise, (yb - int(.13 * Hf), yb))
            masque_b = np.zeros_like(zone); masque_b[bande[0]:bande[1] + 1, max(0, xc - int(.2 * Hf)):xc + int(.2 * Hf)] = True
            if zone_grise == 'haut': masque_b[bande[0]:bande[1] + 1, :] = True       # les manches sortent de la colonne centrale
            zone = zone & masque_b
            garde = ndimage.binary_closing(d > 18, iterations=3)                         # pas de recollage du gris de l'AUTRE vêtement (identique au gabarit)
            garde = ndimage.binary_fill_holes(garde) | ndimage.binary_dilation(d > 60, iterations=2)
            if not zone_grise:                                                           # chaussures : la peau du pied (nu) n'est pas une chaussure
                nonpeau = np.abs(full[..., :3] - peau).max(-1) > 42
                garde = garde & ndimage.binary_opening(nonpeau, iterations=2)
            zone = zone & garde
            # un calque ne contient QUE du tissu : ni magenta (gabarit), ni peau (le corps lissé la fournit dessous : plus de plaques décalées)
            fr = full[..., :3]
            magenta = ((fr[..., 0] - fr[..., 1]) > 45) & ((fr[..., 2] - fr[..., 1]) > 45)
            peau_px = np.abs(fr - peau).max(-1) < 48
            mxx, mnn = fr.max(-1), fr.min(-1); sat_ = (mxx - mnn) / np.maximum(mxx, 1)
            zone = zone & ~ndimage.binary_dilation(magenta, iterations=2) & ~peau_px & (ndimage.uniform_filter(sat_, 3) < 0.15)   # vêtements = gris : tout pixel coloré (peau, ombres chaudes) est exclu
            zone = ndimage.binary_fill_holes(zone)
            zone = ndimage.binary_opening(zone, iterations=5 if zone_grise == 'bas' else 3)   # supprime les filets de dérive le long des contours
            lab_, n_ = ndimage.label(zone)
            if n_ > 1:
                tailles = ndimage.sum(zone, lab_, range(1, n_ + 1)); zone = np.isin(lab_, [i + 1 for i, t in enumerate(tailles) if t > 0.05 * tailles.max()])
            alpha = ndimage.gaussian_filter(zone.astype(np.float32), 1.0) * (full[..., 3] > 128)
            hors = (G[..., 3] > 200) & ~ndimage.binary_dilation(zone, iterations=8)
        else:
            hors_tete = (G[..., 3] < 128)                                # là où le gabarit est vide, tout ce que la case contient est neuf
            pas_peau = np.clip((np.abs(full[..., :3] - peau).max(-1) - 30) / 30, 0, 1)      # une coiffure n'est pas de la couleur de la peau : écarte la dérive du menton
            alpha = np.where(hors_tete, (full[..., 3] / 255), np.clip((d - 35) / 55, 0, 1) * (full[..., 3] / 255)) * pas_peau   # jamais de peau (épaules recadrées par le générateur)
            vert = np.clip((full[..., 1] - np.maximum(full[..., 0], full[..., 2]) - 4) / 25, 0, 1)   # liseré vert du détourage
            alpha = alpha * (1 - vert)
            mx_, mn_ = full[..., :3].max(-1), full[..., :3].min(-1)
            alpha = alpha * np.clip((((mx_ - mn_) / np.maximum(mx_, 1)) - 0.08) / 0.08, 0, 1)      # retire le gris (débardeur du buste) : une coiffure est colorée
            alpha[zy1:] = 0
            zone = alpha > 0.2
            hors = tete & ~ndimage.binary_dilation(zone, iterations=10)
        if mode != 'corps': alpha = ndimage.gaussian_filter(alpha, 0.7)
        residu = float(d[hors].mean()) if hors.any() else 0.0
        ys, xs = np.where(alpha > 0.08)
        if not len(xs): print('  vide', k); continue
        bb = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        full[..., 1] = np.minimum(full[..., 1], np.maximum(full[..., 0], full[..., 2]))        # dé-débordement du vert
        calque = np.dstack([full[..., :3], alpha * 255]).clip(0, 255).astype(np.uint8)[bb[1]:bb[3], bb[0]:bb[2]]
        Image.fromarray(calque).save(sortie / f'{k}.png', optimize=True)
        rapport.append({'case': k, 'iou_tete': round(iou, 3), 'echelle': round(float(s), 3), 'derive_hors_zone': round(residu, 2), 'bbox': bb})
    (sortie / 'rapport.json').write_text(json.dumps(rapport, indent=1))
    ders = [r['derive_hors_zone'] for r in rapport]; ious = [r['iou_tete'] for r in rapport]
    print(f'{cat}: {len(rapport)} calques | IoU tête min {min(ious):.3f} moy {np.mean(ious):.3f} | dérive hors zone moy {np.mean(ders):.2f} max {max(ders):.2f} /255')


if __name__ == '__main__':
    a = sys.argv
    main(a[1], a[2], int(a[3]), int(a[4]), a[5], a[6], a[7] if len(a) > 7 else 'visage', float(a[8]) if len(a) > 8 else 1.0, a[9] if len(a) > 9 and a[9] != '--debug' else None)
