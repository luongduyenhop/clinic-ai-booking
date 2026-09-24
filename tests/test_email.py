import asyncio
import os
from dotenv import load_dotenv

# Tải cấu hình từ .env trước khi import bất kỳ component nào của ứng dụng
load_dotenv()

from app.services.email_service import EmailService


async def test_send_otp_email():
    email_service = EmailService()
    
    # Bạn có thể thay đổi địa chỉ email nhận ở đây
    recipient_email = "tt8756400@gmail.com"
    otp_code = "123456"

    print(f"Đang gửi email test đến: {recipient_email}...")
    
    try:
        await email_service.send_otp_email(
            recipient_email=recipient_email,
            otp_code=otp_code
        )
        print("\n✅ Email đã được gửi thành công!")
        print("Hãy kiểm tra hộp thư đến (và mục Spam) của bạn.")
    except Exception as e:
        print(f"\n❌ Lỗi khi gửi email: {e}")
        print("Vui lòng kiểm tra lại cấu hình SMTP trong file .env và App Password.")


if __name__ == "__main__":
    asyncio.run(test_send_otp_email())

# def test_dummy_email_file_is_working():
#     assert True == True