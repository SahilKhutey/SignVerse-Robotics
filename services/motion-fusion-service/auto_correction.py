import numpy as np

def interpolate_joint(prev_pos, next_pos, alpha=0.5):
    '''
    Linear interpolation to bridge missing frames.
    '''
    p1 = np.array([prev_pos['x'], prev_pos['y'], prev_pos['z']])
    p2 = np.array([next_pos['x'], next_pos['y'], next_pos['z']])
    interpolated = p1 * (1 - alpha) + p2 * alpha
    
    return {
        'x': interpolated[0],
        'y': interpolated[1],
        'z': interpolated[2],
        'visibility': prev_pos.get('visibility', 0.5)
    }
