class Device:

    def __init__(self, device_id):

        self.device_id = device_id

    def send(self, data):

        return {
            "device": self.device_id,
            "data": data
        }
