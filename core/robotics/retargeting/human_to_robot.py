class HumanToRobotMapper:

    def map(self, human_skeleton):

        return {
            "robot_joints": human_skeleton,
            "mapping_type": "linear_projection"
        }
