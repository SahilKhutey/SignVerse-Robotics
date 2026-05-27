import os
try:
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

class TrajectoryPlotter:
    def __init__(self, output_dir="diagnostics"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def plot_sim2real_gap(self, target_angles, actual_angles, joint_name="elbow"):
        '''
        Plots a 2D graph comparing the commanded AI angles versus the 
        actual angles the robot physically achieved in simulation (PID lag).
        '''
        if not MATPLOTLIB_AVAILABLE:
            print("Matplotlib not installed. Skipping 2D diagnostics.")
            return
            
        plt.figure(figsize=(10, 5))
        plt.plot(target_angles, label='Commanded (AI)', linestyle='--', color='blue')
        plt.plot(actual_angles, label='Simulated Reality', color='red')
        
        plt.title(f"Sim2Real Gap Analysis: {joint_name}")
        plt.xlabel("Frame")
        plt.ylabel("Angle (Radians)")
        plt.legend()
        plt.grid(True)
        
        save_path = os.path.join(self.output_dir, f"{joint_name}_gap.png")
        plt.savefig(save_path)
        plt.close()
        print(f"Diagnostic plot saved to {save_path}")
