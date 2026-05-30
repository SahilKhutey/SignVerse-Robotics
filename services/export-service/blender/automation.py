import os

def automate_blender_retargeting(bvh_path, fbx_output_path):
    '''
    Blender Python automation script to import a skeletal BVH file,
    retarget the animations onto an FBX armature mesh, and export.
    '''
    import bpy

    # Clear existing objects in the default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # Import BVH animation path
    if not os.path.exists(bvh_path):
        raise FileNotFoundError(f"BVH file not found at: {bvh_path}")
        
    bpy.ops.import_anim.bvh(filepath=bvh_path, filter_glob="*.bvh", global_scale=1.0)
    
    # Locate the imported armature
    armatures = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']
    if not armatures:
        raise ValueError("Failed to import Armature skeleton from BVH.")
        
    armature = armatures[0]
    armature.name = "RoboticArmature"
    
    # Create output directory
    output_dir = os.path.dirname(fbx_output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        
    # Export FBX using Blender's native exporter
    bpy.ops.export_scene.fbx(
        filepath=fbx_output_path,
        use_selection=False,
        object_types={'ARMATURE'},
        bake_anim=True,
        bake_anim_use_all_actions=True,
        bake_anim_step=1.0
    )
    
    return fbx_output_path
