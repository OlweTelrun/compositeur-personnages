#!/usr/bin/env python3
"""Intègre un lot généré par generer_images : vérifie quelle image correspond à quel prompt, recadre, écrit lot-style.json, contrôle.

Usage : integrer_lot_style.py [--partiel] <segment> <lot.json de prompts_lot.mjs> <cle_generation> <cout_usd> <element_id> [<element_id> …]
--partiel : intègre seulement les prompts qui ont une image (les autres — échec ou refus du filtre de sécurité — sont listés, jamais relancés ici).
La correspondance se fait par le TEXTE du prompt stocké dans la bibliothèque (jamais par l'ordre de la liste : un échec relancé
par l'outil peut décaler les identifiants). Refuse tout le lot si un prompt n'a pas d'image. Écrase les sprites du même index.
"""
import glob, json, subprocess, sys
from pathlib import Path

racine = Path(__file__).resolve().parent.parent
biblio = Path('/Users/jeremy/Antigravity/bibliotheque')
argv = [a for a in sys.argv[1:] if a != '--partiel']
partiel = '--partiel' in sys.argv
if len(argv) < 5:
    sys.exit(__doc__)
segment, lot_json, cle, cout, *ids = argv
lot = json.loads(Path(lot_json).read_text())
par_prompt = {}
for eid in ids:
    e = json.loads((biblio / 'elements' / f'{eid}.json').read_text())
    par_prompt.setdefault(e['prompt'].split('\n\nStyle guide')[0].strip(), []).append(eid)
args, items, manquants = [], [], []
for it in lot['items']:
    candidats = par_prompt.get(it['prompt'].strip())
    if not candidats:
        manquants.append(it['index']); continue
    eid = candidats[-1]  # si l'outil a régénéré une image, la plus récente
    fichier = glob.glob(str(biblio / 'fichiers' / 'image' / '*' / f'{eid}-*.png'))[0]
    args.append(f'{it["index"]}={fichier}')
    items.append({'index': it['index'], 'element_id': eid, 'prompt': it['prompt'], 'recette': it['recette']})
if manquants and not partiel:
    sys.exit(f'ABANDON : aucune image pour les index {manquants} (prompts non retrouvés parmi les identifiants donnés ; --partiel pour intégrer le reste)')
if manquants:
    print(f'sans image (non intégrés) : index {manquants}')
if not items:
    sys.exit('aucune image à intégrer')
subprocess.run([sys.executable, str(racine / 'outils' / 'cadrer_sprites.py'), segment, '--ecraser', *args], check=True)
dest = racine / 'prototype' / 'sortie' / segment
(dest / 'lot-style.json').write_text(json.dumps({'segment': segment, 'graine': lot['graine'], 'style': lot['style'], 'cle_generation': cle,
    'cout_usd': float(cout), 'sans_image': manquants, 'items': items}, indent=1, ensure_ascii=False))
r = subprocess.run([sys.executable, str(racine / 'outils' / 'controler_sprites.py'), segment, *[str(i['index']) for i in items]])
sys.exit(r.returncode)
