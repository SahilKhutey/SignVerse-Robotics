import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Contrastive Latent Embeddings
write_file("ai/embeddings/contrastive_learning.py", """import torch
import torch.nn as nn
import torch.nn.functional as F

class MotionEmbeddingNetwork(nn.Module):
    def __init__(self, input_dim=99, hidden_dim=256, output_dim=512):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)
        self.fc3 = nn.Linear(hidden_dim, output_dim)
        
    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = self.fc3(x)
        # Normalize for cosine similarity in Qdrant
        return F.normalize(x, p=2, dim=1)

def compute_triplet_loss(anchor, positive, negative, margin=1.0):
    '''
    Trains the embedding space so similar motions (positive) are closer to the anchor 
    than dissimilar motions (negative) by at least 'margin'.
    '''
    loss_fn = nn.TripletMarginLoss(margin=margin, p=2)
    return loss_fn(anchor, positive, negative)
""")

# 2. Auto-Regressive Action Decoder
write_file("ai/transformers/action_decoder.py", """import torch
import torch.nn as nn
import math

class CausalMotionDecoder(nn.Module):
    def __init__(self, vocab_size, d_model=256, nhead=8, num_layers=4):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        
        decoder_layer = nn.TransformerDecoderLayer(d_model=d_model, nhead=nhead)
        self.transformer_decoder = nn.TransformerDecoder(decoder_layer, num_layers=num_layers)
        self.fc_out = nn.Linear(d_model, vocab_size)
        
    def generate_square_subsequent_mask(self, sz):
        '''
        Creates a causal mask ensuring the model cannot look into the future.
        '''
        mask = (torch.triu(torch.ones(sz, sz)) == 1).transpose(0, 1)
        mask = mask.float().masked_fill(mask == 0, float('-inf')).masked_fill(mask == 1, float(0.0))
        return mask
        
    def forward(self, tgt, memory, tgt_mask=None):
        tgt_emb = self.embedding(tgt) * math.sqrt(tgt.shape[-1])
        
        if tgt_mask is None:
            tgt_mask = self.generate_square_subsequent_mask(tgt.size(0)).to(tgt.device)
            
        output = self.transformer_decoder(tgt_emb, memory, tgt_mask=tgt_mask)
        return self.fc_out(output)
""")

# 3. PPO Reinforcement Learning Agent
write_file("ai/models/ppo_agent.py", """import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F

class ActorCritic(nn.Module):
    def __init__(self, state_dim, action_dim, hidden_dim=256):
        super().__init__()
        
        # Actor network (Policy)
        self.actor = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, action_dim),
            nn.Softmax(dim=-1) # Assuming discrete actions / tokens for MVP
        )
        
        # Critic network (Value)
        self.critic = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 1)
        )
        
    def forward(self, state):
        action_probs = self.actor(state)
        state_value = self.critic(state)
        return action_probs, state_value

class PPOAgent:
    def __init__(self, state_dim, action_dim, lr=3e-4, gamma=0.99, clip_ratio=0.2):
        self.policy = ActorCritic(state_dim, action_dim)
        self.optimizer = optim.Adam(self.policy.parameters(), lr=lr)
        self.gamma = gamma
        self.clip_ratio = clip_ratio
        
    def update(self, states, actions, log_probs_old, returns, advantages):
        '''
        Core Proximal Policy Optimization update step using surrogate loss.
        '''
        action_probs, state_values = self.policy(states)
        
        # Calculate policy ratio
        action_dists = torch.distributions.Categorical(action_probs)
        log_probs = action_dists.log_prob(actions)
        ratios = torch.exp(log_probs - log_probs_old)
        
        # Clipped surrogate objective
        surr1 = ratios * advantages
        surr2 = torch.clamp(ratios, 1.0 - self.clip_ratio, 1.0 + self.clip_ratio) * advantages
        actor_loss = -torch.min(surr1, surr2).mean()
        
        critic_loss = F.mse_loss(state_values.squeeze(), returns)
        
        loss = actor_loss + 0.5 * critic_loss
        
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()
""")

# 4. Episodic Replay Buffer
write_file("ai/memory/episodic_buffer.py", """import numpy as np
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
""")

print("Advanced Intelligence Stack Modules implemented.")
