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
    
    for f in frames:
        row = []
        trans = f.get("translation", [0.0, 0.0, 0.0])
        # ROOT node channels: Xposition Yposition Zposition Zrotation Yrotation Xrotation
        row.extend([f"{trans[0]:.6f}", f"{trans[1]:.6f}", f"{trans[2]:.6f}", "0.0", "0.0", "0.0"])
        
        joints = f.get("joints", {})
        def get_joint_values(node):
            vals = []
            if node != root_node:
                j_val = joints.get(node, 0.0)
                vals.extend([f"{j_val:.6f}", "0.0", "0.0"])
            for child in hierarchy_dict.get(node, []):
                vals.extend(get_joint_values(child))
            return vals
            
        row.extend(get_joint_values(root_node))
        bvh_content += " ".join(row) + "\n"
        
    with open(output_path, 'w') as file:
        file.write(bvh_content)
