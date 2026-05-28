class SkillMemory:

    def __init__(self):

        self.skills = {}

    def store(self, name, skill):

        self.skills[name] = skill

    def get(self, name):

        return self.skills.get(name, None)
