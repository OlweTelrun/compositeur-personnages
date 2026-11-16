#!/usr/bin/env python3
"""Rend la MÊME matrice de tenues sur tous les corps du registre (prototype/public/corps/registre.json) : validation de la généralité des pièces.
Pour chaque corps : extrait sa texture, la recolore (peau/cheveux/haut), pose une tenue (vêtements ajustés), applique SA marche, rend une image
(direction 1, milieu de foulée). Sortie : une planche corps × tenues + un rapport. Usage : composer_matrice.py <dossier_sortie> [id_corps …]"""
import json, subprocess, sys, os, glob
from pathlib import Path
from PIL import Image, ImageDraw
racine = Path(__file__).resolve().parent.parent.parent
blender = '/Applications/Blender.app/Contents/MacOS/Blender'
ici = Path(__file__).resolve().parent
sortie = Path(sys.argv[1]); sortie.mkdir(parents=True, exist_ok=True)
ids = sys.argv[2:]
reg = json.loads((racine / 'prototype/public/corps/registre.json').read_text())['corps']
if ids: reg = [c for c in reg if c['id'] in ids]
matieres = str(racine / 'prototype/public/matieres')
TENUES = [  # (nom, fichier de tenue, peau, cheveux, couleur du sous-vêtement apparent)
    ('jean-maille', ici / 'tenues/jean-maille.json', '#c68b64', '#1a1a1d', '#2a9d8f'),
    ('vichy-lin', ici / 'tenues/vichy-lin.json', '#f3d2b3', '#d8b04a', '#f4f1ea'),
    ('rouge-tartan', ici / 'tenues/rouge-tartan.json', '#6b422b', '#a8421c', '#e63946'),
]
if os.environ.get('TENUES_SET') == 'tunique':
    TENUES = [('tunique-pantalon', ici / 'tenues/tunique-pantalon-large.json', '#c68b64', '#1a1a1d', '#2a9d8f')]
if os.environ.get('TENUES_SET') == 'amples':
    TENUES = [('pantalon-large', ici / 'tenues/haut-ajuste-pantalon-large.json', '#c68b64', '#1a1a1d', '#2a9d8f'), ('short-large', ici / 'tenues/chemise-short-large.json', '#f3d2b3', '#d8b04a', '#f4f1ea')]
if os.environ.get('TENUES_SET') == 'jupes':  # variante : trois jupes (tartan, courte en lin, longue en denim)
    TENUES = [('jupe-tartan', ici / 'tenues/jupe-tartan.json', '#c68b64', '#1a1a1d', '#f4f1ea'),
              ('jupe-courte-lin', ici / 'tenues/jupe-courte-lin.json', '#f3d2b3', '#d8b04a', '#e63946'),
              ('jupe-denim-longue', ici / 'tenues/jupe-denim-longue.json', '#6b422b', '#a8421c', '#f4f1ea')]
if os.environ.get('TENUE_UNIQUE'):  # ne rendre qu'une tenue (par son nom)
    TENUES = [t for t in TENUES if t[0] == os.environ['TENUE_UNIQUE']]
STYLE = os.environ.get('STYLE', 'base')  # 'jeu' : éclairage et matériaux du jeu, vue quasi de face, rendu suréchantillonné + finition
STYLE_ARGS = ['--style', 'jeu', '--tilt', '10'] if STYLE == 'jeu' else []
RES = '768' if STYLE == 'jeu' else '320'
DIRS = '0' if STYLE == 'jeu' else '1'
FINITION = os.environ.get('FINITION', '').split()  # ex. FINITION="--sat 1.3 --contraste 1.15 --nettete 0.6"
# Coiffures d'essai par corps (COIFFURES=1) : type et couleur ; le teint du crâne suit le teint de la tenue
COIFFURE_PAR_CORPS = {'femme-ronde': ('bob', '#2a1a10'), 'homme-mince': ('court', '#5a3418'), 'homme-trapu': ('chauve', '#2a1a10'), 'femme-moyenne': ('queue', '#c8963a'),
                      'femme-senior': ('chignon', '#cfcfd4'), 'garcon': ('court', '#7a4a28'), 'femme-mince': ('long', '#1a1a1d'), 'homme-rond': ('afro', '#1a1a1d'),
                      'homme-senior': ('court', '#cfcfd4'), 'femme-athletique': ('queue', '#2a1a10')}
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout + r.stderr
extr = ici / '_extraire_texture.py'
extr.write_text("import bpy, sys\nglb, out = sys.argv[sys.argv.index('--') + 1:][:2]\nbpy.ops.wm.read_factory_settings(use_empty=True)\nbpy.ops.import_scene.gltf(filepath=glb)\nimg = bpy.data.images['Image_0']; img.filepath_raw = out; img.file_format = 'PNG'; img.save()\n")
def coiffure_args(cid, peau):
    if not os.environ.get('COIFFURES'): return []
    t, coul = COIFFURE_PAR_CORPS[cid]
    return ['--coiffure', json.dumps({'type': t, 'couleur': coul, 'peau': peau})]
rapport = []
for c in reg:
    d = sortie / c['id']; d.mkdir(exist_ok=True)
    tex = d / 'texture.png'
    if not tex.exists(): run([blender, '--background', '--python', str(extr), '--', c['rig'], str(tex)])
    masque = d / 'masque-cheveux.json'  # cheveux définis par la géométrie (cheveux blancs/gris/blonds compris)
    if not masque.exists(): run([blender, '--background', '--python', str(ici / 'masque_cheveux.py'), '--', c['rig'], str(masque)])
    for nom, fichier, peau, cheveux, haut in TENUES:
        t2 = d / f'tex-{nom}.png'
        run([sys.executable, str(ici / 'recolorer_texture.py'), str(tex), str(t2), '--peau', peau, '--haut', haut, '--cheveux', cheveux, '--masque-cheveux', str(masque)])
        # la tenue référence $MATIERES : on la matérialise avec le bon chemin
        spec = json.loads(fichier.read_text().replace('/Users/jeremy/Antigravity/compositeurPersonnages/prototype/public/matieres', matieres))
        for v in spec:  # réglages propres au corps (registre `ajustement`)
            v.update(c.get('ajustement', {}).get(v['type'], {}))
        sp = d / f'tenue-{nom}.json'; sp.write_text(json.dumps(spec))
        rd = d / nom
        for f in glob.glob(str(rd / '*.png')): os.remove(f)
        out = run([blender, '--background', '--python', str(ici / 'rendre_modulaire.py'), '--', '--glb', c['rig'], '--anim', c['marche'], '--texture', str(t2),
                   '--vetements', str(sp), '--out', str(rd), '--dirs-liste', DIRS, '--pas', '8', '--res', RES, '--prefixe', 'x', '--echelle', str(c.get('echelle', 1.0)), '--cadrage', '2.1'] + STYLE_ARGS + coiffure_args(c['id'], peau))
        if STYLE == 'jeu' and not os.environ.get('SANS_FINITION'):  # finition d'image (saturation, contraste, netteté) puis réduction 768 → 256 : écrase les rendus bruts par les rendus finis dans le même dossier
            run([sys.executable, str(ici / 'finition_style.py'), str(rd), str(rd / '_fini'), '--dossier'] + FINITION)
            for f in glob.glob(str(rd / '_fini' / '*.png')): os.replace(f, str(rd / os.path.basename(f)))
            os.rmdir(rd / '_fini')
        ligne = [l for l in out.splitlines() if l.startswith(('VETEMENT', 'RENDU', 'Error', 'Traceback'))]
        rapport.append((c['id'], nom, ligne))
        print(c['id'], nom, ' | '.join(ligne))
# planche : lignes = corps (tous ceux du registre qui ont des rendus dans le dossier), colonnes = tenues × 2 foulées
reg = [c for c in json.loads((racine / 'prototype/public/corps/registre.json').read_text())['corps'] if (sortie / c['id']).exists()]
W = 200; cols = len(TENUES) * 2
planche = Image.new('RGBA', (cols * W, len(reg) * (W + 14)), (215, 215, 215, 255)); dr = ImageDraw.Draw(planche)
for r, c in enumerate(reg):
    dr.text((4, r * (W + 14) + 1), c['id'], fill=(0, 0, 0, 255))
    for k, (nom, *_r) in enumerate(TENUES):
        fs = sorted(glob.glob(str(sortie / c['id'] / nom / '*.png')))
        for j, f in enumerate(fs[1:3] if len(fs) > 2 else fs[:2]):
            planche.alpha_composite(Image.open(f).convert('RGBA').resize((W, W)), ((k * 2 + j) * W, r * (W + 14) + 14))
planche.save(sortie / 'matrice.png'); print('planche :', sortie / 'matrice.png')
