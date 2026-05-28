import numpy as np

class InverseKinematicsSolver:
    def __init__(self, forward_kinematics_fn):
        """
        forward_kinematics_fn: A function that takes joint angles (q) 
        and returns the end-effector Cartesian position as a numpy array [x, y, z]
        """
        self.fk_fn = forward_kinematics_fn

    def solve(self, initial_q, target_pos, bounds=None, max_iter=50, tol=1e-3):
        """
        Solves for the joint angles that reach target_pos using Damped Least Squares (Levenberg-Marquardt).
        """
        q = np.array(initial_q, dtype=float)
        target = np.array(target_pos, dtype=float)
        
        lambda_sq = 0.01  # Damping factor for stability
        
        for _ in range(max_iter):
            current_pos = self.fk_fn(q)
            error = target - current_pos
            
            error_norm = np.linalg.norm(error)
            if error_norm < tol:
                return {"converged": True, "q": q, "error": error_norm}
            
            # Approximate Jacobian using finite differences
            J = np.zeros((3, len(q)))
            delta = 1e-5
            for i in range(len(q)):
                q_plus = q.copy()
                q_plus[i] += delta
                pos_plus = self.fk_fn(q_plus)
                J[:, i] = (pos_plus - current_pos) / delta
                
            # Damped Least Squares: J^T (J J^T + lambda^2 I)^-1
            J_T = J.T
            J_pseudo = J_T @ np.linalg.inv(J @ J_T + lambda_sq * np.eye(3))
            
            dq = J_pseudo @ error
            q += dq
            
        return {
            "converged": False,
            "q": q,
            "error": np.linalg.norm(target - self.fk_fn(q))
        }
