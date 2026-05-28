import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from core.learning.models.behavior_cloning import BehaviorCloningMLP
from core.learning.datasets.teleop_dataset import TeleopDataset

def train():
    print("=======================================")
    print(" SIGNVERSE ML: BEHAVIOR CLONING PIPELINE")
    print("=======================================")
    
    # 1. Hyperparameters
    batch_size = 32
    learning_rate = 0.001
    epochs = 10
    
    # 2. Load Dataset
    print("[1/4] Loading Teleoperation Dataset from SQLite...")
    dataset = TeleopDataset(db_path="datasets/raw/teleoperation.db")
    
    if len(dataset) == 0:
        print("ERROR: Dataset is empty. Please run 'python scripts/data_collector.py' to record human motions first.")
        return
        
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    
    # 3. Initialize Model
    print("[2/4] Initializing Neural Network (BehaviorCloningMLP)...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = BehaviorCloningMLP().to(device)
    
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    # 4. Training Loop
    print(f"[3/4] Starting Training on {device}...")
    model.train()
    
    for epoch in range(epochs):
        epoch_loss = 0.0
        for batch_x, batch_y in dataloader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            
            # Forward pass
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            
        avg_loss = epoch_loss / len(dataloader)
        print(f"Epoch [{epoch+1}/{epochs}] | MSE Loss: {avg_loss:.6f}")
        
    # 5. Save Checkpoint
    print("[4/4] Saving Model Checkpoint...")
    checkpoint_dir = "models/checkpoints"
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    save_path = os.path.join(checkpoint_dir, "bc_model.pth")
    torch.save(model.state_dict(), save_path)
    print(f"SUCCESS: Behavior Cloning Model saved to {save_path}")

if __name__ == "__main__":
    train()
