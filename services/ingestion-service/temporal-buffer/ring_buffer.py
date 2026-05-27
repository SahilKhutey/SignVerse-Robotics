from collections import deque
import threading

class TemporalRingBuffer:
    def __init__(self, max_seconds=10, fps=30):
        '''
        Thread-safe sliding window buffer for live streams.
        Avoids RAM explosion by automatically dropping frames older than max_seconds.
        '''
        self.maxlen = int(max_seconds * fps)
        self.buffer = deque(maxlen=self.maxlen)
        self.lock = threading.Lock()
        
    def append(self, frame_data):
        with self.lock:
            self.buffer.append(frame_data)
            
    def get_snapshot(self):
        '''
        Returns a copy of the current temporal window for processing.
        '''
        with self.lock:
            return list(self.buffer)
            
    def is_full(self):
        return len(self.buffer) == self.maxlen
