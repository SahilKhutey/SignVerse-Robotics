import torch
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
