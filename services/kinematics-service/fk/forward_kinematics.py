import numpy as np

def quaternion_to_matrix(q):
    ''' Convert quaternion [w,x,y,z] to 3x3 rotation matrix '''
    w, x, y, z = q
    return np.array([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*w*z,     2*x*z + 2*w*y],
        [2*x*y + 2*w*z,     1 - 2*x*x - 2*z*z, 2*y*z - 2*w*x],
        [2*x*z - 2*w*y,     2*y*z + 2*w*x,     1 - 2*x*x - 2*y*y]
    ])

def solve_fk(node, local_rotations, parent_transform=np.eye(4), global_positions=None):
    '''
    Recursively calculates global positions of all joints based on their local rotations.
    local_rotations: dict mapping node name -> quaternion [w,x,y,z]
    '''
    if global_positions is None:
        global_positions = {}
        
    local_transform = np.eye(4)
    local_transform[0:3, 3] = node.offset
    
    if node.name in local_rotations:
        rot_mat = quaternion_to_matrix(local_rotations[node.name])
        local_transform[0:3, 0:3] = rot_mat
        
    global_transform = parent_transform @ local_transform
    global_positions[node.name] = global_transform[0:3, 3]
    
    for child in node.children:
        solve_fk(child, local_rotations, global_transform, global_positions)
        
    return global_positions
