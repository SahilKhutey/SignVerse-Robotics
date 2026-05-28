class BlenderExporter:

    def export(self, motion_data, path):

        with open(path, "w") as f:

            f.write(str(motion_data))
