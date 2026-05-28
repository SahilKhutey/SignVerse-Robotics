class MotionDataset:

    def __init__(self, dataset_id):

        self.dataset_id = dataset_id
        self.data = []

    def add(self, entry):

        self.data.append(entry)

    def get_all(self):

        return self.data
