import hashlib
import json
import time

def generate_dataset_version(metadata):
    '''
    Dynamic hashing tagged with timestamps to prevent ML data drift.
    '''
    metadata['timestamp'] = time.time()
    raw_str = json.dumps(metadata, sort_keys=True).encode('utf-8')
    dataset_hash = hashlib.sha256(raw_str).hexdigest()
    return f"dataset_v{dataset_hash[:8]}"
