#!/usr/bin/env python3
"""Planche des poses : chaque pose sur des corps choisis (de face, style jeu). Usage : poses_planche.py <dossier_sortie> [id_corps …]"""
import json, subprocess, sys, os, glob
from pathlib import Path
from PIL import Image, ImageDraw
racine = Path(__file__).resolve().parent.parent.parent; ici = Path(__file__).resolve().parent
sortie = Path(sys.argv[1]); sortie.mkdir(parents=True, exist_ok=True)
ids = sys.argv[2:] or ['femme-moyenne', 'homme-trapu', 'garcon']
reg = {c['id']: c for c in json.loads((racine / 'prototype/public/corps/registre.json').read_text())['corps']}
POSES = os.environ.get('POSES', 'repos,hanches,salut,danse,verre,selfie').split(',')
M = racine / 'prototype/public/matieres'
ACC = {'verre': [{'type': 'verre'}], 'selfie': [{'type': 'telephone'}]}
AMPLE = os.environ.get('AMPLE') == '1'
MAT = lambda n: str(M / n)
AMPLE = os.environ.get('AMPLE') == '1'
if AMPLE:
    vet = [{'type': 'tunique', 'couleur': '#2a9d8f', 'matiere': MAT('tissu-maille.png'), 'teintable': True, 'tuile': 0.2, 'manches': float(os.environ.get('MANCHES', '0.45'))},
           {'type': 'short_large', 'couleur': '#d8c28a', 'matiere': MAT('tissu-lin.png'), 'teintable': True, 'tuile': 0.25}]
else:
    vet = [{'type': 'tshirt', 'couleur': '#2a9d8f', 'matiere': MAT('tissu-maille.png'), 'teintable': True, 'tuile': 0.2},
           {'type': 'shorts', 'couleur': '#d8c28a', 'matiere': MAT('tissu-lin.png'), 'teintable': True, 'tuile': 0.25}]
def run(c): r = subprocess.run(c, capture_output=True, text=True); return r.stdout + r.stderr
W = 200; planche = Image.new('RGBA', (len(POSES) * W, len(ids) * (W + 12)), (215, 215, 215, 255)); dr = ImageDraw.Draw(planche)
for r, cid in enumerate(ids):
    c = reg[cid]
    for j, p in enumerate(POSES):
        out = sortie / cid / p
        for f in glob.glob(str(out / '*.png')): os.remove(f)
        (sortie / 'vet.json').write_text(json.dumps(vet + ACC.get(p, [])))
        o = run(['/Applications/Blender.app/Contents/MacOS/Blender', '--background', '--python', str(ici / 'rendre_modulaire.py'), '--', '--glb', c['rig'], '--vetements', str(sortie / 'vet.json'), '--pose', p,
                 '--out', str(out), '--dirs-liste', '0', '--pas', '100', '--res', '768', '--prefixe', 'p', '--echelle', str(c.get('echelle', 1.0)), '--cadrage', '2.1', '--style', 'jeu', '--tilt', '10'])
        run([sys.executable, str(ici / 'finition_style.py'), str(out), str(out / '_f'), '--dossier'])
        fs = sorted(glob.glob(str(out / '_f' / '*.png')))
        if fs:
            im = Image.open(fs[0]).convert('RGBA'); bb = im.getchannel('A').getbbox(); im = im.crop(bb); k = (W - 8) / im.height; im = im.resize((max(1, int(im.width * k)), W - 8), Image.LANCZOS)
            planche.alpha_composite(im, (j * W + (W - im.width) // 2, r * (W + 12) + 12))
        else: print('ÉCHEC', cid, p, o[-300:])
        dr.text((j * W + 3, r * (W + 12) + 1), f'{cid} / {p}', fill=(0, 0, 0, 255))
planche.save(sortie / 'planche.png'); print('planche')
