import numpy as np

def normalize_to_world(x, y, z, width, height):
    world_x = (x - 0.5) * width
    world_y = (y - 0.5) * height
    world_z = z * width
    return (world_x, world_y, world_z)
