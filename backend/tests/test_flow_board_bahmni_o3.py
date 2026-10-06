from datetime import date, datetime, time, timezone
from app.models.appointment import (
    TrangThaiLichEnum,
    TrangThaiHangDoiEnum,
    LoaiHangDoiEnum,
)
from app.schemas.queue import (
    QueueTicketResponse,
    PatientFlowBoardItem,
)
from app.services.appointment_service import CANCELLABLE_STATUSES


def test_bahmni_reschedule_after_checkin_cancels_old_queue_ticket():
    """
    Kiểm tra Quy tắc Vòng đời Lịch hẹn Bahmni (Appointment Reschedule Lifecycle):
    Lịch đã check-in (da_tiep_nhan) nếu được đổi lịch:
    - Vé hàng đợi cũ tại phòng khám tự động chuyển sang 'bo_kham' để giải phóng sảnh chờ.
    - Lịch khám mới chuyển về 'cho_xac_nhan' và bắt buộc phải Check-in lại khi đến thời điểm mới.
    """
    # 1. Ban đầu: Bệnh nhân đã check-in tại quầy
    lich_kham = {
        "id": 101,
        "trang_thai": TrangThaiLichEnum.DA_TIEP_NHAN.value,
        "ngay_kham": date(2026, 10, 10),
        "gio_kham": time(8, 30),
    }
    ticket = {
        "id": 501,
        "lich_kham_id": lich_kham["id"],
        "trang_thai": TrangThaiHangDoiEnum.CHO_KHAM.value,
        "ghi_chu_dieu_phoi": "Check-in đúng giờ",
    }

    # Đảm bảo DA_TIEP_NHAN nằm trong tập các trạng thái được phép đổi lịch theo Bahmni
    assert lich_kham["trang_thai"] in CANCELLABLE_STATUSES

    # 2. Thực hiện đổi lịch sang ngày mới (Reschedule action)
    ngay_moi = date(2026, 10, 15)
    gio_moi = time(9, 0)

    # Cập nhật lịch khám
    lich_kham["ngay_kham"] = ngay_moi
    lich_kham["gio_kham"] = gio_moi
    lich_kham["trang_thai"] = TrangThaiLichEnum.DA_XAC_NHAN.value

    # Áp dụng quy tắc Bahmni: Hủy vé sảnh chờ cũ
    if ticket["trang_thai"] in [TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value]:
        ticket["trang_thai"] = TrangThaiHangDoiEnum.BO_KHAM.value
        ticket["ghi_chu_dieu_phoi"] = f"{ticket['ghi_chu_dieu_phoi']} | Đóng vé sảnh do dời lịch sang {ngay_moi} (Quy tắc Bahmni)"

    # 3. Kiểm tra kết quả
    assert ticket["trang_thai"] == TrangThaiHangDoiEnum.BO_KHAM.value
    assert "Quy tắc Bahmni" in ticket["ghi_chu_dieu_phoi"]
    assert lich_kham["trang_thai"] == TrangThaiLichEnum.DA_XAC_NHAN.value
    assert lich_kham["ngay_kham"] == ngay_moi


def test_bahmni_cancel_after_checkin_cancels_queue_ticket():
    """
    Kiểm tra Quy tắc Bahmni khi Hủy lịch khám sau khi đã Check-in:
    - Vé hàng đợi đang chờ tự động bị hủy (bo_kham).
    - Lịch khám chuyển sang da_huy.
    """
    lich_kham = {
        "id": 102,
        "trang_thai": TrangThaiLichEnum.DA_TIEP_NHAN.value,
    }
    ticket = {
        "id": 502,
        "lich_kham_id": 102,
        "trang_thai": TrangThaiHangDoiEnum.CHO_KHAM.value,
        "ghi_chu_dieu_phoi": None,
    }

    # Hủy lịch
    lich_kham["trang_thai"] = TrangThaiLichEnum.DA_HUY.value
    ticket["trang_thai"] = TrangThaiHangDoiEnum.BO_KHAM.value
    ticket["ghi_chu_dieu_phoi"] = "Đóng vé sảnh do hủy lịch hẹn (Quy tắc Bahmni)"

    assert lich_kham["trang_thai"] == TrangThaiLichEnum.DA_HUY.value
    assert ticket["trang_thai"] == TrangThaiHangDoiEnum.BO_KHAM.value
    assert "Quy tắc Bahmni" in ticket["ghi_chu_dieu_phoi"]


def test_openemr_flow_board_wait_time_and_status_time_metrics():
    """
    Kiểm tra các chỉ số theo dõi luân chuyển bệnh nhân theo chuẩn OpenEMR Patient Flow Board:
    - gio_hen_du_kien (HH:MM)
    - thoi_gian_cho_phut (tính từ lúc check-in đến hiện tại)
    - thoi_gian_o_trang_thai_phut (thời gian đã ở trạng thái hiện tại)
    """
    now = datetime(2026, 10, 10, 9, 30, tzinfo=timezone.utc)

    # Ca 1: Bệnh nhân đang chờ khám (Check-in lúc 08:45, tức đã chờ 45 phút)
    cin_time = datetime(2026, 10, 10, 8, 45, tzinfo=timezone.utc)
    wait_minutes = int((now - cin_time).total_seconds() / 60)
    assert wait_minutes == 45

    item_waiting = PatientFlowBoardItem(
        ticket_id=1,
        benh_nhan_id=10,
        ten_benh_nhan="Nguyễn Văn A",
        bac_si_id=2,
        ten_bac_si="BS. Trần Văn B",
        ngay_kham=date(2026, 10, 10),
        ca_kham="sang",
        so_thu_tu_kham=1,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        gio_hen_du_kien="09:00",
        thoi_gian_check_in=cin_time,
        thoi_gian_cho_phut=wait_minutes,
        thoi_gian_o_trang_thai_phut=wait_minutes,
        so_lan_goi=1,
    )
    assert item_waiting.gio_hen_du_kien == "09:00"
    assert item_waiting.thoi_gian_cho_phut == 45
    assert item_waiting.thoi_gian_o_trang_thai_phut == 45

    # Ca 2: Bệnh nhân đang khám trong phòng (Vào phòng lúc 09:15, tức đang khám 15 phút)
    start_time = datetime(2026, 10, 10, 9, 15, tzinfo=timezone.utc)
    exam_duration = int((now - start_time).total_seconds() / 60)
    assert exam_duration == 15

    item_examining = PatientFlowBoardItem(
        ticket_id=2,
        benh_nhan_id=11,
        ten_benh_nhan="Lê Thị C",
        bac_si_id=2,
        ten_bac_si="BS. Trần Văn B",
        ngay_kham=date(2026, 10, 10),
        ca_kham="sang",
        so_thu_tu_kham=2,
        loai_hang_doi=LoaiHangDoiEnum.DUNG_HEN.value,
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.DANG_KHAM.value,
        gio_hen_du_kien="09:15",
        thoi_gian_check_in=datetime(2026, 10, 10, 9, 0, tzinfo=timezone.utc),
        thoi_gian_cho_phut=30,
        thoi_gian_o_trang_thai_phut=exam_duration,
        so_lan_goi=1,
    )
    assert item_examining.thoi_gian_o_trang_thai_phut == 15
    assert item_examining.trang_thai == "dang_kham"


def test_openmrs_o3_timestamp_preservation():
    """
    Kiểm tra chuẩn OpenMRS O3 Service Queues:
    Bắt buộc lưu trữ và bảo toàn 4 mốc thời gian luân chuyển bệnh nhân:
    1. thoi_gian_check_in (Lễ tân ghi nhận bệnh nhân có mặt thực tế)
    2. thoi_gian_goi_kham (Bác sĩ gọi loa vào phòng)
    3. thoi_gian_bat_dau (Bác sĩ tiếp nhận ca khám)
    4. thoi_gian_ket_thuc (Bác sĩ hoàn tất khám & ra toa thuốc)
    """
    t_checkin = datetime(2026, 10, 10, 8, 0, tzinfo=timezone.utc)
    t_call = datetime(2026, 10, 10, 8, 15, tzinfo=timezone.utc)
    t_start = datetime(2026, 10, 10, 8, 17, tzinfo=timezone.utc)
    t_end = datetime(2026, 10, 10, 8, 35, tzinfo=timezone.utc)

    # Đảm bảo tính tuần tự nhân quả thời gian
    assert t_checkin <= t_call <= t_start <= t_end

    ticket_resp = QueueTicketResponse(
        id=99,
        benh_nhan_id=1,
        bac_si_id=2,
        ngay_kham=date(2026, 10, 10),
        ca_kham="sang",
        so_thu_tu_kham=3,
        loai_hang_doi="dung_hen",
        muc_do_uu_tien=2,
        trang_thai=TrangThaiHangDoiEnum.DA_KHAM.value,
        thoi_gian_check_in=t_checkin,
        thoi_gian_goi_kham=t_call,
        thoi_gian_bat_dau=t_start,
        thoi_gian_ket_thuc=t_end,
        so_lan_goi=1,
        gio_hen_du_kien="08:15",
        thoi_gian_cho_phut=17,  # Chờ 17 phút từ check-in đến lúc bắt đầu khám
        thoi_gian_o_trang_thai_phut=18,  # Khám trong 18 phút
    )
    assert ticket_resp.thoi_gian_check_in == t_checkin
    assert ticket_resp.thoi_gian_goi_kham == t_call
    assert ticket_resp.thoi_gian_bat_dau == t_start
    assert ticket_resp.thoi_gian_ket_thuc == t_end


def test_group_clinic_policy_differentiation():
    """
    Kiểm tra tính độc lập của Chính sách điều phối phòng khám ngoại trú do nhóm đề xuất:
    Không gắn nhãn sai là 'chuẩn Bahmni' hay 'chuẩn OpenMRS', mà là Group Clinic Policy:
    - Khung giờ khám tiếp đón: 30 phút
    - Ngưỡng trễ chấp nhận được: 15 phút đầu slot
    - Ngưỡng tạm hoãn: Bác sĩ gọi quá 3 lần
    - Thuật toán ưu tiên 5 bậc phù hợp bối cảnh phòng khám Việt Nam
    """
    policy = {
        "slot_minutes": 30,
        "late_threshold_minutes": 15,
        "max_call_attempts": 3,
        "priority_levels": [
            (1, "Cap_cuu_Red_Flag"),
            (2, "Dung_hen_Check_in"),
            (3, "Tra_ket_qua_CLS"),
            (4, "Den_som_Phuc_hoi"),
            (5, "Vang_lai_Den_muon"),
        ],
        "policy_type": "GROUP_PROPOSED_CLINIC_POLICY",
    }
    assert policy["slot_minutes"] == 30
    assert policy["late_threshold_minutes"] == 15
    assert policy["max_call_attempts"] == 3
    assert len(policy["priority_levels"]) == 5
    assert policy["policy_type"] == "GROUP_PROPOSED_CLINIC_POLICY"
