#!/usr/bin/env python3
"""Extrait les calques de TOUTES les silhouettes déclarées dans outils/gabarits.json et écrit prototype/public/atelier3/pieces.json.

  python3 outils/gabarits_produire.py [silhouette ...]      # sans argument : toutes
Sortie : atelier3/corps/<silhouette>/{gabarit-natif.png, hauts|bas|chaussures/<k>.png + rapport.json}
"""
import sys, json, glob
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import gabarit_extraire as g

RACINE = Path(__file__).resolve().parent.parent
BIB = '/Users/jeremy/Antigravity/bibliotheque/fichiers/image/2026-11/'
SORTIE = RACINE / 'prototype' / 'public' / 'atelier3'
cfg = json.loads((RACINE / 'outils' / 'gabarits.json').read_text())
fichier = lambda eid: glob.glob(BIB + eid + '-*.png')[0]

for sil, d in cfg['silhouettes'].items():
    if len(sys.argv) > 1 and sil not in sys.argv[1:]: continue
    for cat, zone in (('hauts', 'haut'), ('bas', 'bas'), ('chaussures', None)):
        print(sil, cat, end=': ')
        g.main(fichier(d['gabarit']), fichier(d[cat]), 4, 2, cat, str(SORTIE / 'corps' / sil / cat), 'corps', 1.0, zone)

# catalogue : silhouettes, pièces (noms) et mesures utiles au placement des visages
pieces = {'silhouettes': {s: {'nom': d['nom'], 'genre': d['genre']} for s, d in cfg['silhouettes'].items()},
          'pieces': {'f': cfg['pieces']['f'], 'h': cfg['pieces']['h'], 'chaussures': cfg['pieces']['chaussures']}}
(SORTIE / 'pieces.json').write_text(json.dumps(pieces, ensure_ascii=False, indent=1))
print('catalogue écrit')
