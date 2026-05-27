import os

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. PyTorch Data Pipelines
write_file("ai/training/dataloader.py", """import torch
from torch.utils.data import Dataset, DataLoader
import h5py
import numpy as np
import os

class MotionDataset(Dataset):
    def __init__(self, hdf5_dir, seq_length=30):
        self.seq_length = seq_length
        self.files = [os.path.join(hdf5_dir, f) for f in os.listdir(hdf5_dir) if f.endswith('.hdf5')]
        self.data_index = []
        
        # Build index of valid sequences
        for file_idx, f in enumerate(self.files):
            with h5py.File(f, 'r') as h5:
                length = h5['motion_data'].shape[0]
                if length >= seq_length:
                    for i in range(length - seq_length + 1):
                        self.data_index.append((file_idx, i))

    def __len__(self):
        return len(self.data_index)

    def __getitem__(self, idx):
        file_idx, frame_start = self.data_index[idx]
        file_path = self.files[file_idx]
        
        with h5py.File(file_path, 'r') as h5:
            # Shape: [seq_length, 33, 3]
            sequence = h5['motion_data'][frame_start:frame_start + self.seq_length]
            
        # Flatten to [seq_length, 99] for MVP transformer input
        sequence_flat = sequence.reshape(self.seq_length, -1)
        return torch.tensor(sequence_flat, dtype=torch.float32)

def create_dataloader(hdf5_dir, batch_size=32, seq_length=30):
    dataset = MotionDataset(hdf5_dir, seq_length)
    return DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=4)
""")

# 2. Complete Training Loops
write_file("ai/training/trainer.py", """import torch
import torch.nn as nn
import torch.optim as optim
import os

class ModelTrainer:
    def __init__(self, model, dataloader, lr=1e-4, device='cuda'):
        self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        self.model = model.to(self.device)
        self.dataloader = dataloader
        self.optimizer = optim.AdamW(self.model.parameters(), lr=lr)
        self.criterion = nn.MSELoss() # Assuming Auto-Encoder reconstruction for now
        
    def train(self, epochs, save_dir="checkpoints"):
        os.makedirs(save_dir, exist_ok=True)
        self.model.train()
        
        for epoch in range(epochs):
            total_loss = 0
            for batch_idx, data in enumerate(self.dataloader):
                data = data.to(self.device)
                
                self.optimizer.zero_grad()
                
                # Auto-encoding loop: predict self
                output = self.model(data)
                loss = self.criterion(output, data)
                
                loss.backward()
                # Gradient clipping to prevent exploding gradients in Transformers
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                self.optimizer.step()
                
                total_loss += loss.item()
                
            avg_loss = total_loss / len(self.dataloader)
            print(f"Epoch {epoch+1}/{epochs} - Loss: {avg_loss:.4f}")
            
            # Save checkpoint
            if (epoch + 1) % 10 == 0:
                torch.save(self.model.state_dict(), os.path.join(save_dir, f"model_epoch_{epoch+1}.pt"))
                
        torch.save(self.model.state_dict(), os.path.join(save_dir, "model_final.pt"))
        print("Training complete.")
""")

# 3. Inference & Generation Engine
write_file("ai/inference/engine.py", """import torch
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
""")

# 4. Top-Level Execution Scripts
write_file("scripts/run_training.py", """import argparse
import sys
import os

# Add AI module to path
sys.path.append(os.path.join(os.path.dirname(__file__), "../ai"))

from training.dataloader import create_dataloader
from training.trainer import ModelTrainer
import torch.nn as nn

# Dummy model for executable completeness
class DummyAutoEncoder(nn.Module):
    def __init__(self, input_dim=99, hidden_dim=256):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, input_dim)
    def forward(self, x):
        return self.fc2(torch.relu(self.fc1(x)))

def main():
    parser = argparse.ArgumentParser(description="Sign-Verse Intelligence Trainer")
    parser.add_argument("--data-dir", type=str, default="../storage/datasets", help="Path to HDF5 datasets")
    parser.add_argument("--epochs", type=int, default=100, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    args = parser.parse_args()
    
    print(f"Initializing DataLoader from {args.data_dir}...")
    os.makedirs(args.data_dir, exist_ok=True) # Ensure it exists so it doesn't crash if empty
    
    # Normally we would load the true MotionTransformer here
    model = DummyAutoEncoder()
    
    print("Loading datasets...")
    # This will return empty if no hdf5 files exist yet, but it initializes successfully
    dataloader = create_dataloader(args.data_dir, batch_size=args.batch_size)
    
    print(f"Starting Training Loop. Epochs: {args.epochs}, Batch Size: {args.batch_size}, LR: {args.lr}")
    trainer = ModelTrainer(model, dataloader, lr=args.lr)
    
    if len(dataloader) > 0:
        trainer.train(epochs=args.epochs, save_dir="../ai/checkpoints")
    else:
        print("WARNING: No datasets found in data-dir. Exiting cleanly.")

if __name__ == "__main__":
    main()
""")

print("Machine Learning Programs implemented.")
