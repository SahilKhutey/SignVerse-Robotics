import threading
import time

try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import String
    ROS_AVAILABLE = True
except ImportError:
    ROS_AVAILABLE = False
    class Node: pass

class ROS2Bridge(Node if ROS_AVAILABLE else object):
    def __init__(self):
        self.is_initialized = False
        if ROS_AVAILABLE:
            super().__init__('signverse_ros_bridge')
            self.publisher_ = self.create_publisher(String, '/cmd_vel', 10)
        
    def initialize(self):
        if not ROS_AVAILABLE:
            print("[ROS2Bridge] rclpy not found. Running in mock mode.")
            self.is_initialized = True
            return
            
        rclpy.init(args=None)
        self.is_initialized = True
        # Run ROS spin in background thread so FastAPI isn't blocked
        self._spin_thread = threading.Thread(target=self._spin, daemon=True)
        self._spin_thread.start()

    def _spin(self):
        rclpy.spin(self)

    def publish_command(self, command: dict):
        if not ROS_AVAILABLE:
            print(f"[ROS2Bridge Mock] Publishing to ROS: {command}")
            return
        msg = String()
        msg.data = str(command)
        self.publisher_.publish(msg)

    def shutdown(self):
        if ROS_AVAILABLE and self.is_initialized:
            self.destroy_node()
            rclpy.shutdown()
