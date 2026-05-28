import uuid

class DatasetVersioning:

    def create_version(self):

        return str(uuid.uuid4())

    def tag_dataset(self, dataset, version):

        dataset["version"] = version

        return dataset
