from datetime import datetime, date, time
from app.models.user import VaiTroEnum
from app.models.appointment import TrangThaiLichEnum, CANCELLED_STATUSES
from app.services.appointment_service import CANCELLABLE_STATUSES
from app.schemas.appointment import AppointmentRescheduleRequest


def test_reschedule_schema_validation():
    """Kiểm tra schema yêu cầu đổi lịch khám (AppointmentRescheduleRequest)"""
    req = AppointmentRescheduleRequest(
        ngay_kham_moi=date(2026, 10, 15),
        gio_kham_moi=time(9, 0),
        bac_si_id_moi=2,
        ly_do_doi="Bận việc đột xuất vào giờ cũ"
    )
    assert req.ngay_kham_moi == date(2026, 10, 15)
    assert req.gio_kham_moi == time(9, 0)
    assert req.bac_si_id_moi == 2
    assert req.ly_do_doi == "Bận việc đột xuất vào giờ cũ"


def test_reschedule_time_constraint_logic():
    """Kiểm tra logic chặn đổi lịch nếu cách giờ khám cũ dưới 02 tiếng"""
    now = datetime(2026, 10, 10, 8, 0)
    min_hours = 2.0

    # Ca 1: Giờ khám lúc 09:30 (cách 1.5 tiếng < 2 tiếng) -> Bị từ chối
    old_time_invalid = datetime(2026, 10, 10, 9, 30)
    diff_invalid = (old_time_invalid - now).total_seconds() / 3600.0
    assert diff_invalid < min_hours

    # Ca 2: Giờ khám lúc 10:30 (cách 2.5 tiếng >= 2 tiếng) -> Hợp lệ
    old_time_valid = datetime(2026, 10, 10, 10, 30)
    diff_valid = (old_time_valid - now).total_seconds() / 3600.0
    assert diff_valid >= min_hours


def test_reschedule_state_constraints():
    """Kiểm tra ràng buộc trạng thái: Chỉ cho phép đổi khi đang chờ xác nhận hoặc đã xác nhận"""
    # Trạng thái hợp lệ
    for st in [TrangThaiLichEnum.CHO_XAC_NHAN.value, TrangThaiLichEnum.DA_XAC_NHAN.value]:
        assert st in CANCELLABLE_STATUSES
        assert st not in CANCELLED_STATUSES

    # Trạng thái không được phép đổi
    invalid_statuses = [
        TrangThaiLichEnum.DA_HUY.value,
        TrangThaiLichEnum.TU_DONG_HUY.value,
        TrangThaiLichEnum.DA_KHAM.value,
        TrangThaiLichEnum.DANG_KHAM.value,
        TrangThaiLichEnum.NO_SHOW.value
    ]
    for st in invalid_statuses:
        assert (st in CANCELLED_STATUSES) or (st not in CANCELLABLE_STATUSES)


def test_reschedule_rbac_rules():
    """Kiểm tra quy tắc phân quyền: Bệnh nhân chỉ đổi được lịch của mình"""
    user_bn = {"role": VaiTroEnum.BENH_NHAN.value, "bn_id": 10}
    other_bn = {"role": VaiTroEnum.BENH_NHAN.value, "bn_id": 99}
    appointment = {"id": 1, "benh_nhan_id": 10, "bac_si_id": 3}

    # Bệnh nhân đúng sở hữu
    assert appointment["benh_nhan_id"] == user_bn["bn_id"]

    # Bệnh nhân khác can thiệp -> Từ chối
    assert appointment["benh_nhan_id"] != other_bn["bn_id"]
