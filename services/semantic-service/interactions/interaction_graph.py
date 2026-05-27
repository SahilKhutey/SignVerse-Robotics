def build_interaction_graph(person_id, object_name, hand):
    return {
        "person": person_id,
        "interacts_with": object_name,
        "using": hand
    }
