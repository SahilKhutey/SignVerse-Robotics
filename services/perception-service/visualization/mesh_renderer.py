import os

# Graceful degradation if trimesh/pyrender aren't installed or EGL is missing
try:
    import trimesh
    import pyrender
    import numpy as np
    PYRENDER_AVAILABLE = True
except ImportError:
    PYRENDER_AVAILABLE = False

class MeshRenderer:
    def __init__(self, resolution=(1920, 1080)):
        '''
        Headless 3D Mesh rendering context using PyRender.
        Requires EGL/OSMesa.
        '''
        self.resolution = resolution
        self.ready = False
        
        if PYRENDER_AVAILABLE:
            try:
                # EGL backend setup
                os.environ['PYOPENGL_PLATFORM'] = 'egl'
                self.renderer = pyrender.OffscreenRenderer(viewport_width=resolution[0], viewport_height=resolution[1])
                self.ready = True
            except Exception as e:
                print(f"Failed to initialize PyRender context (Likely missing EGL/Display): {e}")

    def render_mesh(self, vertices, faces, camera_pose=None):
        if not self.ready:
            # Return blank image if no renderer
            return np.zeros((self.resolution[1], self.resolution[0], 3), dtype=np.uint8)
            
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
        pr_mesh = pyrender.Mesh.from_trimesh(mesh, smooth=True)
        
        scene = pyrender.Scene(ambient_light=[0.3, 0.3, 0.3])
        scene.add(pr_mesh)
        
        # Add basic camera
        camera = pyrender.PerspectiveCamera(yfov=np.pi / 3.0, aspectRatio=1.0)
        if camera_pose is None:
            camera_pose = np.array([
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 3.0], # Push back
                [0.0, 0.0, 0.0, 1.0],
            ])
        scene.add(camera, pose=camera_pose)
        
        # Add light
        light = pyrender.DirectionalLight(color=[1.0, 1.0, 1.0], intensity=2.0)
        scene.add(light, pose=camera_pose)
        
        color, depth = self.renderer.render(scene)
        return color
