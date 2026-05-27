import numpy as np
import random
from collections import deque

class PrioritizedReplayBuffer:
    def __init__(self, capacity=100000, alpha=0.6):
        '''
        Prioritized Experience Replay (PER).
        Samples experiences based on TD-error priority.
        '''
        self.capacity = capacity
        self.alpha = alpha
        self.buffer = deque(maxlen=capacity)
        self.priorities = deque(maxlen=capacity)
        
    def add(self, state, action, reward, next_state, done, error=1.0):
        experience = (state, action, reward, next_state, done)
        self.buffer.append(experience)
        
        max_priority = max(self.priorities) if self.priorities else 1.0
        self.priorities.append(max_priority) # New experiences get max priority
        
    def sample(self, batch_size, beta=0.4):
        if len(self.buffer) == 0:
            return []
            
        probs = np.array(self.priorities) ** self.alpha
        probs /= probs.sum()
        
        indices = np.random.choice(len(self.buffer), batch_size, p=probs)
        
        samples = [self.buffer[idx] for idx in indices]
        
        # Importance sampling weights
        total = len(self.buffer)
        weights = (total * probs[indices]) ** (-beta)
        weights /= weights.max()
        
        return samples, indices, weights
        
    def update_priorities(self, indices, errors, offset=0.1):
        for idx, error in zip(indices, errors):
            self.priorities[idx] = abs(error) + offset
