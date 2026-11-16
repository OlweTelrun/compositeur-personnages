#!/usr/bin/env python3
"""Planche des coiffures : 7 coiffures (chauve, court, bob, long, queue, chignon, afro) sur des corps choisis, de face puis de profil, style « jeu ».
Usage : coiffures_planche.py <dossier_sortie> [id_corps …]"""
import json, subprocess, sys, os, glob
from pathlib import Path
from PIL import Image, ImageDraw
racine = Path(__file__).resolve().parent.parent.parent; ici = Path(__file__).resolve().parent
blender = '/Applications/Blender.app/Contents/MacOS/Blender'
sortie = Path(sys.argv[1]); sortie.mkdir(parents=True, exist_ok=True)
ids = sys.argv[2:] or ['homme-trapu', 'femme-ronde', 'femme-moyenne']
reg = {c['id']: c for c in json.loads((racine / 'prototype/public/corps/registre.json').read_text())['corps']}
STYLES = [('chauve', '#3a2414'), ('court', '#2a1a10'), ('bob', '#d8b04a'), ('long', '#a8421c'), ('queue', '#1a1a1d'), ('chignon', '#8a8a90'), ('afro', '#1a1a1d')]
if os.environ.get('STYLES_SEUL'): STYLES = [t for t in STYLES if t[0] in os.environ['STYLES_SEUL'].split(',')]
TEXTURES = os.environ.get('TEXTURES', '')
def run(c): r = subprocess.run(c, capture_output=True, text=True); return r.stdout + r.stderr
res = []
for cid in ids:
    c = reg[cid]
    for t, coul in STYLES:
        out = sortie / cid / t
        for f in glob.glob(str(out / '*.png')) + glob.glob(str(out / '_f' / '*.png')): os.remove(f)
        args = [blender, '--background', '--python', str(ici / 'rendre_modulaire.py'), '--', '--glb', c['rig'], '--coiffure', json.dumps({'type': t, 'couleur': coul, 'peau': '#d9a07a'}),
                '--out', str(out), '--dirs-liste', '0,2', '--pas', '100', '--res', '768', '--prefixe', 'h', '--cadrage', '2.0', '--echelle', str(c.get('echelle', 1.0)), '--style', 'jeu', '--tilt', '10']
        if TEXTURES and (Path(TEXTURES) / cid / 'texture.png').exists(): args += ['--texture', str(Path(TEXTURES) / cid / 'texture.png')]
        o = run(args)
        run([sys.executable, str(ici / 'finition_style.py'), str(out), str(out / '_f'), '--dossier'])
        res.append((cid, t, sorted(glob.glob(str(out / '_f' / '*.png'))), [l for l in o.splitlines() if l.startswith(('CHEVEUX_ORIGINE', 'Error', 'Trace'))]))
        print(cid, t, ' | '.join(res[-1][3]), flush=True)
W = 200
planche = Image.new('RGBA', (len(STYLES) * 2 * W // 2 * 1, len(ids) * (W + 14)), (215, 215, 215, 255))
planche = Image.new('RGBA', (len(STYLES) * W, len(ids) * (W + 14) * 2), (215, 215, 215, 255)); dr = ImageDraw.Draw(planche)
def tete(f):
    im = Image.open(f).convert('RGBA'); bb = im.getchannel('A').getbbox(); c = im.crop(bb); k = (W - 6) / c.height; return c.resize((max(1, int(c.width * k)), W - 6), Image.LANCZOS)
for r, cid in enumerate(ids):
    for j, (t, _) in enumerate(STYLES):
        fs = [x for x in res if x[0] == cid and x[1] == t][0][2]
        dr.text((j * W + 3, r * 2 * (W + 14) + 1), f'{cid} / {t}', fill=(0, 0, 0, 255))
        for k, f in enumerate(fs[:2]):
            im = tete(f); planche.alpha_composite(im, (j * W + (W - im.width) // 2, r * 2 * (W + 14) + 14 + k * (W + 14)))
planche.save(sortie / 'planche.png'); print('planche :', sortie / 'planche.png')
