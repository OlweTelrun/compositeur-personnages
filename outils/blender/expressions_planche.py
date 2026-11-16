#!/usr/bin/env python3
"""Planche des expressions : gros plans de la tête, N expressions × N corps (style « jeu »). Usage : expressions_planche.py <dossier_sortie> [id_corps …]"""
import json, subprocess, sys, os, glob
from pathlib import Path
from PIL import Image, ImageDraw
racine = Path(__file__).resolve().parent.parent.parent; ici = Path(__file__).resolve().parent
blender = '/Applications/Blender.app/Contents/MacOS/Blender'
sortie = Path(sys.argv[1]); sortie.mkdir(parents=True, exist_ok=True)
ids = sys.argv[2:] or ['homme-trapu', 'femme-moyenne', 'garcon', 'femme-senior', 'homme-senior', 'femme-athletique']
reg = {c['id']: c for c in json.loads((racine / 'prototype/public/corps/registre.json').read_text())['corps']}
EXPR = os.environ.get('EXPRESSIONS', 'neutre,sourire,grand_sourire,rire,surpris,colere,clin_d_oeil').split(',')
TEXTURES = os.environ.get('TEXTURES', '')
def run(c): r = subprocess.run(c, capture_output=True, text=True); return r.stdout + r.stderr
W = 190; planche = Image.new('RGBA', (len(EXPR) * W, len(ids) * (W + 12)), (215, 215, 215, 255)); dr = ImageDraw.Draw(planche)
for r, cid in enumerate(ids):
    c = reg[cid]; dr.text((3, r * (W + 12) + 1), cid, fill=(0, 0, 0, 255))
    for j, e in enumerate(EXPR):
        out = sortie / cid / e
        for f in glob.glob(str(out / '*.png')): os.remove(f)
        args = [blender, '--background', '--python', str(ici / 'rendre_modulaire.py'), '--', '--glb', c['rig'], '--expression', e, '--out', str(out), '--dirs-liste', '0', '--pas', '100',
                '--res', '640', '--prefixe', 'e', '--focus-tete', '--style', 'jeu', '--tilt', '5']
        if c.get('visage'): args += ['--visage-reperes', json.dumps(c['visage'])]
        if TEXTURES and (Path(TEXTURES) / cid / 'texture.png').exists(): args += ['--texture', str(Path(TEXTURES) / cid / 'texture.png')]
        run(args)
        fs = sorted(glob.glob(str(out / '*.png')))
        if fs: planche.alpha_composite(Image.open(fs[0]).convert('RGBA').resize((W, W)), (j * W, r * (W + 12) + 12))
        print(cid, e, bool(fs), flush=True)
planche.save(sortie / 'planche.png'); print('planche :', sortie / 'planche.png')
