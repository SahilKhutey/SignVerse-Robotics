import collections
import json
try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False

class TelemetryBuffer:
    def __init__(self, max_size=10000):
        self.buffer = collections.deque(maxlen=max_size)
        self.connected = False
        
        if MQTT_AVAILABLE:
            self.mqtt = mqtt.Client()
            # self.mqtt.connect("cloud-broker.signverse.com", 1883)
            # self.connected = True
            pass

    def push(self, data: dict):
        self.buffer.append(data)

    def flush(self):
        if not self.buffer:
            return
            
        if not MQTT_AVAILABLE or not self.connected:
            # print(f"[TelemetryBuffer] Offline. Buffered {len(self.buffer)} items.")
            return
            
        # Drain buffer
        while self.buffer:
            item = self.buffer.popleft()
            self.mqtt.publish("signverse/telemetry", json.dumps(item))
