class DemoBuffer:

    def __init__(self):

        self.demos = []

    def add_demo(self, motion_sequence, label):

        self.demos.append({
            "motion": motion_sequence,
            "label": label
        })

    def get_all(self):

        return self.demos
