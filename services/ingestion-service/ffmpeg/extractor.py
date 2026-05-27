import subprocess
import os

class FFMPEGExtractor:
    def __init__(self, output_dir="uploads/frames"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
    def extract(self, video_path, target_fps=30):
        '''
        Uses a raw FFMPEG subprocess to rip frames immensely faster than cv2.VideoCapture.
        Automatically normalizes the FPS during extraction.
        '''
        output_pattern = os.path.join(self.output_dir, "frame_%04d.jpg")
        
        command = [
            'ffmpeg',
            '-i', video_path,
            '-vf', f'fps={target_fps}',
            '-qscale:v', '2', # High quality jpeg
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            output_pattern
        ]
        
        print(f"Running FFMPEG extraction: {' '.join(command)}")
        try:
            subprocess.run(command, check=True)
            # Find generated frames
            frames = sorted([os.path.join(self.output_dir, f) for f in os.listdir(self.output_dir) if f.endswith('.jpg')])
            return frames
        except subprocess.CalledProcessError as e:
            print(f"FFMPEG extraction failed: {e}")
            return []
