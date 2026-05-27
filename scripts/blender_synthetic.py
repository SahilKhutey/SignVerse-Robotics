import os
import math
import random

try:
    import bpy
    BLENDER_ENV = True
except ImportError:
    BLENDER_ENV = False

def generate_synthetic_data(output_dir="/tmp/signverse_synthetic", num_samples=10):
    if not BLENDER_ENV:
        print("[WARNING] Not running inside Blender env. Cannot execute bpy commands.")
        return

    print(f"Generating {num_samples} synthetic 3D robot frames...")
    
    # Ensure camera exists
    if 'Camera' not in bpy.data.objects:
        bpy.ops.object.camera_add(location=(0, -5, 2))
        bpy.context.scene.camera = bpy.context.object
        
    cam = bpy.data.objects['Camera']
    
    # Iterate and render
    for i in range(num_samples):
        # Randomize camera position to generate robust ML dataset
        cam.location.x = random.uniform(-2, 2)
        cam.location.y = random.uniform(-6, -4)
        cam.location.z = random.uniform(1, 4)
        
        cam.rotation_euler[0] = math.radians(random.uniform(60, 90))
        
        # Render
        bpy.context.scene.render.filepath = os.path.join(output_dir, f"frame_{i:04d}.png")
        bpy.ops.render.render(write_still=True)
        
    print("Synthetic Generation Complete.")

if __name__ == '__main__':
    generate_synthetic_data()
