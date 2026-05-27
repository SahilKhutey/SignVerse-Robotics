import json
import os

def build_universal_dataset(metadata, sequences, objects, skills, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    dataset = {
        "metadata": metadata,
        "sequences": sequences,
        "objects": objects,
        "skills": skills
    }
    out_path = os.path.join(output_dir, f"dataset_{metadata.get('id', 'raw')}.json")
    with open(out_path, 'w') as f:
        json.dump(dataset, f)
    return out_path
