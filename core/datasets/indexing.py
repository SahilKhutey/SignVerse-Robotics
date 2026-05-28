class DatasetIndexer:

    def index(self, dataset):

        index = {}

        for i, item in enumerate(dataset):

            index[i] = item

        return index
