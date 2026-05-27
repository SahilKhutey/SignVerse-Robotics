import logging
from typing import BinaryIO

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO_AVAILABLE = True
except ImportError:
    BOTO_AVAILABLE = False

class S3StorageProvider:
    def __init__(self, endpoint_url: str = "http://localhost:9000", access_key: str = "minioadmin", secret_key: str = "minioadmin", bucket_name: str = "signverse-datasets"):
        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url
        if BOTO_AVAILABLE:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key
            )
            self._ensure_bucket()
        else:
            logger.warning("Boto3 not installed. S3StorageProvider running in MOCK mode.")

    def _ensure_bucket(self):
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError:
            logger.info(f"Creating bucket {self.bucket_name}")
            self.s3_client.create_bucket(Bucket=self.bucket_name)

    def upload_video_stream(self, object_name: str, file_obj: BinaryIO) -> str:
        logger.info(f"Uploading massive video chunk to S3: {object_name}")
        if BOTO_AVAILABLE:
            self.s3_client.upload_fileobj(file_obj, self.bucket_name, object_name)
            return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
        return f"mock_s3://{self.bucket_name}/{object_name}"
