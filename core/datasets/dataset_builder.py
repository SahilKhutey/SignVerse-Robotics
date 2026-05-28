class DatasetBuilder:

    def __init__(self):

        self.samples = []

    def add_sample(self, motion, label):

        self.samples.append({
            "motion": motion,
            "label": label
        })

    def build(self):

        return {
            "dataset_size": len(self.samples),
            "data": self.samples
        }
