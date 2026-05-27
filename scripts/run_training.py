import argparse
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
