#!/usr/bin/env python3
"""Produit des sprites 256×256 à partir d'un lot de recettes (segments.js) : recette → corps riggé + tenue (pièces du catalogue) + coiffure + expression → rendu Blender
(style « jeu », vue de face) → finition → recadrage aux mesures des sprites du jeu (boîte 225 px, pieds à 247 px). Les groupes (couple, famille) : un rendu par personne, assemblées côte à côte.
Usage : produire_lot.py <segment> <n> <graine> <index_debut> [--seul i,j]     → prototype/sortie/rendu3d/<segment>/<index>.png + lot-3d.json"""
import json, subprocess, sys, os, glob, re, hashlib, shutil
from pathlib import Path
from PIL import Image

racine = Path(__file__).resolve().parent.parent.parent; ici = Path(__file__).resolve().parent
blender = '/Applications/Blender.app/Contents/MacOS/Blender'
seg, n, graine, debut = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
seul = None
if '--seul' in sys.argv: seul = {int(x) for x in sys.argv[sys.argv.index('--seul') + 1].split(',')}
reg = {c['id']: c for c in json.loads((racine / 'prototype/public/corps/registre.json').read_text())['corps']}
M = racine / 'prototype/public/matieres'
sortie = racine / 'prototype/sortie/rendu3d' / seg; sortie.mkdir(parents=True, exist_ok=True)
travail = Path('/tmp/produire_lot') / seg; shutil.rmtree(travail, ignore_errors=True); travail.mkdir(parents=True)

lot = json.loads(subprocess.run(['node', str(racine / 'outils/prompts_lot.mjs'), seg, n, graine, debut], capture_output=True, text=True, check=True).stdout)

# ---- correspondances (dupliquent kit.js : matières) ----
MATIERES = {'tissu.denim@1': ('tissu-denim', True, 0.25), 'tissu.lin@1': ('tissu-lin', True, 0.25), 'tissu.maille@1': ('tissu-maille', True, 0.2), 'tissu.tweed@1': ('tissu-tweed', True, 0.25),
            'cuir.grain@1': ('cuir-grain', True, 0.25), 'tissu.vichy@1': ('tissu-vichy', False, 0.5), 'tissu.rayures@1': ('tissu-rayures', False, 0.5), 'tissu.tartan@1': ('tissu-tartan', False, 0.4)}
AMPLE = os.environ.get('AJUSTE') != '1'   # vêtements amples (tubes) par défaut ; AJUSTE=1 : retour aux vêtements moulants
# pièces du kit → catalogue (prototype/public/pieces/catalogue.json = source unique : type Blender, version « ample », ordre d'habillage)
CAT = {p['kit']: p for p in json.loads((racine / 'prototype/public/pieces/catalogue.json').read_text())['pieces'] if p.get('kit')}
CHEVEUX = {'jet black': '#1a1a1d', 'dark brown': '#3a2414', 'chestnut brown': '#5a3418', 'light brown': '#7a4a28', 'dark blond': '#b08d3a', 'ginger red': '#a8421c',
           'silver grey': '#cfcfd4', 'white': '#f0f0f0', 'salt-and-pepper grey': '#9a9a9e'}

def choisir_corps(m):
    f = m['macros']['silhouette'] < 0; c = m['macros']['corpulence']; mu = m['macros']['musculature']; age = m['macros']['age']
    if m.get('enfant') or age < 0.3: return 'garcon'
    h = int(hashlib.md5(json.dumps(m['tenuePieces']).encode()).hexdigest(), 16)
    if age > 0.8: return 'femme-senior' if f else 'homme-senior'
    if f:
        if c > 0.35 or m['morphologie'] == 'ronde' and c > 0: return 'femme-ronde'
        if c < -0.15: return 'femme-mince' if h % 2 else 'femme-athletique'
        return ['femme-moyenne', 'femme-athletique', 'femme-mince'][h % 3] if mu > 0.1 else 'femme-moyenne'
    if c > 0.35: return 'homme-rond'
    if m['morphologie'] == 'trapue' or mu > 0.15: return 'homme-trapu'
    if c < -0.15: return 'homme-mince'
    return 'homme-mince' if h % 2 else 'homme-trapu'

def coiffure(m, corps):
    t = m['traits']; coul = next((v for k, v in CHEVEUX.items() if k in t), '#3a2414')
    if 'bald head' in t: return {'type': 'chauve', 'couleur': coul}
    femme = m['macros']['silhouette'] < 0
    typ = 'queue' if 'ponytail' in t else 'chignon' if 'bun' in t else 'bob' if 'bob' in t else 'afro' if 'tight curly' in t else 'long' if (femme and ('long' in t or 'braided' in t or 'shoulder' in t)) else 'court'
    return {'type': typ, 'couleur': coul}

def vetements(m, corps):
    out = []
    for p in sorted(m['tenuePieces'], key=lambda q: CAT.get(q['piece'], {}).get('couche', 9)):   # intérieur d'abord : le manteau est confiné autour de la chemise
        cat = CAT.get(p['piece'])
        if not cat: continue
        if AMPLE and cat.get('ample'): e_type, extra = cat['ample']['type'], {k: v for k, v in cat['ample'].items() if k != 'type'}
        else: e_type, extra = cat['blender']['type'], {}
        e = {'type': e_type, 'couleur': p['couleurs']['corps'], **extra}
        if e_type == 'chapeau_paille': e['ruban'] = p['couleurs'].get('ruban', '#355070'); e['couleur'] = '#d8c28a'
        if p.get('matiere') in MATIERES:
            f, tint, tuile = MATIERES[p['matiere']]; e.update({'matiere': str(M / f'{f}.png'), 'teintable': tint, 'tuile': tuile})
        out.append(e)
    a = m.get('attitude', '')
    for mot, acc in (('camera', {'type': 'appareil_photo', 'couleur': '#2a2a2e'}), ('backpack', {'type': 'sac_a_dos', 'couleur': '#b85a3a'}), ('beach bag', {'type': 'sac_fourre_tout', 'couleur': '#e8e0d0', 'anses': '#2a6fdb'}),
                     ('volleyball', {'type': 'ballon', 'couleur': '#f4f1ea'}), ('cocktail', {'type': 'verre'}), ('champagne', {'type': 'verre'}), ('holding a drink', {'type': 'verre'}), ('selfie', {'type': 'telephone'}), ('smartphone', {'type': 'telephone'}), ('sunglasses', {'type': 'lunettes', 'couleur': '#1a1a1d'})):
        if mot in a: out.append(acc)
    if 'glasses' in m['traits'] and not any(x['type'] == 'lunettes' for x in out): out.append({'type': 'lunettes', 'couleur': '#2a2a2e'})
    return out

def pose(m):
    a = m.get('attitude', '')
    if 'cocktail' in a or 'champagne' in a or 'holding a drink' in a: return 'verre'
    if 'selfie' in a or 'smartphone' in a: return 'selfie'
    if 'dancing' in a: return 'danse'
    if 'waving' in a: return 'salut'
    h = int(hashlib.md5(json.dumps(m['tenuePieces']).encode()).hexdigest(), 16)
    return 'hanches' if (h % 3 == 0 and not m.get('enfant')) else 'repos'

def expression(m):
    a = m.get('attitude', '')
    return 'rire' if 'laugh' in a else 'grand_sourire' if 'cheerful' in a or 'grinning' in a or 'dancing' in a else 'sourire'

def run(c): r = subprocess.run(c, capture_output=True, text=True); return r.stdout + r.stderr

def rendre(m, tag):
    cid = choisir_corps(m); c = reg[cid]; d = travail / tag; d.mkdir(parents=True)
    tex = d / 'tex.png'; ch = coiffure(m, cid)
    run([sys.executable, str(ici / 'recolorer_texture.py'), str(racine / f'prototype/public/corps/{cid}/texture.png'), str(tex), '--peau', m['teint'], '--haut', m['teint'], '--cheveux', ch['couleur'],
         '--masque-cheveux', str(racine / f'prototype/public/corps/{cid}/masque-cheveux.json')])
    (d / 'vet.json').write_text(json.dumps(vetements(m, cid)))
    ch['peau'] = m['teint']
    o = run([blender, '--background', '--python', str(ici / 'rendre_modulaire.py'), '--', '--glb', c['rig'], '--texture', str(tex), '--vetements', str(d / 'vet.json'), '--coiffure', json.dumps(ch),
             '--expression', expression(m), '--pose', pose(m), '--visage-reperes', json.dumps(c['visage']), '--out', str(d / 'r'), '--dirs-liste', '0', '--pas', '100', '--res', '768', '--prefixe', 'm',
             '--echelle', str(c.get('echelle', 1.0)), '--cadrage', '2.0', '--style', 'jeu', '--tilt', '10'])
    run([sys.executable, str(ici / 'finition_style.py'), str(d / 'r'), str(d / 'f'), '--dossier', '--res', '768'])
    fs = sorted(glob.glob(str(d / 'f' / '*.png')))
    if not fs: raise RuntimeError(f'rendu absent pour {tag} ({cid}) :\n' + o[-600:])
    return Image.open(fs[0]).convert('RGBA'), cid, ch, vetements(m, cid)

def recadrer(img, boite=225, S=256, sol_px=247):
    bb = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox(); im = img.crop(bb)
    k = min(boite / im.height, boite / im.width); im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.alpha_composite(im, ((S - im.width) // 2, sol_px - im.height)); return out

journal = []
for it in lot['items']:
    if seul and it['index'] not in seul: continue
    membres = it['recette'].get('membres') or [it['recette']]
    rendus = []
    for k, m in enumerate(membres):
        img, cid, ch, vet = rendre(m, f"{it['index']}-{k}")
        rendus.append(img); journal.append({'index': it['index'], 'membre': k, 'corps': cid, 'coiffure': ch, 'expression': expression(m), 'pose': pose(m), 'pieces': [v['type'] for v in vet]})
        print(it['index'], k, cid, ch['type'], pose(m), [v['type'] for v in vet], flush=True)
    if len(rendus) == 1: final = rendus[0]
    else:  # groupe : côte à côte à la MÊME échelle (cadrage commun), léger recouvrement
        boites = [r.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox() for r in rendus]
        rec = [r.crop(b) for r, b in zip(rendus, boites)]
        W = sum(r.width for r in rec) - int(0.12 * rec[0].width) * (len(rec) - 1); H = max(r.height for r in rec)
        grp = Image.new('RGBA', (W, H), (0, 0, 0, 0)); x = 0
        for r in rec:
            grp.alpha_composite(r, (x, H - r.height)); x += r.width - int(0.12 * rec[0].width)
        final = grp
    recadrer(final).save(sortie / f"{it['index']}.png")
(sortie / 'lot-3d.json').write_text(json.dumps({'segment': seg, 'graine': int(graine), 'items': journal}, indent=1, ensure_ascii=False))
print('sorties :', sortie)
