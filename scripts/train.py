import os
import sqlite3
import json
import torch
import math
from torch.utils.data import Dataset, DataLoader

# Import Core Learning Architecture
from core.learning.policy.policy_network import PolicyNetwork
from core.learning.imitation.behavior_cloning import BehaviorCloningTrainer

class SignVerseDataset(Dataset):
    def __init__(self, db_path="datasets/raw/teleoperation.db"):
        self.db_path = db_path
        self.samples = []
        
        # Load dataset index
        if os.path.exists(self.db_path):
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            # Fetch all recorded JSON paths
            try:
                cursor.execute("SELECT json_path FROM frames")
                rows = cursor.fetchall()
                for row in rows:
                    if os.path.exists(row[0]):
                        self.samples.append(row[0])
            except sqlite3.OperationalError:
                print("Warning: Database table 'frames' not found. Dataset will be empty.")
            finally:
                conn.close()
        
        print(f"Loaded {len(self.samples)} valid samples from SQLite.")

        # In case the user hasn't run the data collector yet, create dummy data to prevent crash
        self.mock_mode = len(self.samples) == 0
        if self.mock_mode:
            print("WARNING: No data found. Generating 100 mock samples to verify the training loop.")
            self.samples = [None] * 100

    def __len__(self):
        return len(self.samples)

    def _generate_mock_item(self):
        # 132-dim state (33 landmarks * 4 values), 3-dim action
        mock_state = torch.rand(132)
        # Mock action: slightly related to state so the network can "learn" it
        mock_action = torch.tensor([
            math.sin(mock_state[0].item()), 
            math.cos(mock_state[1].item()), 
            mock_state[2].item()
        ], dtype=torch.float32)
        return mock_state, mock_action

    def __getitem__(self, idx):
        if self.mock_mode:
            return self._generate_mock_item()

        json_path = self.samples[idx]
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
                
            # Extract pose array (assuming it's a flat list or list of lists)
            pose = data.get('pose')
            if not pose:
                return self._generate_mock_item()
                
            # Flatten the pose data into a 1D list (33 landmarks * 4 coords = 132)
            flat_state = []
            for lm in pose:
                # If it's a list of [x,y,z,v]
                if isinstance(lm, list):
                    flat_state.extend(lm)
                else:
                    flat_state.append(lm)
                    
            # Ensure it's exactly 132 elements (pad or truncate)
            flat_state = (flat_state + [0.0]*132)[:132]
            state_tensor = torch.tensor(flat_state, dtype=torch.float32)
            
            # Simulate a 3-DOF expert action based on raw state values
            # (In production, this would be the actual IK solved Joint states from the DB)
            expert_action = torch.tensor([
                state_tensor[11 * 4] * 2.0,       # Shoulder X heuristic
                state_tensor[13 * 4 + 1] * 1.5,   # Elbow Y heuristic
                state_tensor[15 * 4 + 2]          # Wrist Z heuristic
            ], dtype=torch.float32)
            
            return state_tensor, expert_action
            
        except Exception as e:
            print(f"Error loading {json_path}: {e}")
            return self._generate_mock_item()

def main():
    print("Initializing SignVerse Behavior Cloning Pipeline...")
    
    # 1. Load Dataset
    dataset = SignVerseDataset()
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True)
    
    # 2. Instantiate Policy Network (State: 132, Action: 3)
    policy = PolicyNetwork(state_dim=132, action_dim=3, hidden_dim=256)
    
    # 3. Instantiate Behavior Cloning Trainer
    trainer = BehaviorCloningTrainer(policy=policy, learning_rate=1e-3)
    
    # 4. Training Loop
    epochs = 10
    print(f"Starting Training: {epochs} Epochs")
    print("-" * 40)
    
    for epoch in range(epochs):
        epoch_loss = 0.0
        batches = 0
        
        for batch_states, batch_actions in dataloader:
            loss = trainer.train_step(batch_states, batch_actions)
            epoch_loss += loss
            batches += 1
            
        avg_loss = epoch_loss / max(1, batches)
        print(f"Epoch [{epoch+1}/{epochs}] | MSE Loss: {avg_loss:.6f}")
        
    # 5. Export Model
    export_path = "core/learning/models/policy_latest.pth"
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    torch.save(policy.state_dict(), export_path)
    
    print("-" * 40)
    print(f"Training Complete. Policy weights saved to: {export_path}")

if __name__ == "__main__":
    main()
