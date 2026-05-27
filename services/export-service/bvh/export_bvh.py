def build_bvh_hierarchy(hierarchy_dict, root_node, bone_lengths):
    bvh_str = "HIERARCHY\n"
    
    def traverse(node, depth=0):
        indent = "  " * depth
        node_str = f"{indent}ROOT {node}\n" if depth == 0 else f"{indent}JOINT {node}\n"
        node_str += f"{indent}{{\n"
        
        length = bone_lengths.get(node, 1.0)
        # Simplified offset
        node_str += f"{indent}  OFFSET 0.0 {length} 0.0\n"
        node_str += f"{indent}  CHANNELS 3 Zrotation Xrotation Yrotation\n"
        
        children = hierarchy_dict.get(node, [])
        if not children:
            node_str += f"{indent}  End Site\n{indent}  {{\n{indent}    OFFSET 0.0 {length} 0.0\n{indent}  }}\n"
        else:
            for child in children:
                node_str += traverse(child, depth + 1)
                
        node_str += f"{indent}}}\n"
        return node_str
        
    bvh_str += traverse(root_node)
    return bvh_str

def export_bvh(hierarchy_dict, root_node, bone_lengths, frames, output_path):
    bvh_content = build_bvh_hierarchy(hierarchy_dict, root_node, bone_lengths)
    bvh_content += "MOTION\n"
    bvh_content += f"Frames: {len(frames)}\n"
    bvh_content += "Frame Time: 0.033333\n"
    
    # In reality, extract Euler angles from frame rotations
    for f in frames:
        bvh_content += "0.0 0.0 0.0 " * len(hierarchy_dict) + "\n"
        
    with open(output_path, 'w') as file:
        file.write(bvh_content)
