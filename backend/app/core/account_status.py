from app.core.exceptions import ForbiddenException
from app.models.user import TaiKhoan, VaiTroEnum


ACCOUNT_DISABLED_MESSAGE = "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên để được hỗ trợ."
OTP_PENDING_MESSAGE = "Tài khoản chưa được kích hoạt OTP. Vui lòng xác thực tài khoản!"


def ensure_account_active(user: TaiKhoan) -> None:
    """Staff are activated by administrators, not by the patient OTP flow."""
    if user.is_active:
        return
    if user.vai_tro == VaiTroEnum.BENH_NHAN.value and user.otp_code and user.otp_expired_at:
        raise ForbiddenException(OTP_PENDING_MESSAGE)
    raise ForbiddenException(ACCOUNT_DISABLED_MESSAGE)
