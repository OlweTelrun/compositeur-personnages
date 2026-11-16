#!/usr/bin/env python3
"""Fabrique un décalque de visage (PNG RGBA, 512×512) à partir de PIÈCES choisies : plaque de peau + yeux + sourcils + nez + bouche.
Chaque pièce est un paramètre (type, couleur, taille, position) : n'importe quelle combinaison donne un visage valide.
Repère : (0,0) en haut à gauche ; le visage occupe le tiers central-bas de la tête projetée (calage fait par rendre_modulaire.py).
Usage : visage_decal.py sortie.png '{"peau":"#c68b64","yeux":{"type":"rond","couleur":"#3a2a1a"},"bouche":{"type":"sourire","couleur":"#a8423c"},"nez":{"type":"petit"},"sourcils":{"type":"droit"}}'"""
import sys, json
from PIL import Image, ImageDraw, ImageFilter
S = 1024  # sur-échantillonné puis réduit
out_path, spec = sys.argv[1], json.loads(sys.argv[2])
peau = spec.get('peau', '#c68b64')
im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
cx, cy = S // 2, int(S * 0.52)
# plaque de peau (ovale) : recouvre le visage peint de la texture d'origine, bords adoucis plus bas
d.ellipse((cx - 300, cy - 300, cx + 300, cy + 330), fill=peau)
def ombre(c, k=0.78): return tuple(int(int(c[i:i + 2], 16) * k) for i in (1, 3, 5))
yeux = spec.get('yeux', {}); ec = yeux.get('couleur', '#3a2a1a'); ey = cy - 30; ex = int(120 * yeux.get('ecart', 1.0))
for sgn in (-1, 1):
    x = cx + sgn * ex
    t = yeux.get('type', 'rond')
    if t == 'rond':
        d.ellipse((x - 62, ey - 62, x + 62, ey + 62), fill='white'); d.ellipse((x - 36, ey - 36, x + 36, ey + 36), fill=ec); d.ellipse((x - 14, ey - 14, x + 14, ey + 14), fill='black')
    elif t == 'amande':
        d.ellipse((x - 70, ey - 34, x + 70, ey + 34), fill='white'); d.ellipse((x - 30, ey - 30, x + 30, ey + 30), fill=ec); d.ellipse((x - 12, ey - 12, x + 12, ey + 12), fill='black')
        d.arc((x - 74, ey - 40, x + 74, ey + 40), 190, 350, fill=ombre(peau, 0.4), width=9)
    elif t == 'petit':
        d.ellipse((x - 30, ey - 30, x + 30, ey + 30), fill=ec); d.ellipse((x - 10, ey - 10, x + 10, ey + 10), fill='black')
    elif t == 'ferme':  # yeux fermés / souriants
        d.arc((x - 55, ey - 40, x + 55, ey + 40), 200, 340, fill=ombre(peau, 0.35), width=12)
    if yeux.get('cils') and t != 'petit':
        d.arc((x - 66, ey - 66, x + 66, ey + 40), 200, 340, fill='black', width=10)
sc = spec.get('sourcils', {}); 
if sc.get('type', 'droit') != 'aucun':
    for sgn in (-1, 1):
        x = cx + sgn * ex; y = ey - 100
        if sc.get('type', 'droit') == 'droit': d.line((x - 62, y, x + 62, y - sgn * 6), fill=ombre('#3a2a1a', 1), width=16)
        elif sc['type'] == 'arque': d.arc((x - 70, y - 40, x + 70, y + 40), 200, 340, fill=ombre('#3a2a1a', 1), width=16)
        elif sc['type'] == 'epais': d.line((x - 66, y, x + 66, y - sgn * 10), fill=ombre('#2a1a0a', 1), width=30)
nz = spec.get('nez', {}); ny = cy + 70
if nz.get('type', 'petit') == 'petit': d.ellipse((cx - 22, ny - 8, cx + 22, ny + 26), fill=ombre(peau, 0.86))
elif nz['type'] == 'large': d.ellipse((cx - 50, ny - 14, cx + 50, ny + 34), fill=ombre(peau, 0.84)); d.ellipse((cx - 34, ny + 8, cx - 12, ny + 26), fill=ombre(peau, 0.55)); d.ellipse((cx + 12, ny + 8, cx + 34, ny + 26), fill=ombre(peau, 0.55))
elif nz['type'] == 'long': d.polygon([(cx - 14, ny - 70), (cx + 14, ny - 70), (cx + 34, ny + 26), (cx - 34, ny + 26)], fill=ombre(peau, 0.88))
bc = spec.get('bouche', {}); bcol = bc.get('couleur', '#a8423c'); my = cy + 150
t = bc.get('type', 'sourire')
if t == 'sourire': d.arc((cx - 85, my - 70, cx + 85, my + 40), 20, 160, fill=bcol, width=18)
elif t == 'ouverte': d.chord((cx - 80, my - 45, cx + 80, my + 60), 0, 180, fill=ombre(bcol, 0.55)); d.chord((cx - 80, my - 45, cx + 80, my - 5), 0, 180, fill='white')
elif t == 'neutre': d.line((cx - 60, my, cx + 60, my), fill=bcol, width=16)
elif t == 'moue': d.arc((cx - 60, my - 10, cx + 60, my + 60), 200, 340, fill=bcol, width=16)
elif t == 'large': d.chord((cx - 110, my - 60, cx + 110, my + 50), 0, 180, fill=bcol)
im = im.filter(ImageFilter.GaussianBlur(1.2)).resize((512, 512), Image.LANCZOS)
im.save(out_path); print('décalque écrit :', out_path)
