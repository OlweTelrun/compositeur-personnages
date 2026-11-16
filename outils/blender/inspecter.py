# Inspecte un GLB riggé (Blender en arrière-plan) : objets, armature, os, maillage, matériaux, animations.
# Usage : Blender --background --python inspecter.py -- <fichier.glb>
import bpy, sys
glb = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
print('=== OBJETS')
for o in bpy.data.objects:
    extra = ''
    if o.type == 'MESH':
        me = o.data
        extra = f' sommets={len(me.vertices)} faces={len(me.polygons)} groupes_de_sommets={len(o.vertex_groups)} matériaux={[m.name for m in me.materials]} dims={tuple(round(x,3) for x in o.dimensions)}'
    if o.type == 'ARMATURE':
        extra = f' os={len(o.data.bones)}'
    print(f'{o.type:9s} {o.name}{extra}')
print('=== OS')
for o in bpy.data.objects:
    if o.type == 'ARMATURE':
        print(', '.join(b.name for b in o.data.bones))
print('=== ACTIONS', [(a.name, tuple(round(x) for x in a.frame_range)) for a in bpy.data.actions])
print('=== IMAGES', [(i.name, tuple(i.size)) for i in bpy.data.images])
