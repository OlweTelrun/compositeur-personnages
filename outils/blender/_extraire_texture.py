import bpy, sys
glb, out = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
img = bpy.data.images['Image_0']; img.filepath_raw = out; img.file_format = 'PNG'; img.save()
