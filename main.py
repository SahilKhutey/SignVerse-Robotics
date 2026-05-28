import numpy as np
import time
from core.os.kernel.signverse_kernel import SignVerseKernel

def run_os():
    print("Booting SignVerse OS...")
    kernel = SignVerseKernel()
    
    print("Starting Main Loop (Simulated)...")
    for cycle in range(5):
        print(f"Tick {cycle + 1}/5")
        # Generate dummy camera frame
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Run OS tick
        success = kernel.tick(dummy_frame)
        if not success:
            print("Kernel tick failed!")
            break
            
        time.sleep(0.1) # Simulate 10 FPS
        
    print("Shutting down...")
    kernel.shutdown()
    print("OS Terminated gracefully.")

if __name__ == "__main__":
    run_os()
