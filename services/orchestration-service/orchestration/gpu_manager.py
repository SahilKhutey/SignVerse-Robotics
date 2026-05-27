import threading

class GPUManager:
    '''
    Logical GPU manager to prevent VRAM overflow when YOLO + SMPL + Transformers run concurrently.
    Uses basic semaphores for logical constraints rather than pynvml.
    '''
    def __init__(self, max_heavy_models=2):
        self.semaphore = threading.Semaphore(max_heavy_models)
        self.active_models = []
        self.lock = threading.Lock()
        
    def allocate(self, model_name, required_memory=None):
        acquired = self.semaphore.acquire(blocking=True, timeout=30.0)
        if not acquired:
            raise Exception(f"GPU allocation timed out for {model_name}")
            
        with self.lock:
            self.active_models.append(model_name)
            
        print(f"Allocated GPU for {model_name}")
        return True

    def release(self, model_name):
        with self.lock:
            if model_name in self.active_models:
                self.active_models.remove(model_name)
                self.semaphore.release()
                print(f"Released GPU from {model_name}")
