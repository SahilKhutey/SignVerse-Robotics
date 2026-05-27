import numpy as np

class MotionTokenizer:
    def __init__(self, bins=10):
        self.bins = bins
        
    def tokenize_motion(self, continuous_sequence):
        '''
        Convert continuous joint angles/velocities into discrete integer tokens.
        A real system uses VQ-VAE, here we use algorithmic binning.
        '''
        tokens = []
        for frame in continuous_sequence:
            # Flatten frame numericals
            vec = []
            for k, v in frame.items():
                if isinstance(v, (list, np.ndarray)):
                    vec.extend(v)
                elif isinstance(v, (int, float)):
                    vec.append(v)
            
            # Simple quantization
            for val in vec:
                # Bin -1 to 1 into `bins` discrete tokens
                binned = int(np.clip((val + 1) / 2 * self.bins, 0, self.bins - 1))
                tokens.append(f"TOK_{binned}")
        return tokens
