from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

class EmbodiedMemory:
    def __init__(self, host='localhost', port=6333):
        self.client = QdrantClient(host=host, port=port)
        self.collection_name = "robot_experiences"
        
        # Ensure collection exists
        try:
            self.client.get_collection(self.collection_name)
        except Exception:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=512, distance=Distance.COSINE),
            )
            
    def store_experience(self, point_id, trajectory_vector, metadata):
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(id=point_id, vector=trajectory_vector.tolist(), payload=metadata)
            ]
        )
        
    def search_similar(self, trajectory_vector, limit=5):
        return self.client.search(
            collection_name=self.collection_name,
            query_vector=trajectory_vector.tolist(),
            limit=limit
        )
