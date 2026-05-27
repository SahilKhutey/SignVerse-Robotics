import torch
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
