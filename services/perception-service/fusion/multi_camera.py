import numpy as np

def triangulate_dlt(proj_matrices, points_2d):
    '''
    Direct Linear Transformation (DLT) for multi-view triangulation.
    proj_matrices: List of 3x4 projection matrices (K * [R|t]) for N cameras.
    points_2d: List of (x, y) tuples representing the landmark in each camera view.
    Returns: 3D point (X, Y, Z)
    '''
    if len(proj_matrices) < 2 or len(proj_matrices) != len(points_2d):
        raise ValueError("Requires at least 2 views and matching number of projection matrices/points.")
        
    A = []
    for P, pt in zip(proj_matrices, points_2d):
        x, y = pt[0], pt[1]
        A.append(x * P[2, :] - P[0, :])
        A.append(y * P[2, :] - P[1, :])
        
    A = np.array(A)
    # Solve A * X = 0 using SVD
    U, S, Vh = np.linalg.svd(A)
    X = Vh[-1, :]
    
    # De-homogenize
    X_3d = X[:3] / X[3]
    return X_3d
