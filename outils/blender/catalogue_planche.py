#!/usr/bin/env python3
"""Planche de contrôle du catalogue de pièces : chaque pièce est rendue ISOLÉE (les autres pièces de la tenue sont neutres) sur deux corps de référence,
en style « jeu » (vue de face puis de profil). Usage : catalogue_planche.py <dossier_sortie> [id_corps_1 id_corps_2]"""
import json, subprocess, sys, os, glob
from pathlib import Path
from PIL import Image, ImageDraw
racine = Path(__file__).resolve().parent.parent.parent; ici = Path(__file__).resolve().parent
blender = '/Applications/Blender.app/Contents/MacOS/Blender'
sortie = Path(sys.argv[1]); sortie.mkdir(parents=True, exist_ok=True)
ids = sys.argv[2:] or ['femme-moyenne', 'homme-trapu']
reg = {c['id']: c for c in json.loads((racine / 'prototype/public/corps/registre.json').read_text())['corps']}
cat = json.loads((racine / 'prototype/public/pieces/catalogue.json').read_text())
M = str(racine / 'prototype/public/matieres')
NEUTRE = {'haut': {'type': 'tshirt', 'couleur': '#f4f1ea', 'matiere': f'{M}/tissu-lin.png', 'teintable': True, 'tuile': 0.25},
          'bas': {'type': 'shorts', 'couleur': '#4a6fa8', 'matiere': f'{M}/tissu-denim.png', 'teintable': True, 'tuile': 0.25}}
# couleurs d'essai des pièces (matière lin teintée, ou imprimé pour les hauts)
COUL = {'haut': {'couleur': '#2a9d8f', 'matiere': f'{M}/tissu-maille.png', 'teintable': True, 'tuile': 0.2},
        'bas': {'couleur': '#d8c28a', 'matiere': f'{M}/tissu-lin.png', 'teintable': True, 'tuile': 0.25}}
def run(c): r = subprocess.run(c, capture_output=True, text=True); return r.stdout + r.stderr
tuiles = []
for p in cat['pieces']:
    for cid in ids:
        c = reg[cid]; d = sortie / cid; d.mkdir(exist_ok=True)
        spec = []
        k = p['categorie']
        if k == 'haut': spec = [{**NEUTRE['bas']}, {**p['blender'], **COUL['haut']}]
        elif k == 'bas': spec = [{**NEUTRE['haut']}, {**p['blender'], **({**COUL['bas']} if p['blender']['type'] != 'jupe' else {'couleur': '#e63946', 'matiere': f'{M}/tissu-tartan.png', 'teintable': False, 'tuile': 0.4})}]
        else: spec = [{**NEUTRE['haut']}, {**NEUTRE['bas']}, {**p['blender']}]
        sj = d / f"{p['id']}.json"; sj.write_text(json.dumps(spec))
        out = d / p['id']
        for f in glob.glob(str(out / '*.png')): os.remove(f)
        tex = racine / 'prototype/public/corps' / 'x'  # texture neutre : celle déjà recolorée par composer_matrice si présente, sinon l'originale
        ref_tex = Path(os.environ.get('TEXTURES', '')) / cid / 'texture.png' if os.environ.get('TEXTURES') else None
        args = [blender, '--background', '--python', str(ici / 'rendre_modulaire.py'), '--', '--glb', c['rig'], '--vetements', str(sj), '--out', str(out),
                '--dirs-liste', '0,2', '--pas', '100', '--res', '768', '--prefixe', 'p', '--echelle', str(c.get('echelle', 1.0)), '--cadrage', '2.0', '--style', 'jeu', '--tilt', '10']
        if ref_tex and ref_tex.exists():
            t2 = d / 'tex-neutre.png'
            if not t2.exists(): run([sys.executable, str(ici / 'recolorer_texture.py'), str(ref_tex), str(t2), '--peau', '#d9a07a', '--haut', '#f4f1ea', '--cheveux', '#3a2414', '--masque-cheveux', str(Path(os.environ['TEXTURES']) / cid / 'masque-cheveux.json')])
            args += ['--texture', str(t2)]
        run(args)
        run([sys.executable, str(ici / 'finition_style.py'), str(out), str(out / '_f'), '--dossier'])
        tuiles.append((p['id'], cid, sorted(glob.glob(str(out / '_f' / '*.png')))))
        print(p['id'], cid, len(tuiles[-1][2]), 'images', flush=True)
W = 170; cols = len(ids) * 2
planche = Image.new('RGBA', (cols * W, len(cat['pieces']) * (W + 14)), (215, 215, 215, 255)); dr = ImageDraw.Draw(planche)
def rogner(f):
    im = Image.open(f).convert('RGBA'); bb = im.getchannel('A').getbbox(); c = im.crop(bb); k = (W - 6) / c.height; return c.resize((max(1, int(c.width * k)), W - 6), Image.LANCZOS)
for r, p in enumerate(cat['pieces']):
    dr.text((3, r * (W + 14) + 1), p['id'], fill=(0, 0, 0, 255))
    for j, (pid, cid, fs) in enumerate([t for t in tuiles if t[0] == p['id']]):
        for k, f in enumerate(fs[:2]):
            im = rogner(f); planche.alpha_composite(im, ((j * 2 + k) * W + (W - im.width) // 2, r * (W + 14) + 14))
planche.save(sortie / 'planche.png'); print('planche :', sortie / 'planche.png')
