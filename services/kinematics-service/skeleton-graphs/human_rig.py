class SkeletonNode:
    def __init__(self, name, parent=None, offset=(0.0, 0.0, 0.0)):
        self.name = name
        self.parent = parent
        self.offset = offset
        self.children = []
        if parent:
            parent.children.append(self)

def build_human_t_pose_rig():
    '''
    Builds the standard humanoid T-Pose hierarchy for Kinematics solvers.
    '''
    root = SkeletonNode("hips")
    
    # Spine
    spine = SkeletonNode("spine", parent=root, offset=(0.0, 0.1, 0.0))
    chest = SkeletonNode("chest", parent=spine, offset=(0.0, 0.15, 0.0))
    neck = SkeletonNode("neck", parent=chest, offset=(0.0, 0.1, 0.0))
    head = SkeletonNode("head", parent=neck, offset=(0.0, 0.1, 0.0))
    
    # Left Arm
    l_shoulder = SkeletonNode("l_shoulder", parent=chest, offset=(0.15, 0.0, 0.0))
    l_elbow = SkeletonNode("l_elbow", parent=l_shoulder, offset=(0.25, 0.0, 0.0))
    l_wrist = SkeletonNode("l_wrist", parent=l_elbow, offset=(0.2, 0.0, 0.0))
    
    # Right Arm
    r_shoulder = SkeletonNode("r_shoulder", parent=chest, offset=(-0.15, 0.0, 0.0))
    r_elbow = SkeletonNode("r_elbow", parent=r_shoulder, offset=(-0.25, 0.0, 0.0))
    r_wrist = SkeletonNode("r_wrist", parent=r_elbow, offset=(-0.2, 0.0, 0.0))
    
    # Legs
    l_hip = SkeletonNode("l_hip", parent=root, offset=(0.1, -0.05, 0.0))
    l_knee = SkeletonNode("l_knee", parent=l_hip, offset=(0.0, -0.4, 0.0))
    l_ankle = SkeletonNode("l_ankle", parent=l_knee, offset=(0.0, -0.4, 0.0))
    
    r_hip = SkeletonNode("r_hip", parent=root, offset=(-0.1, -0.05, 0.0))
    r_knee = SkeletonNode("r_knee", parent=r_hip, offset=(0.0, -0.4, 0.0))
    r_ankle = SkeletonNode("r_ankle", parent=r_knee, offset=(0.0, -0.4, 0.0))
    
    return root
