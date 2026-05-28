class DockerBuilder:

    def build(self, image_name):

        return {
            "image": image_name,
            "status": "built"
        }
