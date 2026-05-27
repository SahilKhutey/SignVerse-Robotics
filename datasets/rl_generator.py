import h5py
import numpy as np
import os

def generate_rl_dataset(observations, actions, rewards, next_observations, output_path):
    '''
    Write strict {obs, action, reward, next_obs} into an HDF5 dataset for RL.
    '''
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with h5py.File(output_path, 'w') as f:
        f.create_dataset('observations', data=np.array(observations, dtype=np.float32))
        f.create_dataset('actions', data=np.array(actions, dtype=np.float32))
        f.create_dataset('rewards', data=np.array(rewards, dtype=np.float32))
        f.create_dataset('next_observations', data=np.array(next_observations, dtype=np.float32))
    return output_path
