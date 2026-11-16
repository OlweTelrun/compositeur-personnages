#!/usr/bin/env python3
"""Cadre des images de la bibliothèque (PNG détouré, grand format) en sprites de jeu 256×256.

Convention MESURÉE sur les 85 sprites 256×256 du jeu (7 nov. 2026) : le personnage tient dans une boîte de 225 px (0,88 × 256) —
hauteur 225 px pour presque tous, moins s'il est large (groupes, bras écartés) —, centré horizontalement, pieds à 247 px (0,965 × 256).
Usage : cadrer_sprites.py <segment> <index>=<fichier.png> [<index>=<fichier.png> …] [--boite 225] [--ecraser]
Écrit prototype/sortie/<segment>/<index>.png. N'écrase pas un fichier existant sans --ecraser.
"""
import sys
from pathlib import Path
from PIL import Image

racine = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:]]
boite = 225
ecraser = '--ecraser' in args
if '--boite' in args:
    i = args.index('--boite'); boite = int(args[i + 1]); del args[i:i + 2]
args = [a for a in args if a != '--ecraser']
if len(args) < 2:
    sys.exit(__doc__)
segment, paires = args[0], args[1:]
S = 256
sol = round(S * 0.965)
dest = racine / 'prototype' / 'sortie' / segment
dest.mkdir(parents=True, exist_ok=True)
for p in paires:
    idx, _, chemin = p.partition('=')
    im = Image.open(chemin).convert('RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bb:
        print(f'{idx}: image vide, ignorée'); continue
    im = im.crop(bb)
    k = min(boite / im.height, boite / im.width)  # contenu dans la boîte : hauteur 225 px sauf personnage plus large que haut
    w = max(1, round(im.width * k))
    im = im.resize((w, max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.alpha_composite(im, ((S - im.width) // 2, sol - im.height))
    cible = dest / f'{int(idx)}.png'
    if cible.exists() and not ecraser:
        print(f'{cible.name}: existe déjà (utiliser --ecraser)'); continue
    out.save(cible)
    print(f'{cible.relative_to(racine)} : {im.width}×{im.height} px dans 256×256')
