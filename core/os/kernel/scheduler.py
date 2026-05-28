class Scheduler:

    def __init__(self):

        self.queue = []

    def add_task(self, task):

        self.queue.append(task)

    def run(self):

        return [task for task in self.queue]
