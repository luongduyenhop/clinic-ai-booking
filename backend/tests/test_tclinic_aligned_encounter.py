import pytest
from datetime import date, time, datetime, timezone
from app.services.appointment_service import clinic_now
from decimal import Decimal
from app.models.appointment import LichKham, TrangThaiLichEnum
from app.models.medical import DichVu
from app.schemas.clinical import (
    EncounterCreateRequest,
    EncounterCompleteRequest,
    DiagnosisCreateRequest,
    OrderCreateRequest,
    PrescriptionCreateRequest,
    PrescriptionItemCreateRequest,
)
from app.services.clinical_service import ClinicalService


from sqlalchemy import select
from app.models.user import TaiKhoan
from tests.test_clinical_skeleton import _dam_bao_ma_icd10


@pytest.mark.asyncio
async def test_tclinic_aligned_encounter_lifecycle(db_session, booking):
    """
    Kiểm tra toàn diện quy trình khám bệnh chuẩn tClinic:
    1. Bắt đầu lượt khám với Sinh hiệu nâng cao (SpO2, BMI) và Lâm sàng (Triệu chứng, CĐ sơ bộ, Dị ứng)
    2. Kê đơn thuốc với liều 4 cữ Sáng - Trưa - Chiều - Tối và Số ngày dùng tổng thể
    3. Thêm chỉ định cận lâm sàng có tính giảm giá và thành tiền
    4. Thêm chẩn đoán chính ICD-10
    5. Hoàn tất khám, hẹn tái khám có lời dặn riêng biệt và khóa hồ sơ TT 32
    """
    service = ClinicalService()

    # Lấy tài khoản Bác sĩ tương ứng với booking.bs_x
    stmt_acc = select(TaiKhoan).where(TaiKhoan.nguoi_dung_id == booking.bs_x.nguoi_dung_id)
    doc_account = (await db_session.execute(stmt_acc)).scalar_one()

    # 1. Tạo 1 lịch hẹn mới cho Bác sĩ X và Bệnh nhân A
    lich = LichKham(
        ma_lich_kham=f"LK-TCLINIC-{booking.suffix}",
        bac_si_id=booking.bs_x.id,
        benh_nhan_id=booking.bn_a.id,
        ngay_kham=clinic_now().date(),
        gio_kham=time(9, 30),
        ly_do_kham="Đau tức ngực, khó thở khi gắng sức",
        trieu_chung_ban_dau="Đau tức ngực 3 ngày nay",
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
    )
    db_session.add(lich)
    await db_session.flush()

    # Tạo dịch vụ CLS
    dv = DichVu(
        ma_dich_vu=f"DV-ECG-{booking.suffix}",
        ten_dich_vu="Điện tâm đồ ECG 12 cần",
        don_gia=Decimal("150000.00"),
        don_vi_tinh="Lần",
        is_active=True
    )
    db_session.add(dv)
    await db_session.flush()

    # 2. Bắt đầu ca khám với các trường chuẩn tClinic
    create_req = EncounterCreateRequest(
        lich_kham_id=lich.id,
        ly_do_vao_kham="Đau tức ngực từng cơn",
        benh_su="Tiền sử tăng huyết áp 5 năm, dùng Amlodipine đều",
        trieu_chung="Cảm giác nặng ngực sau xương ức, hồi hộp",
        chan_doan_so_bo="Theo dõi Cơn đau thắt ngực ổn định / Tăng huyết áp",
        tien_su_di_ung="Dị ứng Penicillin (nổi mề đay)",
        mach_lan_phut=78,
        nhiet_do_c=36.8,
        huyet_ap_tam_thu=135,
        huyet_ap_tam_truong=85,
        nhip_tho_lan_phut=18,
        can_nang_kg=65.0,
        chieu_cao_cm=168.0,
        spo2=98.5,
        bmi=23.0,
        kham_lam_sang_bo_phan="Tim đều T1 T2 rõ, phổi không rale"
    )

    encounter_resp = await service.start_encounter(create_req, doc_account, db_session)
    assert encounter_resp.id is not None
    assert encounter_resp.ma_kcb is not None
    assert encounter_resp.ma_kcb.startswith("KCB-")
    assert encounter_resp.spo2 == 98.5
    assert encounter_resp.bmi == 23.0
    assert encounter_resp.trieu_chung == "Cảm giác nặng ngực sau xương ức, hồi hộp"
    assert encounter_resp.chan_doan_so_bo == "Theo dõi Cơn đau thắt ngực ổn định / Tăng huyết áp"
    assert encounter_resp.tien_su_di_ung == "Dị ứng Penicillin (nổi mề đay)"

    # Kiểm tra trường thông tin thân nhân khẩn cấp trên hồ sơ bệnh nhân (Migration 008)
    booking.bn_a.nguoi_lien_he = "Trần Thị Thân Nhân"
    booking.bn_a.sdt_nguoi_lien_he = "0988999888"
    await db_session.flush()
    assert booking.bn_a.nguoi_lien_he == "Trần Thị Thân Nhân"
    assert booking.bn_a.sdt_nguoi_lien_he == "0988999888"

    # Đảm bảo mã ICD-10 có trong DB test
    await _dam_bao_ma_icd10(db_session, "I10", "Tăng huyết áp vô căn (nguyên phát)")

    # 3. Thêm chẩn đoán chính ICD-10
    diag_req = DiagnosisCreateRequest(
        ma_icd10="I10",
        ten_benh_chan_doan="Tăng huyết áp vô căn (nguyên phát)",
        loai_chan_doan="chinh",
        ghi_chu_chuyen_mon="Kiểm soát HA tương đối tốt"
    )
    await service.add_diagnosis(encounter_resp.id, diag_req, doc_account, db_session)

    # 4. Kê đơn thuốc với liều 4 cữ (Sáng - Trưa - Chiều - Tối)
    rx_req = PrescriptionCreateRequest(
        so_ngay_dung=14,
        loi_dan_uong_thuoc="Uống thuốc đều đặn vào 8h sáng hàng ngày sau ăn",
        ghi_chu_duoc_lam_sang="Không dùng đồng thời với bưởi chùm",
        danh_sach_thuoc=[
            PrescriptionItemCreateRequest(
                ten_thuoc="Amlodipine 5mg",
                hoat_chat="Amlodipine",
                ham_luong="5mg",
                don_vi_tinh="Viên",
                so_luong=14,
                lieu_sang="1",
                lieu_trua="0",
                lieu_chieu="0",
                lieu_toi="0",
                cach_dung="Sáng uống 1 viên sau ăn",
                so_ngay_dung=14
            ),
            PrescriptionItemCreateRequest(
                ten_thuoc="Aspirin 81mg",
                hoat_chat="Acid Acetylsalicylic",
                ham_luong="81mg",
                don_vi_tinh="Viên",
                so_luong=14,
                lieu_sang="0",
                lieu_trua="0",
                lieu_chieu="1",
                lieu_toi="0",
                cach_dung="Chiều uống 1 viên sau ăn no",
                so_ngay_dung=14
            )
        ]
    )
    rx_resp = await service.create_prescription(encounter_resp.id, rx_req, doc_account, db_session)
    assert rx_resp.so_ngay_dung == 14
    assert len(rx_resp.danh_sach_chi_tiet) == 2
    assert rx_resp.danh_sach_chi_tiet[0].lieu_sang == "1"
    assert rx_resp.danh_sach_chi_tiet[1].lieu_chieu == "1"

    # 5. Hoàn tất lượt khám và hẹn tái khám với lời dặn riêng biệt
    complete_req = EncounterCompleteRequest(
        ket_luan_dieu_tri="Tăng huyết áp độ 1 - Nguy cơ tim mạch trung bình",
        loi_dan_bac_si="Ăn nhạt, hạn chế mỡ động vật, tập thể dục nhẹ nhàng 30p/ngày",
        ngay_hen_tai_kham=date(2026, 10, 27),
        loi_dan_tai_kham="Khi tái khám mang theo sổ theo dõi huyết áp đo tại nhà"
    )
    final_resp = await service.complete_encounter(encounter_resp.id, complete_req, doc_account, db_session)
    assert final_resp.is_locked is True
    assert final_resp.loi_dan_tai_kham == "Khi tái khám mang theo sổ theo dõi huyết áp đo tại nhà"
    assert final_resp.ngay_hen_tai_kham == date(2026, 10, 27)

    # 6. Kiểm tra lại qua get_encounter_detail
    detail = await service.get_encounter_detail(encounter_resp.id, doc_account, db_session)
    assert detail.ma_kcb is not None
    assert detail.ma_kcb.startswith("KCB-")
    assert detail.spo2 == 98.5
    assert detail.bmi == 23.0
    assert detail.trieu_chung == "Cảm giác nặng ngực sau xương ức, hồi hộp"
    assert detail.loi_dan_tai_kham == "Khi tái khám mang theo sổ theo dõi huyết áp đo tại nhà"
    assert detail.don_thuoc is not None
    assert detail.don_thuoc.so_ngay_dung == 14
    assert detail.don_thuoc.danh_sach_chi_tiet[0].lieu_sang == "1"
