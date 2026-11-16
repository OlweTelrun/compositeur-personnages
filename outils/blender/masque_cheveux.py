# Calcule, dans l'espace UV de la texture Meshy, un masque des CHEVEUX à partir de la géométrie (et non de la couleur) :
# faces dont les sommets sont majoritairement du groupe d'os Head et dont le centre est au-dessus de la ligne du front.
# Sert à recolorer des cheveux blancs/gris/blonds qu'un seuil de couleur confondrait avec le sous-vêtement gris.
# Écrit un JSON de polygones UV (le Python de Blender n'a pas PIL) : recolorer_texture.py le rasterise.
# Usage : Blender --background --python masque_cheveux.py -- corps.glb masque.json [seuil_hauteur=0.52]
import bpy, bmesh, sys, json
a = sys.argv[sys.argv.index('--') + 1:]
glb, out = a[0], a[1]; seuil = float(a[2]) if len(a) > 2 else 0.52  # 0,52 : mesuré sur la femme senior (cheveux blancs) ; 0,62 laissait des mèches aux tempes
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
corps = next(o for o in bpy.data.objects if o.type == 'MESH' and len(o.vertex_groups) > 0)
mw = corps.matrix_world; noms = [vg.name for vg in corps.vertex_groups]
bm = bmesh.new(); bm.from_mesh(corps.data); deform = bm.verts.layers.deform.active; uv = bm.loops.layers.uv.active
TETE = {'Head', 'head_end', 'headfront'}  # selon le corps, Meshy rattache la peau de la tête à l'un ou l'autre de ces os
def dom(v):
    w = v[deform]
    return noms[max(w.keys(), key=lambda k: w[k])] if len(w) else ''
tete = [mw @ v.co for v in bm.verts if dom(v) in TETE]
z0, z1 = min(p.z for p in tete), max(p.z for p in tete); zs = z0 + seuil * (z1 - z0)
polys = []
for f in bm.faces:
    if sum(1 for v in f.verts if dom(v) in TETE) >= 2 and sum((mw @ v.co).z for v in f.verts) / len(f.verts) >= zs:
        polys.append([[round(l[uv].uv.x, 5), round(l[uv].uv.y, 5)] for l in f.loops])
json.dump({'polygones': polys, 'seuil_z': zs}, open(out, 'w'))
print(f'MASQUE: {len(polys)} faces de cheveux, seuil z={zs:.3f} (tête {z0:.2f}-{z1:.2f})')
