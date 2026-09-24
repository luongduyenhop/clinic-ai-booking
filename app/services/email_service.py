from email.message import EmailMessage
import aiosmtplib
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Service chịu trách nhiệm gửi email."""

    async def send_otp_email(
        self,
        recipient_email: str,
        otp_code: str,
        expires_minutes: int = 5
    ) -> None:
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning("SMTP configuration is missing. Cannot send OTP email.")
            return

        message = EmailMessage()

        # Người gửi
        from_email = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER
        from_name = settings.EMAILS_FROM_NAME
        message["From"] = f"{from_name} <{from_email}>"

        # Người nhận
        message["To"] = recipient_email

        # Tiêu đề
        message["Subject"] = "Mã xác thực OTP đăng ký tài khoản"

        # Nội dung email
        body = f"""
Xin chào,

Bạn vừa thực hiện đăng ký tài khoản trên hệ thống Clinic AI.

Mã OTP xác thực của bạn là:

    {otp_code}

Mã OTP có hiệu lực trong {expires_minutes} phút.

Vui lòng không cung cấp mã OTP này cho người khác.

Nếu bạn không thực hiện đăng ký tài khoản, hãy bỏ qua email này.

Trân trọng,
{from_name}
"""

        message.set_content(body)

        try:
            # Gmail SMTP
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                start_tls=settings.SMTP_TLS
            )
            logger.info(f"Đã gửi email OTP thành công tới {recipient_email}")
        except Exception as e:
            logger.error(f"Lỗi khi gửi email OTP: {e}")
            raise
