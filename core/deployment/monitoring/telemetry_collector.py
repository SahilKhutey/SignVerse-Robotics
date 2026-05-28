class TelemetryCollector:

    def collect(self, data):

        return {
            "metrics": data,
            "timestamp": "now"
        }
