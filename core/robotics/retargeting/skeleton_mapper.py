class SkeletonMapper:

    def map_joints(self, human, robot):

        mapping = {}

        for joint in human:

            mapping[joint] = robot.get(joint, None)

        return mapping
