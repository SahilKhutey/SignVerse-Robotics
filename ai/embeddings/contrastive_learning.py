import torch
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
