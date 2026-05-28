class MotionController:

    def execute(self, robot, motion):

        robot["state"] = motion

        return robot
