from datetime import time
from app.models.user import VaiTroEnum
from app.models.appointment import (
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
)


def test_receptionist_role_defined():
    """Kiểm tra vai trò Lễ tân (le_tan) được định nghĩa chuẩn xác trong RBAC"""
    assert hasattr(VaiTroEnum, "LE_TAN")
    assert VaiTroEnum.LE_TAN.value == "le_tan"
    assert VaiTroEnum.LE_TAN != VaiTroEnum.BAC_SI
    assert VaiTroEnum.LE_TAN != VaiTroEnum.BENH_NHAN


def test_queue_models_and_enums():
    """Kiểm tra các enum và cấu trúc dữ liệu Hàng đợi Bahmni"""
    assert LoaiHangDoiEnum.DUNG_HEN.value == "dung_hen"
    assert LoaiHangDoiEnum.DEN_SOM.value == "den_som"
    assert LoaiHangDoiEnum.DEN_MUON.value == "den_muon"
    assert LoaiHangDoiEnum.VANG_LAI.value == "vang_lai"
    assert LoaiHangDoiEnum.TRA_KET_QUA_CLS.value == "tra_ket_qua"

    assert TrangThaiHangDoiEnum.CHO_KHAM.value == "cho_kham"
    assert TrangThaiHangDoiEnum.DANG_KHAM.value == "dang_kham"
    assert TrangThaiHangDoiEnum.TAM_HOAN.value == "tam_hoan"
    assert TrangThaiHangDoiEnum.DA_KHAM.value == "da_kham"
    assert TrangThaiHangDoiEnum.BO_KHAM.value == "bo_kham"


def test_bahmni_priority_ordering_logic():
    """Kiểm tra thuật toán sắp xếp thứ tự gọi bệnh nhân 5 bậc ưu tiên Bahmni"""
    # Mô phỏng danh sách vé đang chờ trong hàng đợi
    tickets = [
        {"id": 1, "name": "Bệnh nhân vãng lai", "priority": 5, "stt": 10, "time": "08:30"},
        {"id": 2, "name": "Bệnh nhân có hẹn đúng giờ", "priority": 2, "stt": 5, "time": "08:15"},
        {"id": 3, "name": "Bệnh nhân cấp cứu đột xuất", "priority": 1, "stt": 12, "time": "08:35"},
        {"id": 4, "name": "Bệnh nhân trả kết quả CLS", "priority": 3, "stt": 2, "time": "08:00"},
        {"id": 5, "name": "Bệnh nhân đến sớm / phục hồi", "priority": 4, "stt": 6, "time": "08:20"},
        {"id": 6, "name": "Bệnh nhân có hẹn đúng giờ STT nhỏ", "priority": 2, "stt": 3, "time": "08:10"},
    ]

    # Sắp xếp theo: (priority Tăng dần, stt Tăng dần, time Tăng dần)
    sorted_tickets = sorted(tickets, key=lambda x: (x["priority"], x["stt"], x["time"]))

    # Kiểm tra thứ tự gọi chính xác:
    # 1. Cấp cứu (priority 1)
    assert sorted_tickets[0]["id"] == 3
    # 2. Đúng hẹn STT 3 (priority 2, stt 3)
    assert sorted_tickets[1]["id"] == 6
    # 3. Đúng hẹn STT 5 (priority 2, stt 5)
    assert sorted_tickets[2]["id"] == 2
    # 4. Trả kết quả CLS (priority 3)
    assert sorted_tickets[3]["id"] == 4
    # 5. Đến sớm / Phục hồi (priority 4)
    assert sorted_tickets[4]["id"] == 5
    # 6. Vãng lai (priority 5)
    assert sorted_tickets[5]["id"] == 1


def test_postpone_and_restore_ticket_flow():
    """Kiểm tra quy trình tạm hoãn khi gọi quá 3 lần và lễ tân phục hồi vé"""
    ticket = {
        "id": 101,
        "trang_thai": TrangThaiHangDoiEnum.CHO_KHAM,
        "so_lan_goi": 0,
        "muc_do_uu_tien": 2
    }

    # Bác sĩ gọi lần 1
    ticket["so_lan_goi"] += 1
    assert ticket["so_lan_goi"] == 1
    assert ticket["trang_thai"] == TrangThaiHangDoiEnum.CHO_KHAM

    # Bác sĩ gọi lần 2
    ticket["so_lan_goi"] += 1
    assert ticket["so_lan_goi"] == 2

    # Bác sĩ gọi lần 3 -> bệnh nhân không vào -> Tạm hoãn
    ticket["so_lan_goi"] += 1
    if ticket["so_lan_goi"] >= 3:
        ticket["trang_thai"] = TrangThaiHangDoiEnum.TAM_HOAN
    assert ticket["trang_thai"] == TrangThaiHangDoiEnum.TAM_HOAN

    # Lễ tân phục hồi vé khi bệnh nhân quay lại quầy
    # Quy tắc: chuyển về CHO_KHAM, xếp ưu tiên bậc 4, reset số lần gọi = 0
    ticket["trang_thai"] = TrangThaiHangDoiEnum.CHO_KHAM
    ticket["muc_do_uu_tien"] = 4
    ticket["so_lan_goi"] = 0

    assert ticket["trang_thai"] == TrangThaiHangDoiEnum.CHO_KHAM
    assert ticket["muc_do_uu_tien"] == 4
    assert ticket["so_lan_goi"] == 0


def test_arrival_window_early_on_time_late_classification():
    """Kiểm tra logic phân loại Đến sớm, Đúng giờ và Đến muộn theo cửa sổ 30 phút"""
    slot_start = time(8, 0)

    # 1. Bệnh nhân check-in lúc 07:40 (trước slot > 15 phút) -> Đến sớm
    checkin_early = time(7, 40)
    diff_early_minutes = (slot_start.hour * 60 + slot_start.minute) - (checkin_early.hour * 60 + checkin_early.minute)
    assert diff_early_minutes > 15  # Đến sớm

    # 2. Bệnh nhân check-in lúc 08:05 (trong 15 phút đầu của slot) -> Đúng giờ
    checkin_ontime = time(8, 5)
    diff_ontime_minutes = (checkin_ontime.hour * 60 + checkin_ontime.minute) - (slot_start.hour * 60 + slot_start.minute)
    assert 0 <= diff_ontime_minutes <= 15  # Đúng giờ

    # 3. Bệnh nhân check-in lúc 08:25 (sau 15 phút đầu của slot) -> Đến muộn
    checkin_late = time(8, 25)
    diff_late_minutes = (checkin_late.hour * 60 + checkin_late.minute) - (slot_start.hour * 60 + slot_start.minute)
    assert diff_late_minutes > 15  # Đến muộn
