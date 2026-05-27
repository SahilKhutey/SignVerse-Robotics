import numpy as np

def bone_vector(parent, child):
    return np.array([
        child["x"] - parent["x"],
        child["y"] - parent["y"],
        child["z"] - parent["z"]
    ])
