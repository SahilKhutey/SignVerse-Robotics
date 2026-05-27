import json
import os

REGISTRY_FILE = "model_registry.json"

def register_model(name, version, framework, input_type, output_type):
    '''
    Maintain version control over ML weights locally.
    '''
    entry = {
        "model_name": name,
        "version": version,
        "framework": framework,
        "input_type": input_type,
        "output_type": output_type
    }
    
    registry = []
    if os.path.exists(REGISTRY_FILE):
        with open(REGISTRY_FILE, 'r') as f:
            registry = json.load(f)
            
    # Update or append
    registry = [m for m in registry if not (m['model_name'] == name and m['version'] == version)]
    registry.append(entry)
    
    with open(REGISTRY_FILE, 'w') as f:
        json.dump(registry, f, indent=2)
        
    return entry
