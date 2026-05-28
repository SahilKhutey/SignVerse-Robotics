import serial
import time
import math
import logging

class SerialBridge:
    def __init__(self, port="COM3", baudrate=115200):
        """
        Connects the Python OS Kernel to a physical Microcontroller.
        """
        self.port = port
        self.baudrate = baudrate
        self.connection = None
        self.is_connected = False
        
        self.logger = logging.getLogger("SerialBridge")
        self.logger.setLevel(logging.INFO)
        
    def connect(self):
        try:
            self.connection = serial.Serial(self.port, self.baudrate, timeout=0.1)
            self.is_connected = True
            self.logger.info(f"Successfully connected to hardware on {self.port} at {self.baudrate} baud.")
            time.sleep(2) # Wait for Arduino auto-reset
        except serial.SerialException as e:
            self.logger.warning(f"Could not connect to {self.port}. Running in simulation mode. ({e})")
            self.is_connected = False

    def _radians_to_degrees(self, rad, min_angle=0, max_angle=180):
        """Converts IK radians to physical servo degrees, clamped for safety."""
        deg = math.degrees(rad)
        # Shift assuming IK 0 is servo 90
        deg = deg + 90
        return int(max(min_angle, min(max_angle, deg)))

    def transmit_angles(self, q_target):
        """
        q_target: [shoulder_rad, elbow_rad, wrist_rad]
        Transmits as comma-separated string ending in newline: "90,45,180\n"
        """
        if not self.is_connected or not self.connection:
            return False
            
        try:
            # Map safety limits for typical hobby servos
            shoulder = self._radians_to_degrees(q_target[0], 0, 180)
            elbow = self._radians_to_degrees(q_target[1], 20, 160) # Tighter bound to avoid self-collision
            wrist = self._radians_to_degrees(q_target[2], 0, 180)
            
            payload = f"{shoulder},{elbow},{wrist}\n"
            self.connection.write(payload.encode('utf-8'))
            return True
        except Exception as e:
            self.logger.error(f"Hardware transmit failed: {e}")
            self.is_connected = False
            return False

    def close(self):
        if self.connection and self.is_connected:
            # Send safe home position before disconnecting
            self.connection.write("90,90,90\n".encode('utf-8'))
            time.sleep(0.5)
            self.connection.close()
            self.is_connected = False
            self.logger.info("Hardware disconnected safely.")
