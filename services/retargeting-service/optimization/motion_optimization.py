import numpy as np

def detect_foot_contact(ankle_velocity, ankle_height, vel_thresh=0.01, height_thresh=0.02):
    return (np.linalg.norm(ankle_velocity) < vel_thresh) and (ankle_height < height_thresh)

def optimize_foot_locking(trajectory, ankle_node):
    '''
    Enforce hard constraint so ankle does not slide when in contact with ground.
    '''
    optimized = []
    locked_pos = None
    
    for i, frame in enumerate(trajectory):
        pos = frame[ankle_node]
        vel = frame.get(f"{ankle_node}_velocity", np.array([0,0,0]))
        height = pos[1] # Assuming Y is up
        
        if detect_foot_contact(vel, height):
            if locked_pos is None:
                locked_pos = np.copy(pos)
                locked_pos[1] = 0.0 # clamp to floor
            frame[ankle_node] = np.copy(locked_pos)
        else:
            locked_pos = None
            
        optimized.append(frame)
    return optimized
