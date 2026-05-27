import cv2
import torch
import numpy as np

class DepthEstimator:
    def __init__(self, model_type="MiDaS_small"):
        '''
        Loads MiDaS from Torch Hub for monocular depth estimation.
        Options: "DPT_Large", "DPT_Hybrid", "MiDaS_small"
        '''
        self.device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
        self.midas = torch.hub.load("intel-isl/MiDaS", model_type)
        self.midas.to(self.device)
        self.midas.eval()
        
        midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        if model_type == "DPT_Large" or model_type == "DPT_Hybrid":
            self.transform = midas_transforms.dpt_transform
        else:
            self.transform = midas_transforms.small_transform

    def estimate_depth(self, frame_path):
        img = cv2.imread(frame_path)
        if img is None: return None
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        input_batch = self.transform(img).to(self.device)
        
        with torch.no_grad():
            prediction = self.midas(input_batch)
            
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=img.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()
            
        output = prediction.cpu().numpy()
        
        # Normalize to 0-255 for visualization / storage
        output_normalized = cv2.normalize(output, None, 0, 255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8U)
        return output_normalized
