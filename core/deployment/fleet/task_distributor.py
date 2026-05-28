class TaskDistributor:

    def distribute(self, tasks, fleet):

        return {
            "assignments": {
                robot: tasks[i % len(tasks)]
                for i, robot in enumerate(fleet)
            }
        }
