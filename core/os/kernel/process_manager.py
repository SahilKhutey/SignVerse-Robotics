class ProcessManager:

    def __init__(self):

        self.processes = {}

    def create(self, pid, process):

        self.processes[pid] = process

    def kill(self, pid):

        if pid in self.processes:
            del self.processes[pid]
