import hashlib
import time
from typing import Optional
import httpx
from app.core.config import settings

class CloudinaryService:
    def __init__(self):
        self.cloud_name = settings.CLOUDINARY_CLOUD_NAME
        self.api_key = settings.CLOUDINARY_API_KEY
        self.api_secret = settings.CLOUDINARY_API_SECRET

    def is_configured(self) -> bool:
        return bool(self.cloud_name and self.api_key and self.api_secret)

    async def upload_bytes(
        self,
        data: bytes,
        filename: Optional[str] = None,
        folder: Optional[str] = "clinic_ai",
    ) -> Optional[str]:
        if not self.is_configured():
            return None
        timestamp = int(time.time())
        to_sign_parts = []
        if folder:
            to_sign_parts.append(f"folder={folder}")
        to_sign_parts.append(f"timestamp={timestamp}")
        to_sign_str = "&".join(sorted(to_sign_parts)) + self.api_secret
        signature = hashlib.sha1(to_sign_str.encode("utf-8")).hexdigest()

        form_data = {
            "api_key": self.api_key,
            "timestamp": str(timestamp),
            "signature": signature,
        }
        if folder:
            form_data["folder"] = folder

        fname = filename or "image.png"
        files = {
            "file": (fname, data, "image/png"),
        }
        url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/upload"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, data=form_data, files=files)
                if res.status_code == 200:
                    body = res.json()
                    return body.get("secure_url") or body.get("url")
        except Exception:
            return None
        return None

cloudinary_service = CloudinaryService()
