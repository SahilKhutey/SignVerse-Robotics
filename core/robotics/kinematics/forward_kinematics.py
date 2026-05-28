import numpy as np

class ForwardKinematics:

    def compute(self, joints):

        positions = {}

        for joint in joints:

            positions[joint.name] = (
                joint.x,
                joint.y,
                joint.z
            )

        return positions
