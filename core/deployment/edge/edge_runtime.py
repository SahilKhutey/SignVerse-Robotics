class EdgeRuntime:

    def __init__(self, device_id):

        self.device_id = device_id
        self.running = False

    def start(self):

        self.running = True
        return f"Edge runtime started on {self.device_id}"

    def execute_model(self, model, input_data):

        return model(input_data)
