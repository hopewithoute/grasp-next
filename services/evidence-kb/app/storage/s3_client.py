import logging
from typing import Optional

import aioboto3
from botocore.exceptions import ClientError

from app.settings import get_settings

logger = logging.getLogger(__name__)


class S3Client:
    def __init__(self):
        self.settings = get_settings()
        self.session = aioboto3.Session(
            aws_access_key_id=self.settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=self.settings.S3_SECRET_ACCESS_KEY,
            region_name=self.settings.S3_REGION,
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.settings.S3_BUCKET_NAME and self.settings.S3_ACCESS_KEY_ID)

    async def upload_file_bytes(self, content: bytes, object_name: str, content_type: str = "application/pdf") -> str:
        """
        Uploads bytes to S3/R2 and returns the object key.
        """
        if not self.is_configured:
            logger.warning("S3 is not configured. Skipping upload.")
            return object_name

        async with self.session.client("s3", endpoint_url=self.settings.S3_ENDPOINT_URL) as s3:
            try:
                await s3.put_object(
                    Bucket=self.settings.S3_BUCKET_NAME,
                    Key=object_name,
                    Body=content,
                    ContentType=content_type,
                )
                logger.info(f"Successfully uploaded {object_name} to S3.")
                return object_name
            except ClientError as e:
                logger.error(f"Failed to upload to S3: {e}")
                raise

    async def generate_presigned_url(self, object_name: str, expiration: int = 3600) -> Optional[str]:
        """
        Generates a presigned URL for downloading/viewing the file.
        """
        if not self.is_configured:
            return None

        async with self.session.client("s3", endpoint_url=self.settings.S3_ENDPOINT_URL) as s3:
            try:
                url = await s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.settings.S3_BUCKET_NAME, "Key": object_name},
                    ExpiresIn=expiration,
                )
                return url
            except ClientError as e:
                logger.error(f"Failed to generate presigned URL: {e}")
                return None


s3_client = S3Client()
