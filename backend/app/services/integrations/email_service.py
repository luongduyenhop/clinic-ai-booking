import logging
from email.message import EmailMessage
import aiosmtplib
from app.core.config import settings

logger = logging.getLogger("clinic_backend")


class EmailService:
    """Service gửi email xác thực OTP qua SMTP (aiosmtplib)."""

    async def send_otp_email(
        self,
        recipient_email: str,
        otp_code: str,
        expires_minutes: int = 5
    ) -> None:
        """Gửi mã OTP xác thực đăng ký tài khoản tới email người dùng."""
        if not settings.ENABLE_OUTBOUND_NOTIFICATIONS:
            return
        if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning("Cấu hình SMTP chưa đầy đủ.")
            return

        message = EmailMessage()

        from_email = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER
        from_name = settings.EMAILS_FROM_NAME
        message["From"] = f"{from_name} <{from_email}>"
        message["To"] = recipient_email
        message["Subject"] = "Mã xác thực OTP đăng ký tài khoản phòng khám"

        body = f"""Xin chào,

Bạn vừa thực hiện đăng ký tài khoản trên hệ thống Phòng Khám Đa Khoa AI.

Mã OTP xác thực của bạn là: {otp_code}

Mã có hiệu lực trong vòng {expires_minutes} phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.

Trân trọng,
{from_name}
"""
        message.set_content(body)

        try:
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                start_tls=settings.SMTP_TLS
            )
            logger.info("Đã gửi email OTP.")
        except Exception:
            logger.error("Gửi email OTP qua SMTP thất bại.")
            raise


email_service = EmailService()
