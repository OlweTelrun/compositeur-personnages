"""Cale le sol d'un sprite sur la ligne du contrat du kit (97 % de la hauteur) et centre l'horizontale.

Usage : python3 normaliser_sol.py entree.png sortie.png [sol=0.97]

Utilisé après Normalisation3DV2D en mode « scale » (qui centre le modèle verticalement :
le sol y dépend de la stature). La taille n'est jamais modifiée, seulement la position.
"""
import sys

from PIL import Image


def normaliser(entree: str, sortie: str, sol: float = 0.97) -> dict:
    im = Image.open(entree).convert("RGBA")
    bb = im.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox()
    if bb is None:
        raise SystemExit("image vide")
    taille = im.size[1]
    dy = round(sol * taille) - bb[3]
    dx = round(im.size[0] / 2) - (bb[0] + bb[2]) // 2
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (dx, dy))  # canvas vide : le collage remplace aussi l'alpha
    out.save(sortie)
    return {"decalage_x": dx, "decalage_y": dy, "bas_avant": bb[3] / taille, "bas_apres": sol}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    print(normaliser(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 0.97))
