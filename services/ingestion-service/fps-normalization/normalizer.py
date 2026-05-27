import numpy as np

class FPSNormalizer:
    def __init__(self, target_fps=30):
        self.target_fps = target_fps
        
    def decimate_frames(self, original_fps, total_frames):
        '''
        Returns a boolean mask of which frame indices to keep to hit target_fps.
        '''
        if original_fps <= self.target_fps:
            return [True] * total_frames
            
        ratio = self.target_fps / original_fps
        mask = []
        accumulator = 0.0
        
        for i in range(total_frames):
            accumulator += ratio
            if accumulator >= 1.0:
                mask.append(True)
                accumulator -= 1.0
            else:
                mask.append(False)
                
        return mask
