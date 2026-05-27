def clamp_joint_angle(angle, min_angle, max_angle):
    return max(min(angle, max_angle), min_angle)
