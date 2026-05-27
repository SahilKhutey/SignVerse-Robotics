import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False

class VectorEngine:
    def __init__(self, host="localhost", port=6333, collection_name="signverse_embeddings"):
        self.collection_name = collection_name
        if QDRANT_AVAILABLE:
            self.client = QdrantClient(host=host, port=port)
            self._ensure_collection()
        else:
            logger.warning("QdrantClient not installed. VectorEngine running in MOCK mode.")

    def _ensure_collection(self):
        try:
            collections = self.client.get_collections().collections
            if not any(c.name == self.collection_name for c in collections):
                logger.info(f"Creating Qdrant Collection: {self.collection_name}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=512, distance=Distance.COSINE),
                )
            self._connected = True
        except Exception as e:
            logger.warning(f"Qdrant server unreachable ({e}). VectorEngine degrading to MOCK mode.")
            self._connected = False

    def insert_embedding(self, point_id: int, vector: List[float], payload: Dict[str, Any]):
        if QDRANT_AVAILABLE and getattr(self, '_connected', False):
            self.client.upsert(
                collection_name=self.collection_name,
                points=[PointStruct(id=point_id, vector=vector, payload=payload)]
            )
        logger.debug(f"Inserted high-dimensional vector {point_id} into Qdrant.")

    def search_similar(self, query_vector: List[float], limit: int = 5) -> List[Dict[str, Any]]:
        if QDRANT_AVAILABLE and getattr(self, '_connected', False):
            hits = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=limit
            )
            return [{"id": hit.id, "score": hit.score, "payload": hit.payload} for hit in hits]
        
        # Mock Response
        return [{"id": 1, "score": 0.98, "payload": {"gesture": "STOP", "video_uri": "s3://mock"}}]
