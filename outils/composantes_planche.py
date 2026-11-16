"""Repère les pièces d'une planche d'extraction (fond transparent) : composantes connexes de l'alpha.

Usage : python3 composantes_planche.py planche.png [seuil_alpha=20] [surface_min=200]

Affiche une ligne par pièce : rect [x0, y0, x1, y1[ (format du kit : fin exclue), surface en pixels et
couleur moyenne ; trié de haut en bas puis de gauche à droite. C'est la matière première pour écrire
une définition `visagesImage` du kit (rôle, échelle k, centre x,y restent à décider : spec §8 nonies).
"""
import sys
from collections import deque

from PIL import Image


def composantes(chemin: str, seuil: int = 20, surface_min: int = 200, pas: int = 2):
    im = Image.open(chemin).convert("RGBA")
    a = im.getchannel("A").point(lambda v: 255 if v > seuil else 0)
    px, w, h = a.load(), *im.size
    vu = bytearray(w * h)
    out = []
    for y in range(0, h, pas):
        for x in range(0, w, pas):
            if px[x, y] and not vu[y * w + x]:
                q = deque([(x, y)])
                vu[y * w + x] = 1
                x0 = x1 = x
                y0 = y1 = y
                n = 0
                while q:
                    cx, cy = q.popleft()
                    n += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for dx, dy in ((pas, 0), (-pas, 0), (0, pas), (0, -pas)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not vu[ny * w + nx]:
                            vu[ny * w + nx] = 1
                            q.append((nx, ny))
                if n * pas * pas >= surface_min:
                    out.append((x0, y0, x1 + 1, y1 + 1, n * pas * pas))
    return sorted(out, key=lambda t: (t[1] // 150, t[0]))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    for r in composantes(sys.argv[1], *(int(v) for v in sys.argv[2:4])):
        print(f"[{r[0]}, {r[1]}, {r[2]}, {r[3]}]  {r[2]-r[0]}x{r[3]-r[1]}  surface {r[4]}")
