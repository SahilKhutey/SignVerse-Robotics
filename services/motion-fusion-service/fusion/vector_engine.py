class VectorEngine:
    def __init__(self):
        self.history = {}

    def update_vectors(self, track_id, joint_name, current_x, current_y, dt):
        key = f"{track_id}_{joint_name}"
        
        if key not in self.history:
            self.history[key] = {
                "x": current_x, "y": current_y,
                "vx": 0.0, "vy": 0.0
            }
            return {"x": 0.0, "y": 0.0}, {"x": 0.0, "y": 0.0}

        prev = self.history[key]
        
        if dt > 0:
            vx = (current_x - prev["x"]) / dt
            vy = (current_y - prev["y"]) / dt
            
            ax = (vx - prev["vx"]) / dt
            ay = (vy - prev["vy"]) / dt
        else:
            vx, vy, ax, ay = 0.0, 0.0, 0.0, 0.0

        self.history[key] = {
            "x": current_x, "y": current_y,
            "vx": vx, "vy": vy
        }

        return {"x": vx, "y": vy}, {"x": ax, "y": ay}
