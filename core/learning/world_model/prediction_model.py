class PredictionModel:

    def predict_next_state(self, state):

        return {
            "next_state": state,
            "confidence": 0.9
        }
