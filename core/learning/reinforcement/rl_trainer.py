class RLTrainer:

    def train_step(self, policy, environment):

        state = environment.reset()

        action = policy.forward(state)

        reward = 1.0

        return {
            "state": state,
            "action": action,
            "reward": reward
        }
