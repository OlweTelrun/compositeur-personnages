#!/usr/bin/env python3
"""Contrôle automatique des sprites produits (prototype/sortie/<segment>/<n>.png) AVANT toute installation dans le jeu.

Les seuils viennent de mesures sur les 85 sprites 256×256 du jeu : boîte de 225 px, pieds à 247 px.
ÉCHEC (bloque l'installation) : taille ≠ 256×256 ou pas RGBA ; image vide ; personnage collé à un bord ; hors gabarit (plus petit que
 0,70 ou plus grand que 0,90 du cadre) ; pieds loin de 247 px ; fond non transparent (coins opaques).
AVERTISSEMENT (à regarder) : morceau détaché de plus de 3 % des pixels (objet qui flotte, double personnage) ; bords très flous
 (> 20 % de pixels semi-transparents ; sprites du jeu : 7 à 19,5 %) ; couleur du vêtement du haut éloignée de la recette (si lot-style.json présent et matière unie).
Usage : controler_sprites.py <segment> [index …]  → code de sortie 1 s'il y a au moins un ÉCHEC.
"""
import colorsys, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

racine = Path(__file__).resolve().parent.parent
if len(sys.argv) < 2:
    sys.exit(__doc__)
segment = sys.argv[1]
dossier = racine / 'prototype' / 'sortie' / segment
indices = [int(x) for x in sys.argv[2:]] or sorted(int(p.stem) for p in dossier.glob('[0-9]*.png'))
lot = {}
if (dossier / 'lot-style.json').exists():
    lot = {it['index']: it for it in json.loads((dossier / 'lot-style.json').read_text())['items']}
IMPRIMEES = {'tissu.vichy@1', 'tissu.rayures@1', 'tissu.tartan@1'}

def hsv(hex_):
    r, g, b = (int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)); return colorsys.rgb_to_hsv(r, g, b)

def verifier(idx):
    echecs, avert = [], []
    f = dossier / f'{idx}.png'
    if not f.exists():
        return [f'{idx}.png introuvable'], []
    im = Image.open(f)
    if im.size != (256, 256) or im.mode != 'RGBA':
        return [f'format {im.size} {im.mode} (attendu 256×256 RGBA)'], []
    a = np.array(im)
    al = a[:, :, 3]
    if al[:2, :2].max() > 8 or al[:2, -2:].max() > 8 or al[-2:, :2].max() > 8 or al[-2:, -2:].max() > 8:
        echecs.append('fond non transparent (coins opaques)')
    masque = al > 16
    if not masque.any():
        return ['image vide'], []
    ys, xs = np.where(masque)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    if x0 <= 1 or y0 <= 1 or x1 >= 255 or y1 >= 255:
        echecs.append(f'personnage collé à un bord (boîte {x0},{y0},{x1},{y1})')
    h, w = y1 - y0, x1 - x0
    cote = max(h, w) / 256
    if not 0.70 <= cote <= 0.90:
        echecs.append(f'gabarit {cote:.2f} du cadre (jeu : ≈ 0,88 ; accepté 0,70–0,90)')
    if abs(y1 - 247) > 6:
        echecs.append(f'pieds à {y1} px (jeu : 247)')
    lab, n = ndimage.label(masque)
    if n > 1:
        tailles = ndimage.sum(masque, lab, range(1, n + 1))
        reste = 1 - tailles.max() / tailles.sum()
        if reste > 0.03:
            avert.append(f'{reste * 100:.1f} % des pixels hors du plus grand morceau ({n} morceaux : objet détaché ?)')
    flou = ((al > 8) & (al < 248)).sum() / masque.sum()
    if flou > 0.20:  # sprites du jeu : 0,07 à 0,195 (mesuré sur 85)
        avert.append(f'bords flous ({flou * 100:.0f} % de pixels semi-transparents)')
    # Couleur du vêtement du haut : zone du buste (30–48 % de la hauteur : commune aux proportions trapues et élancées, 30 % centraux), comparée à la recette
    it = lot.get(idx)
    if it:
        haut = next((p for p in it['recette']['tenuePieces'] if p['piece'].startswith('haut.')), None)
        if haut and haut.get('matiere') not in IMPRIMEES:
            zone = a[y0 + int(h * 0.30): y0 + int(h * 0.48), x0 + int(w * 0.35): x0 + int(w * 0.65)]
            zone = zone[zone[:, :, 3] > 200][:, :3]
            if len(zone) > 50:
                med = np.median(zone, axis=0).astype(int)
                hx = '#%02x%02x%02x' % tuple(med)
                (h1, s1, v1), (h2, s2, v2) = hsv(hx), hsv(haut['couleurs']['corps'])
                dh = min(abs(h1 - h2), 1 - abs(h1 - h2)) * 360
                if s2 > 0.25 and s1 > 0.15 and dh > 40:
                    avert.append(f'couleur du haut {hx} loin de la recette {haut["couleurs"]["corps"]} (écart de teinte {dh:.0f}°)')
                elif abs(v1 - v2) > 0.4:
                    avert.append(f'luminosité du haut {hx} loin de la recette {haut["couleurs"]["corps"]}')
    return echecs, avert

total_echecs = 0
for i in indices:
    e, w = verifier(i)
    total_echecs += len(e)
    etat = 'ÉCHEC' if e else ('à regarder' if w else 'ok')
    print(f'{segment}/{i}.png : {etat}')
    for m in e: print(f'   ÉCHEC : {m}')
    for m in w: print(f'   avertissement : {m}')
sys.exit(1 if total_echecs else 0)
