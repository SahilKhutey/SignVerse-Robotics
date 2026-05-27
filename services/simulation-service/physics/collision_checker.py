class CollisionChecker:
    def __init__(self, env):
        self.env = env
        
    def check_self_intersection(self):
        '''
        Examines the MuJoCo data.ncon array to determine if two physical bodies
        are occupying the same space (e.g., hand clipping through chest).
        '''
        if not self.env.data:
            return False # Cannot check without physics engine
            
        # ncon holds the number of active contacts
        if self.env.data.ncon > 0:
            for i in range(self.env.data.ncon):
                contact = self.env.data.contact[i]
                # geom1 and geom2 are the IDs of the colliding meshes
                geom1 = contact.geom1
                geom2 = contact.geom2
                
                # In a rigorous setup, we check if geom1 and geom2 belong to the robot
                # and ignore intentional contacts (like foot hitting the floor).
                # For MVP, we flag any contact as a potential collision risk.
                return True
                
        return False
