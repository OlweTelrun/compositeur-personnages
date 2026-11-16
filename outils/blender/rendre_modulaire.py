# Rend des sprites animés d'un corps riggé (GLB Meshy) avec : animation d'un autre GLB (même squelette), texture de remplacement,
# décalque de visage projeté (facultatif). Caméra orthographique isométrique, sujet qui tourne, fond transparent.
# Usage : Blender --background --python rendre_modulaire.py -- --glb corps.glb --anim marche.glb --out dossier
#         [--texture albedo.png] [--decal visage.png --decal-box x0,x1,z0,z1] [--dirs 8] [--pas 3] [--res 256] [--tilt 30] [--marge 1.12] [--dirs-liste 1,5]
import bpy, bmesh, sys, os, math, argparse, json
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
p = argparse.ArgumentParser()
p.add_argument('--glb', required=True); p.add_argument('--anim'); p.add_argument('--out', required=True)
p.add_argument('--texture'); p.add_argument('--decal'); p.add_argument('--decal-box', default='')
p.add_argument('--dirs', type=int, default=8); p.add_argument('--dirs-liste', default='')
p.add_argument('--pas', type=int, default=3); p.add_argument('--res', type=int, default=256)
p.add_argument('--tilt', type=float, default=30); p.add_argument('--marge', type=float, default=1.12)
p.add_argument('--visage', help='PNG RGBA de visage_decal.py'); p.add_argument('--focus-tete', action='store_true', help='cadre la tête (gros plan)')
p.add_argument('--vetements', help='JSON : liste de {type, couleur, matiere?, teintable?, tuile?}')
p.add_argument('--echelle', type=float, default=1.0, help='échelle du personnage (Meshy normalise tous les corps à ~1,70 m : un enfant doit être réduit)')
p.add_argument('--mesure-jupe', action='store_true', help='mesure (sans rendre) la part des sommets de jambe qui percent la jupe, image par image')
p.add_argument('--mesure-percee', action='store_true', help='mesure (sans rendre) la part des sommets de peau, de bassin et de jambe qui percent la tunique, image par image, avec la bande de hauteur')
p.add_argument('--style', default='base', choices=['base', 'jeu'], help="'jeu' : éclairage à 3 sources (clé chaude, remplissage froid, contre-jour), matériaux brillants, anti-crénelage renforcé")
p.add_argument('--coiffure', help='JSON : {type, couleur, peau?, ...} ; masque les cheveux d\'origine et pose une coiffure séparée')
p.add_argument('--expression', help="nom (neutre|sourire|grand_sourire|rire|surpris|colere|triste|clin_d_oeil) ou JSON {sourire, ouverture, sourcils_int, sourcils_ext, oeil_g, oeil_d}")
p.add_argument('--visage-reperes', help='JSON {z_bouche, z_oeil} en mètres absolus : prime sur la détection par texture')
p.add_argument('--pose', default='', help='repos|hanches|salut|danse|verre|selfie : pose des bras (os), sans animation')
p.add_argument('--prefixe', default='f'); p.add_argument('--cadrage', type=float, default=0)
a = p.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=a.glb)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
corps = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.vertex_groups) > 0]
for o in list(bpy.data.objects):  # objets parasites (Meshy exporte une icosphère)
    if o.type == 'MESH' and o not in corps:
        bpy.data.objects.remove(o, do_unlink=True)


# --- expressions : déformation du MAILLAGE du visage (la texture peinte suit les sommets) + superpositions de couleur (intérieur de bouche, paupières) ---
# Paramètres dans [-1, 1] ou [0, 1] : sourire (−1 = moue triste), ouverture (bouche), sourcils_int / sourcils_ext (+ = relevés), oeil_g / oeil_d (0 = ouvert, 1 = fermé).
EXPRESSIONS = {
    'neutre':       {},
    'sourire':      {'sourire': 0.9},
    'grand_sourire': {'sourire': 1.0, 'ouverture': 0.35, 'sourcils_ext': 0.2},
    'rire':         {'sourire': 1.0, 'ouverture': 0.9, 'oeil_g': 0.7, 'oeil_d': 0.7, 'sourcils_ext': 0.3},
    'surpris':      {'ouverture': 0.8, 'sourcils_int': 1.0, 'sourcils_ext': 1.0},
    'colere':       {'sourire': -0.5, 'sourcils_int': -1.0, 'sourcils_ext': 0.2},
    'triste':       {'sourire': -0.6, 'sourcils_int': 0.9, 'sourcils_ext': -0.4},
    'clin_d_oeil':  {'sourire': 0.8, 'oeil_g': 1.0, 'sourcils_ext': 0.2},
}
def parametres_expression(texte):
    if not texte: return {}
    try: return json.loads(texte)
    except Exception: return dict(EXPRESSIONS[texte])

_repere_cache = {}
def repere_visage(corps0):
    """Repères du visage DE CE CORPS : bouche (centroïde des texels de lèvres), yeux (sclères blanches) lus dans la texture courante ; à défaut, proportions
    de la tête. Les proportions fixes ne conviennent pas à tous (enfant, seniors : la bouche ouverte tombait au niveau du nez ou des sourcils)."""
    import numpy as np
    if id(corps0) in _repere_cache: return _repere_cache[id(corps0)]
    h = mesures_tete(corps0); Hh = h['Hh']; me = corps0.data; mw = corps0.matrix_world; noms = [vg.name for vg in corps0.vertex_groups]; TETE = {'Head', 'head_end', 'headfront'}
    R = {'h': h, 'cx': h['cx'], 'z_bouche': h['z0'] + 0.22 * Hh, 'z_oeil': h['z0'] + 0.44 * Hh, 'x_bouche': 0.16 * Hh, 'x_oeil': 0.17 * Hh, 'Hh': Hh, 'source': 'proportions'}
    try:
        nv = len(me.vertices); pos = np.array([tuple(mw @ v.co) for v in me.vertices])
        dt = np.array([bool(len(v.groups)) and noms[max(v.groups, key=lambda x: x.weight).group] in TETE for v in me.vertices])
        img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
        w, hh = img.size; buf = np.empty(w * hh * 4, np.float32); img.pixels.foreach_get(buf); buf = buf.reshape(hh, w, 4)
        nl = len(me.loops); lv = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', lv); uvs = np.empty(nl * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uvs); uvs = uvs.reshape(nl, 2)
        uv = np.zeros((nv, 2), np.float32); uv[lv] = uvs
        tex = buf[np.clip((uv[:, 1] * hh).astype(int), 0, hh - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1), :3]
        r, g, b = tex[:, 0], tex[:, 1], tex[:, 2]; mx = tex.max(1); mn = tex.min(1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
        face = dt & (pos[:, 1] < h['cy'] - 0.10 * h['D']) & (np.abs(pos[:, 0] - h['cx']) < 0.42 * h['W']) & (pos[:, 2] >= h['z0'] - 0.02) & (pos[:, 2] <= h['z1'] - 0.18 * Hh)
        levre = face & (r > g + 0.14) & (r > b + 0.10) & (sat > 0.42) & (mx < 0.9) & (pos[:, 2] < h['z0'] + 0.45 * Hh)
        blanc = face & (sat < 0.15) & (mx > 0.82)
        if levre.sum() >= 15:
            R['z_bouche'] = float(np.median(pos[levre, 2])); R['cx'] = float(np.median(pos[levre, 0]))
            R['x_bouche'] = float(np.clip(0.45 * (pos[levre, 0].max() - pos[levre, 0].min()), 0.10 * Hh, 0.22 * Hh)); R['source'] = 'texture'
        gch, drt = blanc & (pos[:, 0] > R['cx']), blanc & (pos[:, 0] <= R['cx'])
        if gch.sum() >= 6 and drt.sum() >= 6 and R['source'] == 'texture':
            ze = float((np.median(pos[gch, 2]) + np.median(pos[drt, 2])) / 2)
            if ze > R['z_bouche'] + 0.10 * Hh:   # cohérent (yeux nettement au-dessus de la bouche)
                R['z_oeil'] = ze; R['x_oeil'] = float(np.clip((np.median(pos[gch, 0]) - np.median(pos[drt, 0])) / 2, 0.10 * Hh, 0.26 * Hh)); R['source'] = 'texture (bouche + yeux)'
            else: R['z_oeil'] = R['z_bouche'] + 0.22 * Hh
        elif R['source'] == 'texture': R['z_oeil'] = R['z_bouche'] + 0.22 * Hh
    except Exception as e:
        print('REPERES: détection impossible, proportions utilisées :', e)
    if a.visage_reperes:
        o = json.loads(a.visage_reperes); R['z_bouche'] = o['z_bouche']; R['z_oeil'] = o['z_oeil']; R['source'] = 'registre (mesuré à la règle)'
    R['z_sourcil'] = R['z_oeil'] + 0.14 * Hh
    print(f"REPERES visage ({R['source']}): bouche z={(R['z_bouche']-h['z0'])/Hh:.2f}, yeux z={(R['z_oeil']-h['z0'])/Hh:.2f} (en hauteurs de tête depuis le menton)")
    _repere_cache[id(corps0)] = R
    return R

def deformer_expression(corps0, prm):
    """Déplace les sommets de la face avant (en repère de repos) : sourire, mâchoire, sourcils. Les superpositions viennent après (superposer_expression)."""
    import numpy as np
    if not prm: return
    me = corps0.data; mw = corps0.matrix_world; noms = [vg.name for vg in corps0.vertex_groups]; TETE = {'Head', 'head_end', 'headfront'}
    R = repere_visage(corps0); h = R['h']; Hh = R['Hh']; cx = R['cx']
    pos = np.array([tuple(mw @ v.co) for v in me.vertices])
    dt = np.array([bool(len(v.groups)) and noms[max(v.groups, key=lambda x: x.weight).group] in TETE for v in me.vertices])
    avant = dt & (pos[:, 1] < h['cy'] - 0.02 * h['D']) & (pos[:, 2] >= min(h['z0'], R['z_bouche'] - 0.14 * Hh) - 0.03) & (pos[:, 2] <= h['z1'] - 0.12 * Hh)
    gauss = lambda x, z, x0, z0, sx, sz: np.exp(-0.5 * (((x - x0) / sx) ** 2 + ((z - z0) / sz) ** 2))
    x = pos[:, 0] - cx; z = pos[:, 2]
    d = np.zeros((len(pos), 3))
    s = prm.get('sourire', 0.0); o = prm.get('ouverture', 0.0)
    if s:
        for sg in (-1, 1):
            g = gauss(x, z, sg * R['x_bouche'], R['z_bouche'], 0.095 * Hh, 0.075 * Hh)
            d[:, 2] += 0.105 * Hh * s * g; d[:, 0] += sg * 0.060 * Hh * s * g; d[:, 1] += 0.020 * Hh * s * g     # coins de la bouche : en haut, vers l'extérieur, un peu en arrière
            gj = gauss(x, z, sg * 0.26 * Hh, R['z_bouche'] + 0.13 * Hh, 0.10 * Hh, 0.07 * Hh)
            d[:, 2] += 0.045 * Hh * max(s, 0) * gj                                                               # pommettes relevées
    if o:
        # mâchoire : tout ce qui est sous la bouche descend, avec une transition douce vers le haut ; resserré horizontalement par une gaussienne
        bas = 1.0 / (1.0 + np.exp((z - (R['z_bouche'] + 0.01 * Hh)) / (0.018 * Hh)))
        lat = np.exp(-0.5 * (x / (0.26 * Hh)) ** 2)
        d[:, 2] -= 0.15 * Hh * o * bas * lat
    bi = prm.get('sourcils_int', 0.0); be = prm.get('sourcils_ext', 0.0)
    for sg in (-1, 1):
        if bi: d[:, 2] += 0.045 * Hh * bi * gauss(x, z, sg * 0.09 * Hh, R['z_sourcil'], 0.08 * Hh, 0.05 * Hh)
        if be: d[:, 2] += 0.045 * Hh * be * gauss(x, z, sg * 0.24 * Hh, R['z_sourcil'] - 0.01 * Hh, 0.08 * Hh, 0.05 * Hh)
    d *= avant[:, None]
    n = 0
    inv = mw.inverted().to_3x3()
    for i, v in enumerate(me.vertices):
        if avant[i] and (d[i] != 0).any():
            v.co = v.co + inv @ Vector(d[i]); n += 1
    me.update()
    print(f'EXPRESSION: {prm} → {n} sommets déplacés')

def couche_couleur(corps0, nom_attr, valeurs, couleur, lo=0.45, hi=0.7):
    """Superpose une couleur unie où l'attribut de sommet `nom_attr` (0..1, interpolé) dépasse un seuil : ellipse lisse (intérieur de bouche, paupière)."""
    me = corps0.data
    if nom_attr in me.color_attributes: me.color_attributes.remove(me.color_attributes[nom_attr])
    ca = me.color_attributes.new(nom_attr, 'FLOAT_COLOR', 'POINT')
    for i, m in enumerate(valeurs): ca.data[i].color = (float(m), float(m), float(m), 1)
    nt = me.materials[0].node_tree; bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    lien = next(l for l in nt.links if l.to_socket == bs.inputs['Base Color'])
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = nom_attr; at.attribute_type = 'GEOMETRY'
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'; mr.inputs['From Min'].default_value = lo; mr.inputs['From Max'].default_value = hi
    nt.links.new(at.outputs['Fac'], mr.inputs['Value'])
    rgb = nt.nodes.new('ShaderNodeRGB'); c = [int(couleur[i:i + 2], 16) / 255 for i in (1, 3, 5)]; lin = lambda x: ((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92
    rgb.outputs[0].default_value = (lin(c[0]), lin(c[1]), lin(c[2]), 1)
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(lien.from_socket, mix.inputs['A']); nt.links.new(rgb.outputs[0], mix.inputs['B']); nt.links.new(mr.outputs['Result'], mix.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], bs.inputs['Base Color'])

def peau_du_visage(corps0):
    """Teint réel du visage : médiane des texels de peau (teinte chaude, saturée) sous les sommets de la face avant, lus dans l'image COURANTE du matériau (donc après recoloration)."""
    import numpy as np
    me = corps0.data; mw = corps0.matrix_world; R = repere_visage(corps0); h = R['h']
    nt = me.materials[0].node_tree
    img = next(n.image for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.name != '')
    w, hh = img.size; buf = np.empty(w * hh * 4, np.float32); img.pixels.foreach_get(buf); buf = buf.reshape(hh, w, 4)
    nl = len(me.loops); lv = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', lv); uvs = np.empty(nl * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uvs); uvs = uvs.reshape(nl, 2)
    uv = np.zeros((len(me.vertices), 2), np.float32); uv[lv] = uvs
    pos = np.array([tuple(mw @ v.co) for v in me.vertices])
    sel = (pos[:, 1] < h['cy'] - 0.05 * h['D']) & (pos[:, 2] > h['z0']) & (pos[:, 2] < h['z0'] + 0.40 * h['Hh']) & (np.abs(pos[:, 0] - h['cx']) < 0.35 * h['Hh'])
    tex = buf[np.clip((uv[sel, 1] * hh).astype(int), 0, hh - 1), np.clip((uv[sel, 0] * w).astype(int), 0, w - 1), :3]
    mx, mn = tex.max(1), tex.min(1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    ok = (sat > 0.2) & (mx > 0.4)
    m = np.median(tex[ok] if ok.sum() > 5 else tex, axis=0)
    return '#%02x%02x%02x' % tuple(int(max(0, min(1, float(c))) * 255) for c in m)   # img.pixels d'une image 8 bits est DÉJÀ encodé en sRGB : pas de conversion (essai : une conversion donnait des paupières blanches)

def superposer_expression(corps0, prm, peau):
    import numpy as np
    peau = peau or peau_du_visage(corps0)
    me = corps0.data; mw = corps0.matrix_world
    R = repere_visage(corps0); Hh = R['Hh']; cx = R['cx']
    pos = np.array([tuple(mw @ v.co) for v in me.vertices])
    gauss = lambda x, z, x0, z0, sx, sz: np.exp(-0.5 * (((x - x0) / sx) ** 2 + ((z - z0) / sz) ** 2))
    x = pos[:, 0] - cx; z = pos[:, 2]
    avant = pos[:, 1] < R['h']['cy'] - 0.02 * R['h']['D']
    o = prm.get('ouverture', 0.0)
    if o > 0.15:  # intérieur de bouche : ellipse sombre centrée sur la bouche, qui s'agrandit avec l'ouverture (la mâchoire s'est déplacée : on suit son centre)
        zc = R['z_bouche'] - 0.07 * Hh * o
        m = gauss(x, z, 0.0, zc, (0.10 + 0.04 * o) * Hh, (0.020 + 0.075 * o) * Hh) * avant
        couche_couleur(corps0, 'bouche_int', m, '#3a0f14', 0.32, 0.60)
        if o > 0.5:  # dents du haut : bande claire au sommet de l'ouverture
            zd = zc + 0.55 * (0.020 + 0.075 * o) * Hh
            md = gauss(x, z, 0.0, zd, (0.085 + 0.03 * o) * Hh, 0.016 * Hh) * avant
            couche_couleur(corps0, 'bouche_dents', md, '#f2ece0', 0.45, 0.70)
    for sg, cle in ((1, 'oeil_g'), (-1, 'oeil_d')):
        e = prm.get(cle, 0.0)
        if e > 0.15:  # paupière : couleur de peau sur l'œil peint, puis trait de cils plus sombre en bas
            m = gauss(x, z, sg * R['x_oeil'], R['z_oeil'], 0.085 * Hh, 0.050 * Hh) * avant
            couche_couleur(corps0, f'paupiere_{cle}', m, peau, 0.30, 0.55)
            m2 = gauss(x, z, sg * R['x_oeil'], R['z_oeil'] - 0.030 * Hh, 0.080 * Hh, 0.010 * Hh) * avant
            couche_couleur(corps0, f'cils_{cle}', m2, '#2a1810', 0.40, 0.65)


# --- cheveux d'origine : masque par sommet (géométrie + couleur de la texture d'origine), calculé avant tout remplacement de texture ---
def masque_cheveux_origine(corps0):
    import numpy as np
    me = corps0.data; mw = corps0.matrix_world; noms = [vg.name for vg in corps0.vertex_groups]; TETE = {'Head', 'head_end', 'headfront'}
    nv = len(me.vertices)
    pos = np.array([tuple(mw @ v.co) for v in me.vertices])
    dom_tete = np.array([bool(len(v.groups)) and noms[max(v.groups, key=lambda x: x.weight).group] in TETE for v in me.vertices])
    img = bpy.data.images['Image_0']; w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(buf); buf = buf.reshape(h, w, 4)
    nl = len(me.loops); lv = np.empty(nl, dtype=np.int32); me.loops.foreach_get('vertex_index', lv)
    uvs = np.empty(nl * 2, dtype=np.float32); me.uv_layers.active.data.foreach_get('uv', uvs); uvs = uvs.reshape(nl, 2)
    uv = np.zeros((nv, 2), dtype=np.float32); uv[lv] = uvs
    tex = buf[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1), :3]
    mx, mn = tex.max(1), tex.min(1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    sombre = mx < 0.30; clair = (sat < 0.18) & (mx > 0.55)
    zt = pos[dom_tete, 2].max(); H = pos[:, 2].max() - pos[:, 2].min(); Hh = 0.14 * H; z0 = zt - Hh
    P = pos[dom_tete & (pos[:, 2] >= z0)]; cx = (P[:, 0].min() + P[:, 0].max()) / 2; cy = (P[:, 1].min() + P[:, 1].max()) / 2
    Wd = P[:, 0].max() - P[:, 0].min(); Dd = P[:, 1].max() - P[:, 1].min()
    haut = dom_tete & (pos[:, 2] >= zt - 0.40 * Hh)                       # dessus de la tête, au-dessus des yeux
    visage = (pos[:, 1] < cy - 0.12 * Dd) & (np.abs(pos[:, 0] - cx) < 0.42 * Wd) & (pos[:, 2] >= z0 - 0.02)   # face avant : yeux, sourcils, bouche (sombres) à ne pas toucher
    epaules = max(pos[:, 2][dom_tete]) - 1.0 * Hh   # sous la tête : les longs cheveux retombent jusqu'au milieu du dos
    zone_tete = dom_tete & (pos[:, 2] < zt - 0.40 * Hh) & ~visage
    cote = zone_tete & (sombre | clair)                                      # nuque, côtés, mèches claires ou sombres
    pend = (~dom_tete) & (mx < 0.42) & (pos[:, 2] >= 0.62 * H) & (pos[:, 2] < zt)  # cheveux longs ou queue retombant sur les épaules/le dos (sombres ; le sous-vêtement est gris)
    m = (haut | cote | pend).astype(np.float32)
    print(f'CHEVEUX_ORIGINE: {int(m.sum())} sommets masqués (haut {int(haut.sum())}, côtés/nuque {int(cote.sum())}, retombants {int(pend.sum())})')
    return m


# --- poses : rotation des os des bras vers des directions cibles (repère du monde ; le personnage regarde vers −Y, son bras « Left » est du côté +X) ---
POSES = {
    'repos':   {'LeftArm': (0.20, 0, -1), 'LeftForeArm': (0.12, -0.10, -1), 'RightArm': (-0.20, 0, -1), 'RightForeArm': (-0.12, -0.10, -1)},
    'hanches': {'LeftArm': (0.80, 0.05, -0.60), 'LeftForeArm': (-0.55, -0.15, -0.80), 'RightArm': (-0.80, 0.05, -0.60), 'RightForeArm': (0.55, -0.15, -0.80)},
    'salut':   {'LeftArm': (0.80, 0.0, 0.50), 'LeftForeArm': (0.35, 0.0, 0.95), 'RightArm': (-0.20, 0, -1), 'RightForeArm': (-0.12, -0.10, -1)},
    'danse':   {'LeftArm': (0.70, -0.15, 0.70), 'LeftForeArm': (0.20, -0.30, 0.95), 'RightArm': (-0.90, -0.10, 0.35), 'RightForeArm': (-0.50, -0.20, 0.85)},
    'verre':   {'LeftArm': (0.20, 0, -1), 'LeftForeArm': (0.12, -0.10, -1), 'RightArm': (-0.45, -0.55, -0.70), 'RightForeArm': (-0.10, -0.35, 0.95)},
    'selfie':  {'LeftArm': (0.20, 0, -1), 'LeftForeArm': (0.12, -0.10, -1), 'RightArm': (-0.30, -0.85, 0.35), 'RightForeArm': (-0.05, -0.50, 0.85)},
}
ENFANT_POSE = {'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand'}
def appliquer_pose(arm, nom):
    """Chaque os de bras est tourné pour que le segment (tête de l'os → tête de son enfant) pointe vers la direction cible. Ordre parent d'abord ; les mains suivent leur avant-bras."""
    if not nom or nom not in POSES: return
    from mathutils import Matrix
    if arm.animation_data:  # l'action « baselayer » du fichier Meshy réécrit les os à chaque image : on la détache pour que la pose tienne
        arm.animation_data.action = None
    for bn in ('LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm'):
        bpy.context.view_layer.update()
        pb = arm.pose.bones[bn]; enfant = arm.pose.bones[ENFANT_POSE[bn]]
        d0 = (enfant.head - pb.head).normalized(); t = Vector(POSES[nom][bn]).normalized()
        q = d0.rotation_difference(t)
        m = pb.matrix; m3 = m.to_3x3()
        pb.matrix = Matrix.Translation(m.translation) @ (q.to_matrix() @ m3).to_4x4()
    bpy.context.view_layer.update()
    print(f'POSE: {nom}')

_masque_origine = None
if a.coiffure:
    _masque_origine = masque_cheveux_origine(corps[0])
_expr = parametres_expression(a.expression)

# --- texture de remplacement (même UV : c'est la même géométrie) : on charge l'image et on la branche à la place de l'originale ---
def remplacer_image(nom_ancienne, chemin):
    neuve = bpy.data.images.load(chemin)
    neuve.colorspace_settings.name = bpy.data.images[nom_ancienne].colorspace_settings.name
    n = 0
    for mat in bpy.data.materials:
        if mat.use_nodes:
            for noeud in mat.node_tree.nodes:
                if noeud.type == 'TEX_IMAGE' and noeud.image and noeud.image.name == nom_ancienne:
                    noeud.image = neuve; n += 1
    print(f'TEXTURE: {n} noeud(s) remplacé(s) par {os.path.basename(chemin)}')
    return neuve
if a.texture:
    remplacer_image('Image_0', a.texture)


# --- vêtements : coques dérivées du corps (mêmes poids de peau → même squelette, même animation) ---
# Les règles sont RELATIVES aux os du squelette (même squelette Meshy pour tous les corps) : elles valent donc pour toute silhouette.
TORSE = {'Hips', 'Spine', 'Spine01', 'Spine02'}
EPAULES_BRAS = {'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'}
CUISSES, MOLLETS = {'LeftUpLeg', 'RightUpLeg'}, {'LeftLeg', 'RightLeg'}
def reperes(arm, corps0):
    tete = lambda n: (arm.matrix_world @ arm.data.bones[n].head_local).z
    zs = [(corps0.matrix_world @ v.co).z for v in corps0.data.vertices]
    H = max(zs) - min(zs)
    pos = lambda n: arm.matrix_world @ arm.data.bones[n].head_local
    return {'H': H, 'hanches': tete('Hips'), 'genou': tete('LeftLeg'), 'cheville': tete('LeftFoot'), 'epaules': tete('LeftShoulder'), 'sol': min(zs),
            'epauleLeft': pos('LeftArm'), 'coudeLeft': pos('LeftForeArm'), 'epauleRight': pos('RightArm'), 'coudeRight': pos('RightForeArm')}
# Chaque type : (prédicat(groupe dominant, point monde, repères), décalage en fraction de la taille H)
AVANT_BRAS = {'LeftForeArm', 'RightForeArm'}
def _t_shirt(g, p, r, sp):
    if g in TORSE:
        return p.z >= r['hanches'] - sp.get('ourlet', 0.35) * (r['hanches'] - r['genou'])  # ourlet : fraction hanches → genou sous les hanches
    if g in {'neck', 'headfront', 'Head', 'head_end'}:  # haut du torse / décolleté pesé sur un os de tête (corps ronds) : couvert sous la base du cou
        return p.z <= r['epaules'] - sp.get('encolure', 0.01) * r['H']  # encolure : profondeur sous la base du cou (fraction de H)
    if g in CUISSES:  # plis du ventre / flancs rattachés à l'os de la cuisse mais au-dessus des hanches : le t-shirt les couvre
        return p.z >= r['hanches'] - 0.02 * r['H']
    if g in EPAULES_BRAS or g in AVANT_BRAS:
        cote = 'Left' if g.startswith('Left') else 'Right'
        S, E = r['epaule' + cote], r['coude' + cote]; axe = E - S
        t = (p - S).dot(axe) / max(axe.length_squared, 1e-9)  # 0 = épaule, 1 = coude, ~2 = poignet
        return t <= sp.get('manches', 0.55)  # longueur de manche en fraction « épaule → coude » : mesurée le long du bras, donc indépendante des limites d'os du corps
    return False
# Variantes = mêmes règles, autres paramètres (PIÈCES du catalogue) :
#   debardeur : pas de manches, encolure profonde ; chemise : manches longues, ourlet plus bas ; pull : manches longues ; bermuda : short long (genou).
DEFAUTS_TYPE = {
    'debardeur': {'manches': 0.0, 'encolure': 0.05, 'ourlet': 0.30},
    'chemise':   {'manches': 1.9, 'ourlet': 0.50},
    'pull':      {'manches': 1.9, 'ourlet': 0.40},
    'bermuda':   {'longueur': 0.95},
    # vêtements amples longs : même tube que la tunique, ourlet plus bas ; le manteau est ouvert devant (`ouverture` = angle total en degrés)
    'robe':      {'ourlet': 0.95, 'evasement': 0.10, 'manches': 0.0},   # sans manches : de courtes manches évasées ressortent en « cornes »
    'manteau':   {'ourlet': 1.05, 'evasement': 0.05, 'manches': 0.95, 'ouverture': 26, 'marge': 0.03},   # marge plus forte : sinon le manteau et la chemise dessous se disputent les pixels
}
TYPES = {
    'tshirt':   (_t_shirt, 0.017),
    'debardeur': (_t_shirt, 0.017), 'chemise': (_t_shirt, 0.017), 'pull': (_t_shirt, 0.017),
    'shorts':   (lambda g, p, r, sp: (g == 'Hips' or g in CUISSES) and r['hanches'] + 0.03 * r['H'] >= p.z >= r['hanches'] - sp.get('longueur', 0.55) * (r['hanches'] - r['genou']), 0.017),
    'bermuda': (lambda g, p, r, sp: (g == 'Hips' or g in CUISSES) and r['hanches'] + 0.03 * r['H'] >= p.z >= r['hanches'] - sp.get('longueur', 0.95) * (r['hanches'] - r['genou']), 0.017),
    'pantalon': (lambda g, p, r, sp: (g == 'Hips' or g in CUISSES or g in MOLLETS) and r['hanches'] + 0.03 * r['H'] >= p.z >= r['cheville'] + 0.02 * r['H'], 0.014),
}

def noeuds_couleur(nt, spec, nom_uv):
    """Construit dans l'arbre `nt` les noeuds donnant la COULEUR d'un vêtement (couleur unie, matière, matière teintée) et retourne le socle de sortie."""
    hexc = spec.get('couleur', '#cccccc'); col = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = lambda c: ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
    rgba = (lin(col[0]), lin(col[1]), lin(col[2]), 1)
    if not spec.get('matiere'):
        rgb = nt.nodes.new('ShaderNodeRGB'); rgb.outputs[0].default_value = rgba; return rgb.outputs[0]
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(spec['matiere']); tex.extension = 'REPEAT'
    mp = nt.nodes.new('ShaderNodeMapping'); t = 1.0 / spec.get('tuile', 0.25)
    mp.inputs['Scale'].default_value = (t, t, 1)
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = nom_uv
    nt.links.new(uvn.outputs['UV'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
    if not spec.get('teintable', True):
        return tex.outputs['Color']
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0; mix.inputs['B'].default_value = rgba
    nt.links.new(tex.outputs['Color'], mix.inputs['A']); return mix.outputs['Result']

def fabriquer_materiau(spec, nom_uv):
    mat = bpy.data.materials.new('mat_' + spec['type']); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.75
    nt.links.new(noeuds_couleur(nt, spec, nom_uv), bsdf.inputs['Base Color'])
    return mat

def appliquer_peau(corps0, arm, specs):
    """Vêtements ajustés : les faces du corps concernées reçoivent un matériau de vêtement (UV cylindrique en mètres, calculée au repos).
    Aucun espace entre vêtement et peau ; les limites (ourlets, manches) viennent des os et des hauteurs relatives."""
    ref = reperes(arm, corps0); mw = corps0.matrix_world
    noms = [vg.name for vg in corps0.vertex_groups]
    bm = bmesh.new(); bm.from_mesh(corps0.data)
    deform = bm.verts.layers.deform.active
    def dom(v):
        w = v[deform]
        return noms[max(w.keys(), key=lambda k: w[k])] if len(w) else ''
    uv = bm.loops.layers.uv.get('UV_vet') or bm.loops.layers.uv.new('UV_vet')
    R = 0.28; cx, cy = 0.0, 0.06
    for f in bm.faces:
        us = [math.atan2((mw @ l.vert.co).y - cy, (mw @ l.vert.co).x - cx) * R for l in f.loops]
        base = us[0]
        for i, l in enumerate(f.loops):
            u = us[i]
            while u - base > math.pi * R: u -= 2 * math.pi * R
            while base - u > math.pi * R: u += 2 * math.pi * R
            l[uv].uv = (u, (mw @ l.vert.co).z)
    bm.to_mesh(corps0.data)
    # Masque par SOMMET (0/1) interpolé sur les triangles puis seuillé dans le shader : la limite du vêtement (ourlet, col, manche) est une courbe
    # lisse au lieu des dents de scie que donne la sélection de triangles entiers.
    me = corps0.data
    mat0 = me.materials[0]; nt = mat0.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    sortie = next(l for l in nt.links if l.to_socket == bsdf.inputs['Base Color']).from_socket
    for k, spec in enumerate(specs):
        pred = TYPES[spec['type']][0]
        nom = f'vet_{k}'
        if nom in me.color_attributes: me.color_attributes.remove(me.color_attributes[nom])
        ca = me.color_attributes.new(nom, 'FLOAT_COLOR', 'POINT')
        n = 0
        for v in bm.verts:
            m = 1.0 if pred(dom(v), mw @ v.co, ref, spec) else 0.0
            ca.data[v.index].color = (m, m, m, 1); n += int(m)
        att = nt.nodes.new('ShaderNodeAttribute'); att.attribute_name = nom; att.attribute_type = 'GEOMETRY'
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
        mr.inputs['From Min'].default_value = 0.42; mr.inputs['From Max'].default_value = 0.58
        nt.links.new(att.outputs['Fac'], mr.inputs['Value'])
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
        nt.links.new(sortie, mix.inputs['A']); nt.links.new(noeuds_couleur(nt, spec, 'UV_vet'), mix.inputs['B']); nt.links.new(mr.outputs['Result'], mix.inputs['Factor'])
        sortie = mix.outputs['Result']
        print(f"VETEMENT(peau):{spec['type']} {n} sommets (limite lisse)")
    nt.links.new(sortie, bsdf.inputs['Base Color'])
    if os.environ.get('DIAG_TROUS'):  # diagnostic : faces du buste/bassin restées sans vêtement, par os dominant
        import collections
        cnt = collections.Counter(); zz = collections.defaultdict(list)
        for f in bm.faces:
            if True:
                z = sum((mw @ v.co).z for v in f.verts) / len(f.verts)
                if ref['hanches'] - 0.30 * (ref['hanches'] - ref['genou']) <= z <= ref['epaules'] + 0.02:
                    ds = collections.Counter(dom(v) for v in f.verts).most_common(1)[0][0]
                    cnt[ds] += 1; zz[ds].append(z)
        print('TROUS:', ', '.join(f"{g}={n} z[{min(zz[g]):.2f},{max(zz[g]):.2f}]" for g, n in cnt.most_common()), '| repères', {k: round(v, 2) for k, v in ref.items() if isinstance(v, float)})
    bm.free()  # (pas de second to_mesh : il effacerait les attributs de masque créés plus haut)

def creer_coque(corps0, arm, spec):
    pred, offf = TYPES[spec['type']]
    ref = reperes(arm, corps0); off = spec.get('ampleur', 0.014) * ref['H']
    mw = corps0.matrix_world; sc = mw.to_scale().x
    noms = [vg.name for vg in corps0.vertex_groups]
    bm = bmesh.new(); bm.from_mesh(corps0.data)
    deform = bm.verts.layers.deform.active
    def dom(v):
        w = v[deform]
        return noms[max(w.keys(), key=lambda k: w[k])] if len(w) else ''
    # Masque par sommet (même prédicat que les vêtements ajustés) : on garde les faces qui touchent la zone (marge d'un anneau) et c'est le matériau, par un seuil lisse
    # sur le masque interpolé, qui dessine la limite (ourlet, col, manche) : plus de bords déchiquetés ni de trous entre triangles.
    couche_m = bm.verts.layers.float.new('masque_c')   # couche portée par les sommets eux-mêmes (les indices changent après suppression)
    for v in bm.verts: v[couche_m] = 1.0 if pred(dom(v), mw @ v.co, ref, spec) else 0.0
    # fermeture du masque : un sommet isolé hors zone au milieu de sommets dans la zone (os voisin) faisait des trous ; deux passes de moyenne sur les voisins, puis seuil bas
    for _ in range(spec.get('lissage_masque', 3)):
        nv = {v: max(v[couche_m], sum(e.other_vert(v)[couche_m] for e in v.link_edges) / max(1, len(v.link_edges))) for v in bm.verts}
        for v, m in nv.items(): v[couche_m] = m
    garder = {f for f in bm.faces if any(v[couche_m] > 0 for v in f.verts)}
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in garder], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # Décalage RADIAL : depuis l'axe du tronc, de chaque jambe ou de chaque bras (les normales du corps, trop irrégulières dans les plis, fissuraient la coque).
    # Le décalage vaut `ampleur` (fraction de la taille) près de l'attache (épaules, hanches) et grandit de `evasement` jusqu'à l'ourlet : le vêtement tombe de l'attache
    # au lieu de mouler le corps. Les sommets sont copiés du corps : mêmes poids de peau, donc mêmes poses et mêmes animations.
    bonepos = lambda n: arm.matrix_world @ arm.data.bones[n].head_local
    S_ = {c: bonepos(c + 'Arm') for c in ('Left', 'Right')}; E_ = {c: bonepos(c + 'Hand') for c in ('Left', 'Right')}
    JX = {c: bonepos(c + 'UpLeg') for c in ('Left', 'Right')}
    pts_w = [mw @ v.co for v in bm.verts]
    cxt = sum(p.x for p in pts_w) / len(pts_w); cyt = sum(p.y for p in pts_w) / len(pts_w)
    haut_v = spec['type'] in ('tshirt', 'chemise', 'pull', 'debardeur')
    z_attache = ref['epaules'] if haut_v else ref['hanches']
    z_ourlet = (ref['hanches'] - spec.get('ourlet', 0.35) * (ref['hanches'] - ref['genou'])) if haut_v else (ref['hanches'] - spec.get('longueur', 0.55 if spec['type'] == 'shorts' else 1.0) * (ref['hanches'] - ref['cheville'] if spec['type'] == 'pantalon' else ref['hanches'] - ref['genou']))
    base = spec.get('ampleur', 0.014) * ref['H']; eva = spec.get('evasement', 0.03) * ref['H']
    lisse = lambda x: x * x * (3 - 2 * x)
    bm.normal_update()
    nouv = []
    for v in bm.verts:
        q = mw @ v.co; g = dom(v); t = 0.0
        if g.startswith(('Left', 'Right')) and g.endswith(('Arm', 'ForeArm', 'Hand', 'Shoulder')) and not g.endswith('UpLeg'):
            c = 'Left' if g.startswith('Left') else 'Right'; ax = (E_[c] - S_[c]); L2 = max(ax.length_squared, 1e-9)
            u = (q - S_[c]).dot(ax) / L2; perp = (q - S_[c]) - ax * u
            d = perp.normalized() if perp.length > 1e-6 else Vector((1 if c == 'Left' else -1, 0, 0))
            t = lisse(min(1.0, max(0.0, u / 0.7))) * (1.0 if haut_v else 0.0)     # manche : s'évase vers le poignet
        elif g.endswith(('UpLeg', 'Leg', 'Foot', 'ToeBase')):
            c = 'Left' if g.startswith('Left') else 'Right'; d = Vector((q.x - JX[c].x, q.y - JX[c].y, 0))
            d = d.normalized() if d.length > 1e-6 else Vector((0, -1, 0)); t = lisse(min(1.0, max(0.0, (z_attache - q.z) / max(z_attache - z_ourlet, 1e-6))))
        else:
            d = Vector((q.x - cxt, q.y - cyt, 0)); d = d.normalized() if d.length > 1e-6 else Vector((0, -1, 0))
            t = lisse(min(1.0, max(0.0, (z_attache - q.z) / max(z_attache - z_ourlet, 1e-6))))
        n = (mw.to_3x3() @ v.normal).normalized()
        if n.z > 0.2 and haut_v: d = (d + Vector((0, 0, 1)) * 1.4 * n.z).normalized()          # épaules, col : la surface regarde vers le haut, un décalage horizontal enfoncerait le tissu
        f = 1.0
        if g.endswith(('UpLeg', 'Leg')) and not haut_v:                                        # entre les cuisses les deux jambes se pousseraient l'une contre l'autre
            c = 'Left' if g.startswith('Left') else 'Right'; vers_milieu = (-1 if c == 'Left' else 1) * (q.x - JX[c].x)
            f = 0.35 if vers_milieu > 0.02 * ref['H'] else 1.0
        nouv.append(d * (base + eva * t) * f)
    for v, dv in zip(bm.verts, nouv):
        v.co += mw.inverted().to_3x3() @ dv
    R = 0.28; cx, cy = 0.0, 0.06
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        f.smooth = True
        us = []
        for l in f.loops:
            q = mw @ l.vert.co
            us.append(math.atan2(q.y - cy, q.x - cx) * R)
        base = us[0]
        for i, l in enumerate(f.loops):
            u = us[i]
            while u - base > math.pi * R: u -= 2 * math.pi * R
            while base - u > math.pi * R: u += 2 * math.pi * R
            l[uv].uv = (u, (mw @ l.vert.co).z)
    me = bpy.data.meshes.new('coque_' + spec['type']); bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new('coque_' + spec['type'], me); bpy.context.scene.collection.objects.link(obj)
    for vg in corps0.vertex_groups: obj.vertex_groups.new(name=vg.name)
    obj.parent = corps0.parent; obj.matrix_world = corps0.matrix_world.copy()
    obj.matrix_parent_inverse = corps0.matrix_parent_inverse.copy()
    md = obj.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    mat = fabriquer_materiau(spec, me.uv_layers[0].name)
    mat.surface_render_method = 'DITHERED'; nt = mat.node_tree; bs = nt.nodes['Principled BSDF']
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'masque_c'; at.attribute_type = 'GEOMETRY'
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'; mr.inputs['From Min'].default_value = 0.55; mr.inputs['From Max'].default_value = 0.75
    nt.links.new(at.outputs['Fac'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], bs.inputs['Alpha'])
    obj.data.materials.append(mat)
    print(f"VETEMENT(ample):{spec['type']} {len(me.polygons)} faces, décalage {off} m")
    return obj


# --- vêtements amples en MAILLAGE PROPRE : tubes d'anneaux elliptiques dimensionnés sur la coupe réelle du corps (comme la jupe), poids de peau interpolés entre os ---
TUBES = {'tunique', 'robe', 'manteau', 'pantalon_large', 'short_large'}
def _base_axe(a):
    a = a.normalized(); t = Vector((0, 1, 0)) if abs(a.y) < 0.9 else Vector((1, 0, 0))
    u = a.cross(t).normalized(); return u, a.cross(u).normalized()

def creer_tubes(corps0, arm, spec):
    ref = reperes(arm, corps0); H = ref['H']; mw = corps0.matrix_world; inv = mw.inverted()
    noms = [vg.name for vg in corps0.vertex_groups]
    pts = []
    for v in corps0.data.vertices:
        g = noms[max(v.groups, key=lambda x: x.weight).group] if len(v.groups) else ''
        pts.append((mw @ v.co, g))
    bp = lambda n: arm.matrix_world @ arm.data.bones[n].head_local
    marge = spec.get('marge', 0.012) * H; eva = spec.get('evasement', 0.03) * H; NS = 40
    def coupe(groupes, centre, axe, s, tol):
        """Ellipse de la coupe du corps (sommets des groupes donnés) dans le plan perpendiculaire à `axe` au paramètre s : centre, rayons le long de (u, v)."""
        u, v = _base_axe(axe); a = axe.normalized()
        sl = [p for p, g in pts if g in groupes and abs((p - centre).dot(a) - s) < tol]
        if len(sl) < 4: return None
        c = sum(((p - centre) - a * (p - centre).dot(a) for p in sl), Vector()) / len(sl) + centre + a * s
        rx = max(abs((p - c).dot(u)) for p in sl); ry = max(abs((p - c).dot(v)) for p in sl)
        return c, u, v, rx, ry
    objets = []
    def construire(nom, anneaux, ouvert_haut=True, lissage=None, ouverture=0.0):
        """anneaux : liste de (centre, u, v, rx, ry, poids{groupe: w}) du haut vers le bas ; surface = bandes entre anneaux consécutifs."""
        # lissage le long du tube (centres et rayons) : les coupes du corps sont bruitées d'un anneau à l'autre
        for _ in range(lissage if lissage is not None else spec.get('lissage', 4)):
            lis = []
            for i, (c, u, v, rx, ry, w) in enumerate(anneaux):
                a0, a2 = anneaux[max(0, i - 1)], anneaux[min(len(anneaux) - 1, i + 1)]
                lis.append(((a0[0] + 2 * c + a2[0]) / 4, u, v, (a0[3] + 2 * rx + a2[3]) / 4, (a0[4] + 2 * ry + a2[4]) / 4, w))
            anneaux = [anneaux[0]] + lis[1:-1] + [anneaux[-1]] if len(anneaux) > 2 else anneaux   # extrémités inchangées (attache, ourlet)
        bm = bmesh.new(); uv = bm.loops.layers.uv.new('UV_vet'); dl = bm.verts.layers.deform.verify(); rings = []
        for (c, u, v, rx, ry, w) in anneaux:
            ring = []
            for j in range(NS):
                ang = 2 * math.pi * j / NS
                vert = bm.verts.new(inv @ (c + u * (rx * math.cos(ang)) + v * (ry * math.sin(ang))))
                tot = sum(w.values()) or 1.0
                for gname, gw in w.items(): vert[dl][noms.index(gname)] = gw / tot
                ring.append(vert)
            rings.append(ring)
        R = 0.165 * H; s_cum = [0.0]
        for i in range(1, len(anneaux)): s_cum.append(s_cum[-1] + (anneaux[i][0] - anneaux[i - 1][0]).length)
        for i in range(len(rings) - 1):
            for j in range(NS):
                if ouverture > 0 and i >= 1:   # manteau : on ne crée pas les faces du devant (y petit = face), à partir de la poitrine ; le col reste fermé
                    ang_f = 2 * math.pi * (j + 0.5) / NS; dev = (anneaux[i][1] * math.cos(ang_f) + anneaux[i][2] * math.sin(ang_f)).normalized()
                    if dev.dot(Vector((0, -1, 0))) > math.cos(math.radians(ouverture / 2)): continue
                f = bm.faces.new((rings[i][j], rings[i][(j + 1) % NS], rings[i + 1][(j + 1) % NS], rings[i + 1][j])); f.smooth = True
                a0 = 2 * math.pi * j / NS; a1 = 2 * math.pi * (j + 1) / NS if j < NS - 1 else 2 * math.pi
                for l, ang, ii in zip(f.loops, (a0, a1, a1, a0), (i, i, i + 1, i + 1)): l[uv].uv = (ang * R, s_cum[ii])
        me = bpy.data.meshes.new(nom); bm.to_mesh(me); bm.free()
        obj = bpy.data.objects.new(nom, me); bpy.context.scene.collection.objects.link(obj)
        for vg in corps0.vertex_groups: obj.vertex_groups.new(name=vg.name)
        obj.parent = corps0.parent; obj.matrix_world = corps0.matrix_world.copy(); obj.matrix_parent_inverse = corps0.matrix_parent_inverse.copy()
        md = obj.modifiers.new('Armature', 'ARMATURE'); md.object = arm
        obj.data.materials.append(fabriquer_materiau(spec, 'UV_vet')); objets.append(obj)

    zT = {n: bp(n).z for n in ('Spine02', 'Spine01', 'Spine', 'Hips')}
    def poids_tronc(z):
        ordre = ['Spine02', 'Spine01', 'Spine', 'Hips']
        if z >= zT[ordre[0]]: return {ordre[0]: 1.0}
        for a_, b_ in zip(ordre, ordre[1:]):
            if z >= zT[b_]:
                t = (z - zT[b_]) / max(zT[a_] - zT[b_], 1e-6); return {a_: t, b_: 1 - t}
        return {'Hips': 1.0}
    cx = sum(p.x for p, _ in pts) / len(pts); cy = sum(p.y for p, _ in pts) / len(pts)
    T = spec['type']
    if T in ('tunique', 'robe', 'manteau'):
        zs = ref['epaules']; z_hem = ref['hanches'] - spec.get('ourlet', 0.50) * (ref['hanches'] - ref['genou']); axe = Vector((0, 0, 1)); O = Vector((0, 0, 0))
        zs_list = [zs + 0.075 * H, zs + 0.06 * H, zs + 0.04 * H] + [zs - i * (zs - z_hem) / 13 for i in range(14)]   # la ligne d'épaule suit la pente du trapèze (convexe) : trois anneaux au lieu de deux
        anneaux = []; rx_prec = ry_prec = 0.0
        demi_epaules = abs(bp('LeftArm').x - bp('RightArm').x) / 2
        for k, z in enumerate(zs_list):
            t = 0 if k <= 2 else (k - 3) / 13
            if k == 0:   # base du cou : petit anneau (encolure)
                u, v = _base_axe(axe); anneaux.append((Vector((cx, cy, z)), u, v, 0.08 * H, 0.075 * H, {'Spine02': 1.0})); continue
            # les plis du ventre des corps ronds sont rattachés à l'os de la cuisse ; au-dessus des hanches ce ne sont que du ventre : on les compte
            grp_t = {'Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'LeftUpLeg', 'RightUpLeg'}   # cuisses comprises : la largeur des hanches (et du bas du ventre) fixe celle du tissu
            cp = coupe(grp_t, O, axe, z, 0.03 * H)
            if cp is None: cp = coupe({'Hips', 'Spine', 'Spine01', 'Spine02', 'LeftUpLeg', 'RightUpLeg'}, O, axe, z, 0.05 * H)
            if cp is None: print(f'TUNIQUE: coupe vide à z={z:.2f}'); continue
            c, u, v, rx, ry = cp
            f = marge * 2.6 + spec.get('evasement', 0.02) * H * t     # marge nettement > celle du bassin (0,3) : sinon les deux surfaces se disputent les pixels (z-fighting)
            rx += f; ry += f
            if k == 1: rx = max(rx, demi_epaules * 0.85 + marge * 1.5); ry = max(ry, 0.085 * H)
            if k == 2: rx = max(rx, demi_epaules * 1.08 + marge * 1.5); ry = max(ry, 0.09 * H)   # dessus de l'épaule couvert : sinon la peau y reste visible   # épaules : largeur imposée par les os, sinon le col s'effondre
            rx = max(rx, rx_prec * 0.985); ry = max(ry, ry_prec * 0.985); rx_prec, ry_prec = rx, ry   # le tissu tombe des épaules : il ne rentre pas à la taille
            anneaux.append((c, u, v, rx, ry, poids_tronc(z)))
            if os.environ.get('DIAG_TUNIQUE'): print(f'TUNIQUE z={z:.2f} rx={rx:.3f} ry={ry:.3f}')
        construire('tunique', anneaux, ouverture=float(spec.get('ouverture', 0)))   # le nom reste « tunique » : confinement et mesures le cherchent par ce nom
        man = spec.get('manches', 0.45)
        if man > 0:
            for cote in ('Left', 'Right'):
                S = bp(cote + 'Arm'); E = bp(cote + 'Hand'); a = E - S; L = a.length; an = []
                coude = (bp(cote + 'ForeArm') - S).dot(a.normalized()) / L      # position du coude le long du bras (0..1)
                N = 9
                for i in range(N):
                    t = i / (N - 1); s_ = (-0.10 + (man + 0.10) * t) * L           # la manche commence 10 % AVANT l'épaule : elle passe sous la tunique, plus de peau nue
                    cp = coupe({cote + 'Arm', cote + 'ForeArm'}, S, a, max(s_, 0.0) + 0.02 * L, 0.05 * L)
                    if cp is None: continue
                    c, u, v, rx, ry = cp; f = marge * 1.3 + eva * 0.9 * t ** 1.5
                    pos_rel = s_ / L
                    # poids : près de l'épaule, mélange tronc / épaule / bras (la manche reste attachée à la tunique quand le bras se lève) ;
                    # bras seul jusqu'au coude ; après le coude, fondu vers l'avant-bras (la manche longue plie avec le coude)
                    ep = min(1.0, max(0.0, pos_rel / 0.22))
                    w = {'Spine02': 0.55 * (1 - ep), cote + 'Shoulder': 0.25 * (1 - ep), cote + 'Arm': 0.2 + 0.8 * ep}
                    fa = min(1.0, max(0.0, (pos_rel - (coude - 0.08)) / 0.16))
                    if fa > 0: w = {k: v_ * (1 - fa) for k, v_ in w.items()} | {cote + 'ForeArm': fa}
                    an.append((c, u, v, rx + f, ry + f, w))
                if len(an) > 2:
                    # dôme d'épaule : l'embouchure de la manche, côté cou, restait ouverte et laissait voir l'épaule ; on la ferme par des anneaux qui rétrécissent
                    c0, u0, v0, rx0, ry0, w0 = an[0]; an_ = a.normalized(); dome = []
                    for sc, dist in ((0.05, 0.095), (0.35, 0.075), (0.70, 0.045), (0.92, 0.02)):
                        dome.append((c0 - an_ * (dist * L), u0, v0, rx0 * sc, ry0 * sc, w0))
                    an = dome + an
                    construire('manche_' + cote, an, lissage=0)
    else:  # pantalon_large / short_large
        z_top = ref['hanches'] - 0.03 * H; z_cro = ref['hanches'] - 0.22 * (ref['hanches'] - ref['genou'])
        z_end = (ref['hanches'] - spec.get('longueur', 0.9) * (ref['hanches'] - ref['genou'])) if T == 'short_large' else ref['cheville'] + 0.03 * H
        axe = Vector((0, 0, 1)); O = Vector((0, 0, 0)); u0, v0 = _base_axe(axe)
        bass = []
        for i in range(8):
            z = z_top - (z_top - z_cro) * i / 7
            cp = coupe({'Hips', 'LeftUpLeg', 'RightUpLeg', 'Spine'}, O, axe, z, 0.03 * H)
            if cp: c, u, v, rx, ry = cp; bass.append((c, u, v, rx + marge * 0.3, ry + marge * 0.3, {'Hips': 1.0}))
        if len(bass) > 2:
            # le bassin ne doit jamais dépasser la tunique (fentes en croissant sur le flanc des corps ronds) : on le rétrécit de 6 %
            bass = [(c_, u_, v_, rx_ * 0.94, ry_ * 0.94, w_) for (c_, u_, v_, rx_, ry_, w_) in bass]
            construire('bassin', bass, lissage=10)
        zk, zh, za = bp('LeftLeg').z, ref['hanches'], bp('LeftFoot').z
        for cote in ('Left', 'Right'):
            an = []
            for i in range(14):
                t = i / 13; z = (z_cro + 0.02 * H) - ((z_cro + 0.02 * H) - z_end) * t
                cp = coupe({cote + 'UpLeg', cote + 'Leg', cote + 'Foot'}, O, axe, z, 0.025 * H)
                if cp is None: continue
                c, u, v, rx, ry = cp; f = marge * 1.3 + eva * t
                if z > zk + 0.05 * H: w = {cote + 'UpLeg': 1.0}
                elif z > zk - 0.05 * H: tt = (z - (zk - 0.05 * H)) / (0.10 * H); w = {cote + 'UpLeg': tt, cote + 'Leg': 1 - tt}
                elif z > za + 0.04 * H: w = {cote + 'Leg': 1.0}
                else: w = {cote + 'Leg': 0.6, cote + 'Foot': 0.4}
                an.append((c, u, v, rx + f, ry + f, w))
            if len(an) > 4:
                # plafond de rayon : sur les corps ronds, les plis du ventre rattachés à l'os de la cuisse gonflent le haut du tube de jambe, qui perce alors la tunique ;
                # le haut de la jambe ne peut pas dépasser 1,35 fois le rayon médian du reste de la jambe
                med_x = sorted(r_[3] for r_ in an[len(an) // 2:])[len(an[len(an) // 2:]) // 2]; med_y = sorted(r_[4] for r_ in an[len(an) // 2:])[len(an[len(an) // 2:]) // 2]
                an = [(c_, u_, v_, min(rx_, 1.35 * med_x), min(ry_, 1.35 * med_y), w_) for (c_, u_, v_, rx_, ry_, w_) in an]
            if len(an) > 2: construire('jambe_' + cote, an)
    print(f"VETEMENT(tubes):{T} {len(objets)} parties")
    return objets


# --- visage : décalque projeté sur l'avant de la tête (UV calculée AU REPOS → suit la déformation du squelette) ---
HEAD_BBOX = None
def appliquer_visage(corps0, png):
    mw = corps0.matrix_world; me = corps0.data
    noms = [vg.name for vg in corps0.vertex_groups]
    bm = bmesh.new(); bm.from_mesh(me); deform = bm.verts.layers.deform.active
    def dom(v):
        w = v[deform]
        return noms[max(w.keys(), key=lambda k: w[k])] if len(w) else ''
    TETE = {'Head', 'head_end', 'headfront'}  # selon le corps, Meshy rattache la peau de la tête à l'un ou l'autre de ces os
    tete = [v for v in bm.verts if dom(v) in TETE]
    P = [mw @ v.co for v in tete]
    x0, x1 = min(q.x for q in P), max(q.x for q in P); y0, y1 = min(q.y for q in P), max(q.y for q in P); z0, z1 = min(q.z for q in P), max(q.z for q in P)
    global HEAD_BBOX; HEAD_BBOX = (x0, x1, y0, y1, z0, z1)
    cx, W = (x0 + x1) / 2, (x1 - x0) * 1.02
    # plage verticale du visage : du menton (z0) à ~92 % de la hauteur de la tête (le haut est de la chevelure)
    Hh = (z1 - z0) / 0.92
    uv = bm.loops.layers.uv.get('UV_visage') or bm.loops.layers.uv.new('UV_visage')
    for f in bm.faces:
        for l in f.loops:
            q = mw @ l.vert.co
            l[uv].uv = ((q.x - cx) / W + 0.5, (q.z - z0) / Hh)
    bm.to_mesh(me)
    # masque : sommets de la tête tournés vers l'avant (y petit = face)
    if 'masque_visage' in me.color_attributes: me.color_attributes.remove(me.color_attributes['masque_visage'])
    ca = me.color_attributes.new('masque_visage', 'FLOAT_COLOR', 'POINT')
    ymid = (y0 + y1) / 2
    for v in bm.verts:
        q = mw @ v.co
        m = 1.0 if (dom(v) in TETE and q.y < ymid - 0.10 * (y1 - y0)) else 0.0
        ca.data[v.index].color = (m, m, m, 1)
    bm.free()
    mat = me.materials[0]; nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    lien = next(l for l in nt.links if l.to_socket == bsdf.inputs['Base Color'])
    src = lien.from_socket
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(png); tex.extension = 'CLIP'
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UV_visage'
    nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
    att = nt.nodes.new('ShaderNodeAttribute'); att.attribute_name = 'masque_visage'; att.attribute_type = 'GEOMETRY'
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    nt.links.new(tex.outputs['Alpha'], mul.inputs[0]); nt.links.new(att.outputs['Fac'], mul.inputs[1])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(src, mix.inputs['A']); nt.links.new(tex.outputs['Color'], mix.inputs['B']); nt.links.new(mul.outputs['Value'], mix.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    print(f'VISAGE: tête x[{x0:.2f},{x1:.2f}] y[{y0:.2f},{y1:.2f}] z[{z0:.2f},{z1:.2f}]')


def creer_jupe(corps0, arm, spec):
    """Jupe = maillage SÉPARÉ (vêtement ample) : cloche elliptique autour du bassin, rayon pris sur la coupe réelle du corps à chaque hauteur + marge + évasement
    croissant vers l'ourlet. Poids de peau : Hips en haut, de plus en plus répartis sur les cuisses (côté gauche → LeftUpLeg, droit → RightUpLeg) vers l'ourlet,
    avec un poids nul au milieu devant/derrière : la jupe suit les jambes sans se déchirer. Paramètres : longueur (fraction hanches→genou, 0,9 = genou),
    evasement (fraction de la taille, défaut 0,12), exposant (forme de la cloche, défaut 0,8), couleur/matiere/tuile/teintable comme les autres vêtements."""
    ref = reperes(arm, corps0); mw = corps0.matrix_world; H = ref['H']
    noms = [vg.name for vg in corps0.vertex_groups]
    pts = []
    for v in corps0.data.vertices:
        g = noms[max(v.groups, key=lambda x: x.weight).group] if len(v.groups) else ''
        pts.append((mw @ v.co, g))
    cx = sum(p.x for p, _ in pts) / len(pts); cy = sum(p.y for p, _ in pts) / len(pts)
    z_top = ref['hanches'] + 0.04 * H
    z_hem = ref['hanches'] - spec.get('longueur', 0.9) * (ref['hanches'] - ref['genou'])
    NR, NS = 18, 48
    corps_groupes = {'Hips', 'Spine', 'Spine01', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'}
    rx, ry = [], []
    for i in range(NR + 1):
        z = z_top - (z_top - z_hem) * i / NR
        sl = [p for p, g in pts if abs(p.z - z) < 0.03 * H and g in corps_groupes]
        rx.append(max((abs(p.x - cx) for p in sl), default=rx[-1] if rx else 0.2)); ry.append(max((abs(p.y - cy) for p in sl), default=ry[-1] if ry else 0.15))
    for arr in (rx, ry):  # lissage le long de la hauteur
        for _ in range(3):
            arr[:] = [(arr[max(0, i - 1)] + 2 * arr[i] + arr[min(NR, i + 1)]) / 4 for i in range(NR + 1)]
    eve = spec.get('evasement', 0.12) * H; marge = spec.get('marge', 0.018) * H  # evasement et marge en FRACTION de la taille H (erreur d'unité corrigée : 0,16 était lu comme 0,16 m)
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('UV_vet'); dl = bm.verts.layers.deform.verify()
    anneaux = []
    inv = mw.inverted()
    for i in range(NR + 1):
        t = i / NR; z = z_top - (z_top - z_hem) * t
        k = spec.get('exposant', 0.8)  # forme de la cloche : < 1 = s'évase plus tôt (jambe levée vers l'avant : le genou monte dans une partie encore étroite)
        a_x = rx[i] + marge + eve * t ** k; a_y = ry[i] + marge + eve * 0.85 * t ** k
        ring = []
        for j in range(NS):
            ang = 2 * math.pi * j / NS
            w = Vector((cx + a_x * math.cos(ang), cy + a_y * math.sin(ang), z))
            v = bm.verts.new(inv @ w)
            lisse = lambda x: x * x * (3 - 2 * x)
            lat = min(1.0, abs(math.cos(ang)) / 0.55)  # 0 devant/derrière, 1 sur les côtés
            wl = spec.get('poids_jambe', 0.30 if spec.get('longueur', 0.9) <= 0.95 else 0.15)  # mesuré : jupe jusqu'au genou 0,30 (partie haute ~0 % de sommets de jambe dehors) ; jupe longue 0,15 (0,30 → 1 à 9 %, 0,15 → 0 à 5 %) * lisse(t) * lisse(lat)
            groupe_jambe = 'LeftUpLeg' if math.cos(ang) > 0 else 'RightUpLeg'
            v[dl][noms.index('Hips')] = 1.0 - wl
            if wl > 0.001: v[dl][noms.index(groupe_jambe)] = wl
            ring.append(v)
        anneaux.append(ring)
    R = 0.165 * H
    for i in range(NR):
        for j in range(NS):
            f = bm.faces.new((anneaux[i][j], anneaux[i][(j + 1) % NS], anneaux[i + 1][(j + 1) % NS], anneaux[i + 1][j]))
            f.smooth = True
            angs = [2 * math.pi * jj / NS for jj in (j, j + 1, j + 1, j)]
            if j == NS - 1: angs[1] = angs[2] = 2 * math.pi
            for l, ang, ii in zip(f.loops, angs, (i, i, i + 1, i + 1)):
                l[uv].uv = (ang * R, z_top - (z_top - z_hem) * ii / NR)
    me = bpy.data.meshes.new('jupe'); bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new('jupe', me); bpy.context.scene.collection.objects.link(obj)
    for vg in corps0.vertex_groups: obj.vertex_groups.new(name=vg.name)
    obj.parent = corps0.parent; obj.matrix_world = corps0.matrix_world.copy(); obj.matrix_parent_inverse = corps0.matrix_parent_inverse.copy()
    md = obj.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    obj.data.materials.append(fabriquer_materiau(spec, 'UV_vet'))
    print(f"VETEMENT(jupe): {len(me.polygons)} faces, z {z_hem:.2f}→{z_top:.2f}, rayon haut {rx[0]:.2f}x{ry[0]:.2f}, ourlet {rx[-1]+marge+eve:.2f}")
    return obj


# --- accessoires : pièces rigides fixées à un os (poids 1,0 sur l'os → même animation que le squelette) ---
ACCESSOIRES = {'chapeau_paille', 'casquette', 'lunettes', 'sac_a_dos', 'sac_fourre_tout', 'appareil_photo', 'ballon', 'verre', 'telephone'}
def mesures_tete(corps0):
    """Mesures de la TÊTE réelle. Le groupe d'os Head descend jusqu'au cou (z ≈ 1,34 m sur un corps de 1,70 m) : sa boîte serait trop haute de 50 %.
    On prend donc le sommet du groupe et on descend d'une hauteur de tête proportionnelle à la taille (≈ 0,14 H, soit environ 7 têtes de haut) ;
    largeur et profondeur sont mesurées sur les sommets de tête situés dans cette hauteur."""
    mw = corps0.matrix_world; noms = [vg.name for vg in corps0.vertex_groups]; TETE = {'Head', 'head_end', 'headfront'}
    P = []
    for v in corps0.data.vertices:
        if len(v.groups) and noms[max(v.groups, key=lambda x: x.weight).group] in TETE: P.append(mw @ v.co)
    z1 = max(p.z for p in P); H = max((mw @ v.co).z for v in corps0.data.vertices) - min((mw @ v.co).z for v in corps0.data.vertices)
    Hh = 0.14 * H; z0 = z1 - Hh
    Q = [p for p in P if p.z >= z0]
    x0, x1 = min(p.x for p in Q), max(p.x for p in Q); y0, y1 = min(p.y for p in Q), max(p.y for p in Q)
    return {'cx': (x0 + x1) / 2, 'cy': (y0 + y1) / 2, 'W': x1 - x0, 'D': y1 - y0, 'z0': z0, 'z1': z1, 'Hh': Hh, 'yf': y0}  # yf = avant du visage (y minimal)

def partie(corps0, arm, nom, os_nom, construire, couleur, rugosite=0.6, metal=0.0):
    """Crée un objet rigide : `construire(bm, M)` ajoute des primitives en coordonnées MONDE ; poids 1,0 sur l'os `os_nom`."""
    mw = corps0.matrix_world; bm = bmesh.new()
    construire(bm)
    bmesh.ops.transform(bm, matrix=mw.inverted(), verts=bm.verts)
    for f in bm.faces: f.smooth = True
    dl = bm.verts.layers.deform.verify(); noms = [vg.name for vg in corps0.vertex_groups]
    for v in bm.verts: v[dl][noms.index(os_nom)] = 1.0
    me = bpy.data.meshes.new(nom); bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new(nom, me); bpy.context.scene.collection.objects.link(obj)
    for vg in corps0.vertex_groups: obj.vertex_groups.new(name=vg.name)
    obj.parent = corps0.parent; obj.matrix_world = corps0.matrix_world.copy(); obj.matrix_parent_inverse = corps0.matrix_parent_inverse.copy()
    md = obj.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    mat = bpy.data.materials.new('mat_' + nom); mat.use_nodes = True; b = mat.node_tree.nodes['Principled BSDF']
    c = [int(couleur[i:i + 2], 16) / 255 for i in (1, 3, 5)]; lin = lambda x: ((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92
    b.inputs['Base Color'].default_value = (lin(c[0]), lin(c[1]), lin(c[2]), 1); b.inputs['Roughness'].default_value = rugosite; b.inputs['Metallic'].default_value = metal
    obj.data.materials.append(mat)
    return obj

def _cyl(bm, centre, rx, ry, h, rot=(0, 0, 0), seg=40):
    from mathutils import Matrix, Euler
    M = Matrix.Translation(centre) @ Euler(tuple(math.radians(a) for a in rot)).to_matrix().to_4x4() @ Matrix.Diagonal((rx, ry, h / 2, 1))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=1.0, radius2=1.0, depth=2.0, matrix=M)
def _ell(bm, centre, rx, ry, rz, seg=24):
    from mathutils import Matrix
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0, matrix=Matrix.Translation(centre) @ Matrix.Diagonal((rx, ry, rz, 1)))
def _box(bm, centre, lx, ly, lz, rot=(0, 0, 0)):
    from mathutils import Matrix, Euler
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(centre) @ Euler(tuple(math.radians(a) for a in rot)).to_matrix().to_4x4() @ Matrix.Diagonal((lx, ly, lz, 1)))

def creer_accessoire(corps0, arm, spec):
    T = spec['type']; c = spec.get('couleur', '#d8c28a'); ref = reperes(arm, corps0); H = ref['H']
    h = mesures_tete(corps0); mw = corps0.matrix_world
    pos = lambda nom: arm.matrix_world @ arm.data.bones[nom].head_local
    objets = []
    if T in ('chapeau_paille', 'casquette'):
        zb = h['z1'] - 0.24 * h['Hh']  # plan de la bordure : au-dessus des yeux
        cx, cy = h['cx'], h['cy']
        if T == 'chapeau_paille':
            Rb = h['W'] * 0.98
            objets.append(partie(corps0, arm, 'chapeau_bord', 'Head', lambda bm: _cyl(bm, Vector((cx, cy, zb)), Rb, Rb * 0.95, 0.010), c, 0.9))
            objets.append(partie(corps0, arm, 'chapeau_calotte', 'Head', lambda bm: _ell(bm, Vector((cx, cy, zb)), h['W'] * 0.60, h['D'] * 0.62, (h['z1'] - zb) + 0.045), c, 0.9))
            objets.append(partie(corps0, arm, 'chapeau_ruban', 'Head', lambda bm: _cyl(bm, Vector((cx, cy, zb + 0.022)), h['W'] * 0.612, h['D'] * 0.632, 0.034), spec.get('ruban', '#355070'), 0.7))
        else:
            objets.append(partie(corps0, arm, 'casquette_calotte', 'Head', lambda bm: _ell(bm, Vector((cx, cy, zb)), h['W'] * 0.58, h['D'] * 0.60, (h['z1'] - zb) + 0.035), c, 0.7))
            objets.append(partie(corps0, arm, 'casquette_visiere', 'Head', lambda bm: _cyl(bm, Vector((cx, h['yf'] - 0.045, zb + 0.012)), h['W'] * 0.42, 0.085, 0.008, rot=(-6, 0, 0)), spec.get('visiere', c), 0.7))
    elif T == 'lunettes':
        ze = h['z0'] + 0.50 * h['Hh']; yf = h['yf'] - 0.002; dx = h['W'] * 0.215; r = h['W'] * 0.155
        fonce = spec.get('couleur', '#1a1a1d')
        def verres(bm):
            for sx in (-1, 1): _cyl(bm, Vector((h['cx'] + sx * dx, yf, ze)), r, r * 0.85, 0.006, rot=(90, 0, 0), seg=24)
        def monture(bm):
            _box(bm, Vector((h['cx'], yf, ze + 0.004)), dx * 0.9, 0.006, 0.008)
            for sx in (-1, 1): _box(bm, Vector((h['cx'] + sx * (dx + r + h['W'] * 0.07), yf + h['D'] * 0.30, ze + 0.004)), 0.006, h['D'] * 0.60, 0.008)
        objets.append(partie(corps0, arm, 'lunettes_verres', 'Head', verres, fonce, 0.15, 0.2))
        objets.append(partie(corps0, arm, 'lunettes_monture', 'Head', monture, spec.get('monture', '#111111'), 0.4))
    elif T == 'sac_a_dos':
        sp2 = pos('Spine02'); lo = pos('Spine'); larg = h['W'] * 2.2
        yb = h['cy'] + h['D'] * 0.25
        zc = (sp2.z + lo.z) / 2 + 0.02
        objets.append(partie(corps0, arm, 'sac_corps', 'Spine02', lambda bm: _box(bm, Vector((0, yb + 0.09, zc - 0.02)), larg * 0.42, 0.16, 0.34), c, 0.8))
        objets.append(partie(corps0, arm, 'sac_poche', 'Spine02', lambda bm: _box(bm, Vector((0, yb + 0.18, zc - 0.07)), larg * 0.30, 0.04, 0.16), spec.get('poche', '#334455'), 0.8))
        def bretelles(bm):
            for sx in (-1, 1): _box(bm, Vector((sx * larg * 0.20, yb - 0.03, zc + 0.02)), 0.04, 0.04, 0.30)
        objets.append(partie(corps0, arm, 'sac_bretelles', 'Spine02', bretelles, '#2a2a2e', 0.9))
    elif T == 'sac_fourre_tout':
        m = pos('LeftHand') if 'LeftHand' in arm.data.bones else pos('LeftForeArm')
        objets.append(partie(corps0, arm, 'tote_corps', 'LeftHand', lambda bm: _box(bm, Vector((m.x + 0.02, m.y, m.z - 0.20)), 0.10, 0.30, 0.30), c, 0.85))
        def anses(bm):
            for sy in (-1, 1): _box(bm, Vector((m.x + 0.02, m.y + sy * 0.08, m.z - 0.025)), 0.016, 0.016, 0.07)
            _box(bm, Vector((m.x + 0.02, m.y, m.z - 0.012)), 0.016, 0.18, 0.016)
        objets.append(partie(corps0, arm, 'tote_anses', 'LeftHand', anses, spec.get('anses', '#7a4a28'), 0.8))
    elif T == 'appareil_photo':
        sp2 = pos('Spine02'); yf = h['yf'] - 0.02
        zc = sp2.z - 0.02
        objets.append(partie(corps0, arm, 'photo_boitier', 'Spine02', lambda bm: _box(bm, Vector((0.0, yf - 0.02, zc)), 0.13, 0.065, 0.085), c, 0.5, 0.3))
        objets.append(partie(corps0, arm, 'photo_objectif', 'Spine02', lambda bm: _cyl(bm, Vector((0.0, yf - 0.075, zc)), 0.034, 0.034, 0.05, rot=(90, 0, 0), seg=24), '#1a1a1d', 0.3, 0.5))
        objets.append(partie(corps0, arm, 'photo_sangle', 'Head', lambda bm: _box(bm, Vector((0.0, yf + 0.04, zc + 0.12)), 0.20, 0.010, 0.012), '#111111', 0.9))
    elif T in ('verre', 'telephone'):
        # tenu dans la main droite : axe le long de l'avant-bras (main − coude, au REPOS) ; avec le bras levé l'objet se retrouve debout dans le poing
        from mathutils import Matrix
        coude = pos('RightForeArm'); main = pos('RightHand'); d = (main - coude).normalized()
        q = Vector((0, 0, 1)).rotation_difference(d); R = q.to_matrix().to_4x4()
        if T == 'verre':
            def verre(bm):
                bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.032, radius2=0.042, depth=0.13, matrix=Matrix.Translation(main + d * 0.075) @ R)
            objets.append(partie(corps0, arm, 'verre_cocktail', 'RightHand', verre, '#ff7a3d', 0.15))
            def paille(bm):
                bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.005, radius2=0.005, depth=0.12, matrix=Matrix.Translation(main + d * 0.15 + Vector((0.01, 0, 0))) @ R)
            objets.append(partie(corps0, arm, 'verre_paille', 'RightHand', paille, '#2e8b57', 0.5))
        else:
            def tel(bm):
                bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(main + d * 0.075) @ R @ Matrix.Diagonal((0.075, 0.012, 0.145, 1)))
            objets.append(partie(corps0, arm, 'telephone', 'RightHand', tel, '#1a1a1d', 0.3, 0.4))
    elif T == 'ballon':
        m = pos('RightHand')
        objets.append(partie(corps0, arm, 'ballon', 'RightHand', lambda bm: _ell(bm, Vector((m.x - 0.02, m.y - 0.04, m.z - 0.10)), 0.12, 0.12, 0.12), c, 0.5))
    print(f"ACCESSOIRE: {T} ({len(objets)} parties)")
    return objets

# --- coiffures : cheveux d'origine masqués (transparence par sommet) + calotte de crâne + volumes de cheveux séparés fixés à l'os Head ---
def _capuchon(bm, centre, rx, ry, rz, z_av, z_ar, seg=96):  # 96 segments : la ligne de coupe (frange, nuque) ne montre plus de marches
    """Calotte de cheveux : ellipsoïde dont on retire les faces sous une ligne de coupe qui va de z_av (devant : front) à z_ar (derrière : nuque)."""
    from mathutils import Matrix
    res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0, matrix=Matrix.Translation(centre) @ Matrix.Diagonal((rx, ry, rz, 1)))
    verts = set(res['verts']); yc = centre.y
    sup = []
    for f in bm.faces:
        if not all(v in verts for v in f.verts): continue
        c = f.calc_center_median()
        t = min(1.0, max(0.0, (c.y - (yc - ry)) / (2 * ry)))      # 0 = devant, 1 = derrière
        t = t * t * (3 - 2 * t)
        if c.z < z_av + (z_ar - z_av) * t: sup.append(f)
    bmesh.ops.delete(bm, geom=sup, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in verts if v.is_valid and not v.link_faces], context='VERTS')

def texturer_cheveux(obj, couleur):
    """Légère variation de teinte (bruit) sur les cheveux : évite l'aplat de plastique."""
    nt = obj.data.materials[0].node_tree; b = nt.nodes['Principled BSDF']
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 90; nz.inputs['Detail'].default_value = 6
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    c = [int(couleur[i:i + 2], 16) / 255 for i in (1, 3, 5)]; lin = lambda x: ((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92
    mix.inputs['A'].default_value = (lin(c[0]), lin(c[1]), lin(c[2]), 1)
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.72; mr.inputs['To Max'].default_value = 1.15
    nt.links.new(nz.outputs['Fac'], mr.inputs['Value'])
    gris = nt.nodes.new('ShaderNodeCombineColor')
    for i in range(3): nt.links.new(mr.outputs['Result'], gris.inputs[i])
    nt.links.new(gris.outputs['Color'], mix.inputs['B']); nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.42

def creer_coiffure(corps0, arm, spec, masque):
    me = corps0.data
    # 1. cheveux d'origine : attribut de masque + transparence
    if 'cheveux_o' in me.color_attributes: me.color_attributes.remove(me.color_attributes['cheveux_o'])
    ca = me.color_attributes.new('cheveux_o', 'FLOAT_COLOR', 'POINT')
    for i, m in enumerate(masque): ca.data[i].color = (float(m), float(m), float(m), 1)
    mat0 = me.materials[0]; mat0.surface_render_method = 'DITHERED'
    nt = mat0.node_tree; bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'cheveux_o'; at.attribute_type = 'GEOMETRY'
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'; mr.inputs['From Min'].default_value = 0.35; mr.inputs['From Max'].default_value = 0.65
    mr.inputs['To Min'].default_value = 1.0; mr.inputs['To Max'].default_value = 0.0   # 1 − masque : transparent là où les cheveux d'origine étaient
    nt.links.new(at.outputs['Fac'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], bs.inputs['Alpha'])
    # 2. calotte de crâne (peau) + coiffure
    h = mesures_tete(corps0); T = spec.get('type', 'court'); coul = spec.get('couleur', '#3a2414'); peau = spec.get('peau', '#d9a07a')
    cx, cy, W, D, z0, z1, Hh = h['cx'], h['cy'], h['W'], h['D'], h['z0'], h['z1'], h['Hh']
    sw, sd = 0.86 * W, 0.88 * D
    z_front = z1 - 0.34 * Hh
    # calotte de crâne : même ligne de coupe que les cheveux (elle ne doit JAMAIS recouvrir le visage peint) ; un peu plus petite que la coiffure
    objets = [partie(corps0, arm, 'crane', 'Head', lambda bm: _capuchon(bm, Vector((cx, cy + 0.03 * D, z0 + 0.48 * Hh)), sw / 2, sd / 2, 0.52 * Hh, z_front + 0.01 * Hh, z0 + 0.28 * Hh), peau, 0.55)]
    def cap(rx, ry, rz, zc, z_ar, dy=0.03):
        return lambda bm: _capuchon(bm, Vector((cx, cy + dy * D, zc)), rx, ry, rz, z_front, z_ar)
    parts = []
    if T == 'court':   parts.append(('cheveux', cap(0.60 * W, 0.58 * D, 0.56 * Hh, z0 + 0.50 * Hh, z0 + 0.28 * Hh)))
    elif T == 'bob':   parts.append(('cheveux', cap(0.66 * W, 0.64 * D, 0.60 * Hh, z0 + 0.46 * Hh, z0 + 0.02 * Hh)))
    elif T == 'afro':  parts.append(('cheveux', cap(0.80 * W, 0.78 * D, 0.78 * Hh, z0 + 0.58 * Hh, z0 + 0.34 * Hh, 0.06)))
    elif T == 'long':
        parts.append(('cheveux', cap(0.66 * W, 0.64 * D, 0.60 * Hh, z0 + 0.46 * Hh, z0 + 0.10 * Hh)))
        zh, zb = z1 - 0.22 * Hh, z0 - 1.0 * Hh
        parts.append(('cheveux_nappe', lambda bm: _ell(bm, Vector((cx, cy + 0.50 * D, (zh + zb) / 2)), 0.58 * W, 0.20 * D, (zh - zb) / 2, 28)))
    elif T == 'queue':
        parts.append(('cheveux', cap(0.60 * W, 0.58 * D, 0.56 * Hh, z0 + 0.50 * Hh, z0 + 0.28 * Hh)))
        def queue(bm):
            from mathutils import Matrix
            res = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=1.0, matrix=Matrix.Translation(Vector((cx, cy + 0.66 * D, z0 + 0.50 * Hh))) @ Matrix.Rotation(math.radians(-18), 4, 'X') @ Matrix.Translation(Vector((0, 0, -0.30 * Hh))) @ Matrix.Diagonal((0.14 * W, 0.14 * W, 0.52 * Hh, 1)))
        parts.append(('cheveux_queue', queue))
    elif T == 'chignon':
        parts.append(('cheveux', cap(0.60 * W, 0.58 * D, 0.56 * Hh, z0 + 0.50 * Hh, z0 + 0.28 * Hh)))
        parts.append(('cheveux_chignon', lambda bm: _ell(bm, Vector((cx, cy + 0.16 * D, z1 - 0.02 * Hh)), 0.26 * W, 0.26 * W, 0.22 * Hh, 20)))
    for nom, fn in parts:
        o = partie(corps0, arm, nom, 'Head', fn, coul, 0.42)
        texturer_cheveux(o, coul); objets.append(o)
    print(f"COIFFURE: {T}, {len(objets)} parties, cheveux d'origine masqués")
    return objets


if a.visage:
    appliquer_visage(corps[0], a.visage)

if os.environ.get('DIAG_CHEVEUX'):
    me = corps[0].data; mw0 = corps[0].matrix_world; noms0 = [vg.name for vg in corps[0].vertex_groups]; TETE0 = {'Head', 'head_end', 'headfront'}
    seuil = float(os.environ['DIAG_CHEVEUX'])
    P0 = [mw0 @ v.co for v in me.vertices if len(v.groups) and noms0[max(v.groups, key=lambda x: x.weight).group] in TETE0]
    zt = max(p.z for p in P0); Hh0 = 0.14 * (max((mw0 @ v.co).z for v in me.vertices) - min((mw0 @ v.co).z for v in me.vertices))
    if 'diag_c' in me.color_attributes: me.color_attributes.remove(me.color_attributes['diag_c'])
    ca = me.color_attributes.new('diag_c', 'FLOAT_COLOR', 'POINT'); n0 = 0
    for v in me.vertices:
        q = mw0 @ v.co; g = noms0[max(v.groups, key=lambda x: x.weight).group] if len(v.groups) else ''
        m = 1.0 if (g in TETE0 and q.z >= zt - seuil * Hh0) else 0.0; n0 += int(m); ca.data[v.index].color = (m, m, m, 1)
    nt = me.materials[0].node_tree; bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    lien = next(l for l in nt.links if l.to_socket == bs.inputs['Base Color']); at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'diag_c'
    rgb = nt.nodes.new('ShaderNodeRGB'); rgb.outputs[0].default_value = (1, 0, 1, 1); mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    nt.links.new(lien.from_socket, mx.inputs['A']); nt.links.new(rgb.outputs[0], mx.inputs['B']); nt.links.new(at.outputs['Fac'], mx.inputs['Factor']); nt.links.new(mx.outputs['Result'], bs.inputs['Base Color'])
    print(f'DIAG_CHEVEUX: {n0} sommets peints (seuil {seuil} x tête)')
appliquer_pose(arm, a.pose)
if _expr:
    deformer_expression(corps[0], _expr)  # après toutes les définitions (mesures_tete) ; avant coiffure et vêtements

def confiner_tunique(corps0, coques_, images=None, jeu_rel=0.008):
    """Confine CHAQUE tunique (tunique, robe, manteau, gilet…) dans l'ordre de création : les pièces de dessous (bassin, jambes, tuniques précédentes) sont à englober."""
    tuniques = [o for o in coques_ if o.name.startswith('tunique')]
    base = [o for o in coques_ if o.name == 'bassin' or o.name.startswith('jambe_')]
    for k, tun in enumerate(tuniques): _confiner_une(corps0, tun, base + tuniques[:k], images, jeu_rel)

def _confiner_une(corps0, tun, dessous, images=None, jeu_rel=0.008):
    """Piste B : la tunique doit ENGLOBER tout ce qui est dessous (peau du tronc, bassin, jambes). Pour chaque anneau (NS sommets), on prend les points des pièces
    intérieures situés dans la tranche de hauteur de l'anneau, on les range par secteur angulaire autour du centre de l'anneau, et on repousse le sommet de la tunique
    au rayon du plus lointain + un jeu. Ne rétrécit jamais ; ne touche pas à l'encolure (anneau 0).
    images=None : au repos (coordonnées des maillages). images=[...] : pour chaque image de l'animation, on mesure l'écart sur les maillages ÉVALUÉS (squelette appliqué)
    et on garde le pire écart par sommet, appliqué ensuite dans l'espace de repos (la tunique et les jambes suivent des os différents : les jambes qui se balancent la percent)."""
    NS = 40; mw = corps0.matrix_world; H = max(q.z for q in (mw @ v.co for v in corps0.data.vertices)); jeu = jeu_rel * H
    noms = [vg.name for vg in corps0.vertex_groups]
    zone = {'Hips', 'Spine', 'Spine01', 'Spine02', 'LeftUpLeg', 'RightUpLeg'}; epaule = {'LeftShoulder', 'RightShoulder'}
    if not any(o.name == 'bassin' or o.name.startswith('jambe_') for o in dessous): zone |= {'LeftLeg', 'RightLeg'}     # robe / manteau sans pantalon : les jambes nues sont dessous
    utilises = {i for p_ in corps0.data.polygons for i in p_.vertices}      # sommets encore rattachés à une face (retirer_toiles laisse des sommets orphelins)
    idx_peau = []
    for v in corps0.data.vertices:
        if v.index not in utilises: continue
        g = noms[max(v.groups, key=lambda x: x.weight).group] if len(v.groups) else ''
        if g in zone or g in epaule: idx_peau.append((v.index, g in epaule))
    me = tun.data; nr = len(me.vertices) // NS
    def etat(dg):
        """(anneaux, centres, points intérieurs) en coordonnées monde, au repos (dg=None) ou évalués."""
        if dg is None:
            Mt = tun.matrix_world; cop = corps0.data; M0 = mw
            tp = [Mt @ v.co for v in me.vertices]
            pe = [(M0 @ cop.vertices[i].co, e) for i, e in idx_peau]
            pi = [(o.matrix_world @ v.co, False) for o in dessous for v in o.data.vertices] + [(o.matrix_world @ p_.center, False) for o in dessous for p_ in o.data.polygons]
        else:
            ev = tun.evaluated_get(dg); m = ev.to_mesh(); tp = [ev.matrix_world @ v.co for v in m.vertices]; ev.to_mesh_clear()
            ec = corps0.evaluated_get(dg); m = ec.to_mesh(); pe = [(ec.matrix_world @ m.vertices[i].co, e) for i, e in idx_peau]; ec.to_mesh_clear()
            pi = []
            for o in dessous:
                eo = o.evaluated_get(dg); m = eo.to_mesh(); pi += [(eo.matrix_world @ v.co, False) for v in m.vertices] + [(eo.matrix_world @ p_.center, False) for p_ in m.polygons]; eo.to_mesh_clear()
        an = [tp[r * NS:(r + 1) * NS] for r in range(nr)]
        return an, [sum(a, Vector()) / NS for a in an], pe + pi
    def ecarts(an, cent, tous):
        """écart radial (m) à ajouter à chaque sommet pour englober ce qui est dessous (0 si déjà englobé)"""
        out = [[0.0] * NS for _ in range(nr)]
        for r in range(1, nr):
            dz = max(abs(cent[r].z - cent[max(r - 1, 0)].z), abs(cent[min(r + 1, nr - 1)].z - cent[r].z)) * 0.6
            besoin = [0.0] * NS
            for q, est_epaule in tous:
                if abs(q.z - cent[r].z) > dz or (est_epaule and r > 3): continue
                d = Vector((q.x - cent[r].x, q.y - cent[r].y, 0)); rq = d.length
                if rq < 1e-6: continue
                j = int(round((math.atan2(d.y, d.x) % (2 * math.pi)) / (2 * math.pi) * NS)) % NS
                besoin[j] = max(besoin[j], rq)
            for j in range(NS):
                d = Vector((an[r][j].x - cent[r].x, an[r][j].y - cent[r].y, 0)); rj = d.length
                if rj < 1e-6: continue
                jj = int(round((math.atan2(d.y, d.x) % (2 * math.pi)) / (2 * math.pi) * NS)) % NS
                b = max(besoin[(jj - 1) % NS], besoin[jj], besoin[(jj + 1) % NS]) + jeu
                out[r][j] = max(0.0, b - rj)
        return out
    pire = [[0.0] * NS for _ in range(nr)]
    if images is None: etats = [None]
    else: etats = images
    for f in etats:
        if f is None: dg = None
        else: scene.frame_set(f); dg = bpy.context.evaluated_depsgraph_get()
        an, cent, tous = etat(dg); e = ecarts(an, cent, tous)
        for r in range(nr):
            for j in range(NS): pire[r][j] = max(pire[r][j], e[r][j])
    # lissage des poussées : sans lui, un sommet poussé à côté d'un voisin non poussé fait une bosse (et l'ourlet un rebord). On étale chaque poussée sur les voisins
    # (angle périodique, anneaux voisins) par moyenne (1,2,1), puis on reprend le MAX avec l'original : la garantie « englobe ce qui est dessous » est conservée.
    for _ in range(int(os.environ.get('LISSAGE_CONFINEMENT', '4'))):
        flou = [[(pire[r][(j - 1) % NS] + 2 * pire[r][j] + pire[r][(j + 1) % NS]) / 4 for j in range(NS)] for r in range(nr)]
        flou = [[(flou[max(r - 1, 0)][j] + 2 * flou[r][j] + flou[min(r + 1, nr - 1)][j]) / 4 if r >= 1 else 0.0 for j in range(NS)] for r in range(nr)]
        pire = [[max(pire[r][j], flou[r][j]) for j in range(NS)] for r in range(nr)]
    # application dans l'espace de repos : rayon repos + écart, autour du centre de l'anneau au repos
    Mt = tun.matrix_world; invt = Mt.inverted(); rest = [Mt @ v.co for v in me.vertices]; pousses = 0
    for r in range(1, nr):
        c = sum(rest[r * NS:(r + 1) * NS], Vector()) / NS
        for j in range(NS):
            if pire[r][j] <= 0: continue
            q = rest[r * NS + j]; d = Vector((q.x - c.x, q.y - c.y, 0)); rj = d.length
            if rj < 1e-6: continue
            me.vertices[r * NS + j].co = invt @ (Vector((c.x, c.y, q.z)) + d * ((rj + pire[r][j]) / rj)); pousses += 1
    me.update()
    print(f'CONFINEMENT({"repos" if images is None else str(len(images)) + " images"}): {pousses} sommets de tunique repoussés ({nr} anneaux), écart max {max(max(x) for x in pire) * 1000:.0f} mm')


def retirer_toiles(corps0, seuil=2.2):
    """Bras levé : le squelette étire des triangles du corps entre l'aisselle et le flanc (une « toile » de peau qui pend le long du bras). On retire les faces dont une
    arête s'est allongée de plus de `seuil` fois par rapport au repos, dans la pose courante (poses statiques seulement). Les sommets restent (les masques sont indexés par sommet) ; le confinement ignore ceux qui n'ont plus de face."""
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    ev = corps0.evaluated_get(dg); m = ev.to_mesh(); pose = [v.co.copy() for v in m.vertices]; ev.to_mesh_clear()
    bm = bmesh.new(); bm.from_mesh(corps0.data); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    DIAG = os.environ.get('DIAG_TOILES'); diag = {}
    mauvaises = []; dl = bm.verts.layers.deform.active; noms = [vg.name for vg in corps0.vertex_groups]; tronc = {'Hips', 'Spine', 'Spine01', 'Spine02'}
    def dom(v): return noms[max(v[dl].keys(), key=lambda k: v[dl][k])] if dl is not None and len(v[dl]) else ''
    for f in bm.faces:
        gs = {dom(v) for v in f.verts}
        if DIAG:
            r_ = max(((pose[e.verts[0].index] - pose[e.verts[1].index]).length / max((e.verts[0].co - e.verts[1].co).length, 1e-7)) for e in f.edges)
            if r_ > 1.6: k_ = tuple(sorted(gs)); n_, m_ = diag.get(k_, (0, 0)); diag[k_] = (n_ + 1, max(m_, r_))
        # le creux du coude s'étire aussi, c'est normal : on ignore les faces entièrement dans le bras ; la toile, elle, relie le bras à la cuisse (plis du ventre) ou au tronc
        if all(g.endswith(('Shoulder', 'Arm', 'ForeArm', 'Hand')) for g in gs): continue
        for e in f.edges:
            i, j = e.verts[0].index, e.verts[1].index; l0 = (e.verts[0].co - e.verts[1].co).length
            if l0 > 1e-7 and (pose[i] - pose[j]).length / l0 > seuil: mauvaises.append(f); break
    if mauvaises:
        bmesh.ops.delete(bm, geom=mauvaises, context='FACES_ONLY')   # faces seulement : les sommets restent (le masque de cheveux, la coiffure et le visage sont indexés par sommet)
        bm.to_mesh(corps0.data); corps0.data.update()
    if DIAG:
        for k_, (n_, m_) in sorted(diag.items(), key=lambda kv: -kv[1][0])[:10]: print(f'DIAG_TOILES: {k_} : {n_} faces, étirement max x{m_:.1f}')
    print(f'TOILES: {len(mauvaises)} faces étirées retirées (seuil x{seuil})'); bm.free()

if a.pose and a.vetements and not os.environ.get('SANS_TOILES'): retirer_toiles(corps[0])
coques = []
if a.coiffure:
    coques.extend(creer_coiffure(corps[0], arm, json.loads(a.coiffure), _masque_origine))
if a.vetements:
    specs = json.load(open(a.vetements))
    specs = [{**DEFAUTS_TYPE.get(x['type'], {}), **x} for x in specs]  # ('mode': 'coque' → vêtement ample séparé ; sinon vêtement ajusté sur la peau)  # paramètres par défaut de la pièce, surchargés par la tenue
    ajustes = [x for x in specs if x.get('mode', 'peau') == 'peau' and x['type'] in TYPES and x['type'] not in TUBES]
    if ajustes:
        appliquer_peau(corps[0], arm, ajustes)
    for spec in specs:
        if spec['type'] in TUBES:
            coques.extend(creer_tubes(corps[0], arm, spec))
        elif spec['type'] in ACCESSOIRES:
            coques.extend(creer_accessoire(corps[0], arm, spec))
        elif spec['type'] == 'jupe':
            coques.append(creer_jupe(corps[0], arm, spec))
        elif spec.get('mode') == 'coque':
            coques.append(creer_coque(corps[0], arm, spec))
if not os.environ.get('SANS_CONFINEMENT'): confiner_tunique(corps[0], coques)
corps = corps + coques  # le cadrage et le parentage tiennent compte des vêtements

# --- animation : l'action d'un autre GLB, appliquée à NOTRE squelette (mêmes noms d'os) ---
action = None
if a.anim:
    actions_avant = set(bpy.data.actions)
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=a.anim)
    for o in [o for o in bpy.data.objects if o not in avant]:
        bpy.data.objects.remove(o, do_unlink=True)
    nouvelles = [x for x in bpy.data.actions if x not in actions_avant]
    action = max(nouvelles, key=lambda x: x.frame_range[1] - x.frame_range[0]) if nouvelles else None
    print('ANIM:', [(x.name, tuple(round(v) for v in x.frame_range)) for x in nouvelles])
    if action:
        arm.animation_data_create()
        arm.animation_data.action = action
        if hasattr(action, 'slots') and len(action.slots):  # Blender ≥ 4.4 : l'action s'applique via un slot
            arm.animation_data.action_slot = action.slots[0]
            print('SLOT:', action.slots[0].identifier)

if not os.environ.get('SANS_CONFINEMENT'):
    if action:
        _d0, _f0 = (int(action.frame_range[0]), int(action.frame_range[1]))
        confiner_tunique(corps[0], coques, images=list(range(_d0, _f0 + 1, 2)))
    elif a.pose:   # pose statique : le squelette déforme la peau (bras levé) alors que la tunique a été bâtie sur les coordonnées de repos
        confiner_tunique(corps[0], coques, images=[scene.frame_current])

def bornes():
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in corps:
        ev = o.evaluated_get(dg)
        for c in ev.bound_box:
            pt = ev.matrix_world @ Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], pt[i]); hi[i] = max(hi[i], pt[i])
    return lo, hi

debut, fin = (int(action.frame_range[0]), int(action.frame_range[1])) if action else (1, 1)
lo, hi = bornes()
for f in range(debut, fin + 1, max(1, (fin - debut) // 6 or 1)):  # cadrage commun à toute l'animation
    scene.frame_set(f); bpy.context.view_layer.update()
    l2, h2 = bornes()
    for i in range(3):
        lo[i] = min(lo[i], l2[i]); hi[i] = max(hi[i], h2[i])
size = hi - lo; centre = (hi + lo) / 2
ortho = (a.cadrage or max(size.x, size.y, size.z)) * a.marge
if a.focus_tete and not HEAD_BBOX:
    _h = mesures_tete(corps[0]); HEAD_BBOX = (_h['cx'] - _h['W'] / 2, _h['cx'] + _h['W'] / 2, _h['cy'] - _h['D'] / 2, _h['cy'] + _h['D'] / 2, _h['z0'], _h['z1'])
if a.focus_tete and HEAD_BBOX:
    hx0, hx1, hy0, hy1, hz0, hz1 = HEAD_BBOX
    centre = Vector(((hx0 + hx1) / 2, (hy0 + hy1) / 2, (hz0 + hz1) / 2)); ortho = max(hx1 - hx0, hz1 - hz0) * 1.5; size = Vector((0.5, 0.5, 0.5))


# --- mesure : qu'est-ce qui perce la tunique ? Rayon horizontal vers l'extérieur depuis chaque sommet de peau (tronc, hanches) et de pièces intérieures (bassin, jambes) :
# s'il ne touche pas la tunique, le sommet est dehors. Par image ; résumé par catégorie et par bande de hauteur (pour LOCALISER les fentes). ---
if a.mesure_percee:
    from mathutils.bvhtree import BVHTree
    tun = next(o for o in coques if o.name == 'tunique')
    interieurs = [('peau', corps[0])] + [(o.name.split('_')[0], o) for o in coques if o.name == 'bassin' or o.name.startswith('jambe_')]
    zone_t = {'Hips', 'Spine', 'Spine01', 'Spine02', 'LeftUpLeg', 'RightUpLeg'}
    noms_c = [vg.name for vg in corps[0].vertex_groups]
    idx_peau = [v.index for v in corps[0].data.vertices if len(v.groups) and noms_c[max(v.groups, key=lambda x: x.weight).group] in zone_t]
    cumul = {}; bandes = {}; pire = {}; petit = {}
    for f in range(debut, fin + 1, 2):
        scene.frame_set(f); dg = bpy.context.evaluated_depsgraph_get()
        ev_t = tun.evaluated_get(dg); mt = ev_t.to_mesh(); Mt = ev_t.matrix_world
        pts_t = [Mt @ v.co for v in mt.vertices]
        bvh = BVHTree.FromPolygons(pts_t, [tuple(p.vertices) for p in mt.polygons])
        zmin = min(q.z for q in pts_t); zmax = max(q.z for q in pts_t); hh = zmax - zmin
        z0, z1 = zmin + 0.03 * hh, zmax - 0.10 * hh      # on ignore l'ourlet (sortie normale des jambes) et le cou
        axe = sum(pts_t, Vector()) / len(pts_t)
        for nom, o in interieurs:
            ev = o.evaluated_get(dg); me_ = ev.to_mesh(); M = ev.matrix_world
            indices = idx_peau if nom == 'peau' else range(len(me_.vertices))
            # échantillons : sommets + centres de faces (un croissant visible peut n'être qu'une FACE entre deux sommets « dedans »)
            echant = [M @ me_.vertices[i].co for i in indices]
            if nom != 'peau': echant += [M @ p_.center for p_ in me_.polygons]
            dedans = dehors = 0
            for q in echant:
                if not (z0 < q.z < z1): continue
                d = Vector((q.x - axe.x, q.y - axe.y, 0)); d = d.normalized() if d.length > 1e-6 else Vector((1, 0, 0))
                if bvh.ray_cast(q, d)[0] is None:
                    dehors += 1
                    # bande de hauteur (0 = ourlet, 9 = haut) × secteur (devant/dos/côté : y petit = face)
                    b = int(10 * (q.z - zmin) / hh); sect = 'devant' if d.y < -0.5 else ('dos' if d.y > 0.5 else 'cote')
                    bandes[(nom, b, sect)] = bandes.get((nom, b, sect), 0) + 1
                else:
                    dedans += 1
                    h_ = bvh.ray_cast(q, d); jeu = h_[3]
                    if jeu < petit.get(nom, (9e9,))[0]: petit[nom] = (jeu, q.z, 'devant' if d.y < -0.5 else ('dos' if d.y > 0.5 else 'cote'))
            c = cumul.setdefault(nom, []); c.append(100.0 * dehors / max(1, dedans + dehors))
            ev.to_mesh_clear()
        ev_t.to_mesh_clear()
    for nom, l in cumul.items():
        print(f"PERCEE[{nom}]: pire {max(l):.1f} % moyenne {sum(l)/len(l):.1f} % ({len(l)} images)")
    for nom, (jeu, zq, sect) in petit.items(): print(f"PERCEE_JEU[{nom}]: plus petit jeu sous la tunique {jeu*1000:.1f} mm (z={zq:.3f}, {sect})")
    for (nom, b, sect), n in sorted(bandes.items(), key=lambda kv: -kv[1])[:8]:
        print(f"PERCEE_ZONE: {nom} bande {b}/9 {sect} : {n} sommets (cumul des images)")
    sys.exit(0)

# --- mesure : la peau perce-t-elle la jupe ? Rayon horizontal vers l'extérieur depuis chaque sommet de jambe/bassin : s'il ne touche pas la jupe, le sommet est dehors ---
if a.mesure_jupe:
    from mathutils.bvhtree import BVHTree
    jup = next(o for o in coques if o.name.startswith('jupe'))
    jbm = [o for o in corps if o is corps[0]][0]
    noms_c = [vg.name for vg in jbm.vertex_groups]
    zone_g = {'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'}
    idx = [v.index for v in jbm.data.vertices if len(v.groups) and noms_c[max(v.groups, key=lambda x: x.weight).group] in zone_g]
    pires = []
    for f in range(debut, fin + 1, 2):
        scene.frame_set(f); dg = bpy.context.evaluated_depsgraph_get()
        ev_j = jup.evaluated_get(dg); ev_c = jbm.evaluated_get(dg)
        mj = ev_j.to_mesh(); mc = ev_c.to_mesh()
        bvh = BVHTree.FromPolygons([ev_j.matrix_world @ v.co for v in mj.vertices], [tuple(p.vertices) for p in mj.polygons])
        zmin = min((ev_j.matrix_world @ v.co).z for v in mj.vertices) + 0.02; zmax = max((ev_j.matrix_world @ v.co).z for v in mj.vertices) - 0.02
        axe = sum(((ev_j.matrix_world @ v.co) for v in mj.vertices), Vector()) / len(mj.vertices)
        dedans = dehors = d_haut = t_haut = 0
        seuil_haut = zmin + 0.35 * (zmax - zmin)  # au-dessus : un sommet de jambe hors de la jupe est un vrai défaut (sous cette ligne il s'agit de la sortie normale par l'ourlet)
        for i in idx:
            q = ev_c.matrix_world @ mc.vertices[i].co
            if not (zmin < q.z < zmax): continue
            d = Vector((q.x - axe.x, q.y - axe.y, 0)); d = d.normalized() if d.length > 1e-6 else Vector((1, 0, 0))
            hit = bvh.ray_cast(q, d)
            if hit[0] is None: dehors += 1
            else: dedans += 1
            if q.z > seuil_haut:
                t_haut += 1; d_haut += 1 if hit[0] is None else 0
        ev_j.to_mesh_clear(); ev_c.to_mesh_clear()
        tot = max(1, dedans + dehors); pires.append((100.0 * dehors / tot, f, dehors, tot, 100.0 * d_haut / max(1, t_haut)))
    pc = max(pires)
    ph = max(pires, key=lambda x: x[4])
    print(f"PERCEE: tout : pire {pc[0]:.1f} % (image {pc[1]}), moyenne {sum(x[0] for x in pires)/len(pires):.1f} % | PARTIE HAUTE : pire {ph[4]:.1f} % (image {ph[1]}), moyenne {sum(x[4] for x in pires)/len(pires):.1f} %")
    sys.exit(0)

if _expr:
    _peau = json.loads(a.coiffure).get('peau') if a.coiffure else os.environ.get('PEAU')   # sinon : teint lu dans la texture courante
    superposer_expression(corps[0], _expr, _peau)

pivot = bpy.data.objects.new('Pivot', None); scene.collection.objects.link(pivot)
for o in [arm] + corps:
    if o.parent is None:
        o.parent = pivot
cam_d = bpy.data.cameras.new('Cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = ortho
cam = bpy.data.objects.new('Cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
T = math.radians(a.tilt); D = max(size) * 6 + 10
cam.location = (centre.x, centre.y - D * math.cos(T), centre.z + D * math.sin(T)); cam.rotation_euler = (math.pi / 2 - T, 0, 0)
print(f'CADRAGE: centre=({centre.x:.4f},{centre.y:.4f},{centre.z:.4f}) ortho={ortho:.4f} res={a.res}')
pivot.location = centre
if a.echelle != 1.0:  # le cadrage reste celui de l'adulte : l'enfant paraît plus petit ; les pieds restent au même niveau
    pivot.scale = (a.echelle, a.echelle, a.echelle)
    pivot.location.z = lo.z + a.echelle * size.z / 2
bpy.context.view_layer.update()
for o in [arm] + corps:
    if o.parent is pivot: o.matrix_parent_inverse = pivot.matrix_world.inverted()

world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (1, 1, 1, 1)
def soleil(nom, energie, rot, couleur=(1, 1, 1)):
    d = bpy.data.lights.new(nom, 'SUN'); d.energy = energie; d.color = couleur
    o = bpy.data.objects.new(nom, d); scene.collection.objects.link(o); o.rotation_euler = tuple(math.radians(v) for v in rot); return o
if a.style == 'jeu':
    bg.inputs[1].default_value = 0.35  # ambiance modérée
    soleil('Cle', 2.8, (50, 0, -40), (1.0, 0.96, 0.9))        # clé chaude, en haut à gauche (baissée : à 4,2 les peaux claires brûlaient)
    soleil('Remplissage', 1.2, (65, 0, 140), (0.88, 0.93, 1.0))  # remplissage froid, de l'autre côté : relève les peaux foncées
    soleil('ContreJour', 1.8, (115, 0, 20), (1.0, 1.0, 1.0))   # contre-jour : liseré brillant sur les contours
    # matériaux brillants (aspect « rendu 3D glacé » des sprites du jeu)
    for mat in bpy.data.materials:
        if mat.use_nodes:
            for n in mat.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    # brillance : tissu et peau assez mats pour ne pas paraître en plastique, reflets doux (mesuré : trop brillant → « chocolat »)
                    n.inputs['Roughness'].default_value = min(n.inputs['Roughness'].default_value, 0.6)
                    for nom_e in ('Specular IOR Level', 'Specular'):
                        if nom_e in n.inputs: n.inputs[nom_e].default_value = 0.45
else:
    bg.inputs[1].default_value = 0.45
    soleil('Sun', 3.5, (50, 0, -40))
for moteur in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try: scene.render.engine = moteur; break
    except TypeError: continue
scene.render.resolution_x = scene.render.resolution_y = a.res; scene.render.resolution_percentage = 100
if a.style == 'jeu':
    try: scene.eevee.taa_render_samples = 96
    except Exception: pass
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
try: scene.view_settings.view_transform = 'Standard'
except TypeError: pass

os.makedirs(a.out, exist_ok=True)
dirs = [int(x) for x in a.dirs_liste.split(',')] if a.dirs_liste else list(range(a.dirs))
n = 0
for d in dirs:
    pivot.rotation_euler.z = d * 2 * math.pi / a.dirs
    for f in range(debut, fin + 1, a.pas):
        scene.frame_set(f)
        scene.render.filepath = os.path.join(a.out, f'{a.prefixe}_d{d:02d}_{f:04d}.png')
        bpy.ops.render.render(write_still=True); n += 1
print(f'RENDU:{n} images, cadrage {ortho:.3f}, sujet {size.x:.2f}x{size.y:.2f}x{size.z:.2f}, frames {debut}-{fin}')
