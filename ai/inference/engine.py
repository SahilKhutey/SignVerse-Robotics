import torch
import numpy as np

class MotionInferenceEngine:
    def __init__(self, model_class, weights_path, model_kwargs, device='cuda'):
        self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        self.model = model_class(**model_kwargs).to(self.device)
        self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
        self.model.eval()
        
    def generate_motion(self, initial_pose, num_frames=30):
        '''
        Autoregressively generates future frames given a starting pose.
        initial_pose shape: [1, 99]
        '''
        generated = [initial_pose]
        current_sequence = initial_pose.unsqueeze(0).to(self.device) # [1, 1, 99]
        
        with torch.no_grad():
            for _ in range(num_frames - 1):
                # Predict next frame
                output = self.model(current_sequence)
                # Take the last predicted frame
                next_frame = output[:, -1, :] # [1, 99]
                
                generated.append(next_frame.cpu())
                
                # Append and slide window (if using fixed context length)
                next_frame_unsqueeze = next_frame.unsqueeze(1)
                current_sequence = torch.cat([current_sequence, next_frame_unsqueeze], dim=1)
                
        return torch.cat(generated, dim=0).numpy() # [num_frames, 99]
