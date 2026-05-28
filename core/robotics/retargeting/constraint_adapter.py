class ConstraintAdapter:

    def apply_constraints(self, joint_angles):

        return [
            max(min(a, 180), -180)
            for a in joint_angles
        ]
