class RobotFleetManager:

    def __init__(self):

        self.fleet = {}

    def add_robot(self, robot_id, robot):

        self.fleet[robot_id] = robot

    def get_fleet(self):

        return self.fleet
