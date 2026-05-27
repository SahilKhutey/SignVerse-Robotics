import numpy as np

def segment_actions(motion_sequence, velocity_threshold=0.05, min_frames=10):
    '''
    Chunk a continuous trajectory into discrete semantic segments based on root/hand velocity.
    '''
    segments = []
    current_segment = {"start_frame": 0, "end_frame": 0}
    is_moving = False
    
    for i, frame in enumerate(motion_sequence):
        # Calculate max velocity across key joints
        velocities = [np.linalg.norm(v) for k, v in frame.items() if k.endswith('_velocity')]
        max_vel = max(velocities) if velocities else 0
        
        if max_vel > velocity_threshold and not is_moving:
            is_moving = True
            current_segment["start_frame"] = i
            
        elif max_vel <= velocity_threshold and is_moving:
            is_moving = False
            current_segment["end_frame"] = i
            if (current_segment["end_frame"] - current_segment["start_frame"]) >= min_frames:
                segments.append(current_segment.copy())
                
    return segments
