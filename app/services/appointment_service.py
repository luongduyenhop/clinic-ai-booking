import logging
from datetime import date, datetime, timedelta, timezone
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, AppException
from app.core.config import settings
from app.models.user import TaiKhoan, BenhNhan, BacSi, NguoiDung, ChuyenKhoa, VaiTroEnum
from app.models.appointment import LichLamViec, LichKham, TrangThaiLichEnum
from app.schemas.appointment import (
    AppointmentCreateRequest,
    AppointmentCancelRequest,
    AppointmentResponse,
    DoctorScheduleSlotsResponse,
    TimeSlotResponse,
    DoctorBriefResponse,
    PatientBriefResponse
)

logger = logging.getLogger("clinic_backend")


class AppointmentService:
    """Tầng Control xử lý nghiệp vụ đặt lịch, tính toán slot động và kiểm soát xung đột (Package B)"""

    async def get_doctor_available_slots(
        self, 
        doctor_id: int, 
        query_date: date, 
        db: AsyncSession
    ) -> DoctorScheduleSlotsResponse:
        """Tính toán các khung giờ khám 30 phút còn trống trong ngày (Dynamic Slot Calculation - UC-B02)"""
        # 1. Kiểm tra Bác sĩ tồn tại
        stmt_bs = (
            select(BacSi, NguoiDung, ChuyenKhoa)
            .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
            .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
            .where(BacSi.id == doctor_id)
        )
        bs_row = (await db.execute(stmt_bs)).first()
        if not bs_row:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")
        
        bac_si, nguoi_dung, chuyen_khoa = bs_row

        # 2. Truy vấn lịch làm việc của Bác sĩ trong ngày query_date
        stmt_llv = select(LichLamViec).where(
            and_(
                LichLamViec.bac_si_id == doctor_id,
                LichLamViec.ngay_lam_viec == query_date,
                LichLamViec.is_active.is_(True)
            )
        )
        shifts = (await db.execute(stmt_llv)).scalars().all()

        # 3. Truy vấn các ca đã đặt trước (ngoại trừ đã hủy)
        stmt_lk = select(LichKham.gio_kham).where(
            and_(
                LichKham.bac_si_id == doctor_id,
                LichKham.ngay_kham == query_date,
                LichKham.trang_thai != TrangThaiLichEnum.DA_HUY.value
            )
        )
        booked_times_set = set((await db.execute(stmt_lk)).scalars().all())

        # 4. Sinh danh sách các slot 30 phút và so khớp trạng thái
        generated_slots: List[TimeSlotResponse] = []
        now_dt = datetime.now()

        for shift in shifts:
            # Bắt đầu duyệt từ giờ bắt đầu ca đến giờ kết thúc ca
            curr_dt = datetime.combine(query_date, shift.gio_bat_dau)
            end_dt = datetime.combine(query_date, shift.gio_ket_thuc)

            while curr_dt + timedelta(minutes=settings.SLOT_DURATION_MINUTES) <= end_dt:
                slot_time = curr_dt.time()
                time_str = slot_time.strftime("%H:%M")

                if slot_time in booked_times_set:
                    slot_status = "booked"  # Đã có người đặt
                elif curr_dt < now_dt:
                    slot_status = "past"    # Đã qua trong quá khứ
                else:
                    slot_status = "available"  # Còn trống, sẵn sàng nhận đặt

                generated_slots.append(
                    TimeSlotResponse(
                        time_str=time_str,
                        time_val=slot_time,
                        status=slot_status
                    )
                )
                curr_dt += timedelta(minutes=settings.SLOT_DURATION_MINUTES)

        return DoctorScheduleSlotsResponse(
            doctor_id=bac_si.id,
            doctor_name=nguoi_dung.ho_ten,
            specialty_name=chuyen_khoa.ten_chuyen_khoa if chuyen_khoa else "Đa khoa",
            date=query_date,
            slots=generated_slots
        )

    async def create_booking(
        self, 
        payload: AppointmentCreateRequest, 
        user: TaiKhoan, 
        db: AsyncSession
    ) -> AppointmentResponse:
        """Đặt lịch khám trực tuyến với cơ chế khóa Pessimistic Locking chống Race Condition (UC-B03)"""
        # 1. Xác định hồ sơ bệnh nhân từ tài khoản hiện tại
        stmt_bn = select(BenhNhan, NguoiDung).join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id).where(
            BenhNhan.nguoi_dung_id == user.nguoi_dung_id
        )
        bn_row = (await db.execute(stmt_bn)).first()
        if not bn_row:
            raise ForbiddenException("Tài khoản chưa có hồ sơ Bệnh nhân hợp lệ!")
        benh_nhan, bn_info = bn_row

        # 2. Không cho phép đặt ngày trong quá khứ
        booking_dt = datetime.combine(payload.ngay_kham, payload.gio_kham)
        if booking_dt < datetime.now():
            raise AppException("Không thể đặt lịch khám trong quá khứ!")

        # 3. Kiểm tra xem bệnh nhân có bị trùng lịch cá nhân cùng thời điểm không
        stmt_dup_patient = select(LichKham).where(
            and_(
                LichKham.benh_nhan_id == benh_nhan.id,
                LichKham.ngay_kham == payload.ngay_kham,
                LichKham.gio_kham == payload.gio_kham,
                LichKham.trang_thai != TrangThaiLichEnum.DA_HUY.value
            )
        )
        if (await db.execute(stmt_dup_patient)).scalar_one_or_none():
            raise ConflictException("Bạn đã có một lịch hẹn khám khác trong khung giờ này!")

        # 4. CHỐT CHẶN CONCURRENCY: Khóa kiểm tra slot của Bác sĩ bằng SELECT ... FOR UPDATE
        # Đảm bảo 2 request đồng thời tới cùng mili-giây sẽ được tuần tự hóa an toàn
        stmt_lock_check = (
            select(LichKham)
            .where(
                and_(
                    LichKham.bac_si_id == payload.bac_si_id,
                    LichKham.ngay_kham == payload.ngay_kham,
                    LichKham.gio_kham == payload.gio_kham,
                    LichKham.trang_thai != TrangThaiLichEnum.DA_HUY.value
                )
            )
            .with_for_update()  # Khóa dòng trong PostgreSQL
        )
        slot_occupied = (await db.execute(stmt_lock_check)).scalar_one_or_none()
        if slot_occupied:
            raise ConflictException("Rất tiếc! Khung giờ này vừa được người bệnh khác giữ chỗ trước.")

        # 5. Tính số thứ tự khám trong ngày của Bác sĩ
        stmt_stt = select(func.count(LichKham.id)).where(
            and_(
                LichKham.bac_si_id == payload.bac_si_id,
                LichKham.ngay_kham == payload.ngay_kham,
                LichKham.trang_thai != TrangThaiLichEnum.DA_HUY.value
            )
        )
        current_count = (await db.execute(stmt_stt)).scalar() or 0
        so_thu_tu = current_count + 1

        # 6. Sinh mã lịch khám duy nhất theo mẫu: LK-YYYYMMDD-XXX
        ma_lich = f"LK-{payload.ngay_kham.strftime('%Y%m%d')}-{payload.bac_si_id:02d}{so_thu_tu:03d}"

        # 7. Khởi tạo bản ghi LichKham
        lich_kham = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=benh_nhan.id,
            bac_si_id=payload.bac_si_id,
            ngay_kham=payload.ngay_kham,
            gio_kham=payload.gio_kham,
            so_thu_tu=so_thu_tu,
            ly_do_kham=payload.ly_do_kham,
            trieu_chung_ban_dau=payload.trieu_chung_ban_dau,
            trang_thai=TrangThaiLichEnum.CHO_XAC_NHAN.value
        )
        db.add(lich_kham)
        await db.commit()
        await db.refresh(lich_kham)

        # Lấy thông tin bác sĩ hiển thị
        stmt_bs = (
            select(BacSi, NguoiDung, ChuyenKhoa)
            .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
            .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
            .where(BacSi.id == payload.bac_si_id)
        )
        bac_si, bs_info, chuyen_khoa = (await db.execute(stmt_bs)).first()

        logger.info(f"✅ [APPOINTMENT CREATED] Mã: {ma_lich} | Bệnh nhân: {bn_info.ho_ten} | Bác sĩ: {bs_info.ho_ten}")

        return AppointmentResponse(
            id=lich_kham.id,
            ma_lich_kham=lich_kham.ma_lich_kham,
            ngay_kham=lich_kham.ngay_kham,
            gio_kham=lich_kham.gio_kham,
            so_thu_tu=lich_kham.so_thu_tu,
            trang_thai=lich_kham.trang_thai,
            ly_do_kham=lich_kham.ly_do_kham,
            trieu_chung_ban_dau=lich_kham.trieu_chung_ban_dau,
            bac_si=DoctorBriefResponse(
                id=bac_si.id,
                ho_ten=bs_info.ho_ten,
                chuyen_khoa=chuyen_khoa.ten_chuyen_khoa if chuyen_khoa else "Nội khoa",
                hoc_vi=bac_si.hoc_vi
            ),
            benh_nhan=PatientBriefResponse(
                id=benh_nhan.id,
                ho_ten=bn_info.ho_ten,
                so_dien_thoai=bn_info.so_dien_thoai
            )
        )

    async def cancel_booking(
        self, 
        appointment_id: int, 
        payload: AppointmentCancelRequest, 
        user: TaiKhoan, 
        db: AsyncSession
    ) -> dict:
        """Hủy lịch hẹn khám với ràng buộc an toàn y tế tối thiểu 02 tiếng (UC-B05)"""
        stmt = select(LichKham).where(LichKham.id == appointment_id)
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        if lich.trang_thai == TrangThaiLichEnum.DA_HUY.value:
            raise ConflictException("Lịch hẹn này đã bị hủy trước đó!")

        if lich.trang_thai == TrangThaiLichEnum.DA_KHAM.value:
            raise ForbiddenException("Không thể hủy ca khám đã hoàn thành!")

        # Ràng buộc quyền hạn: Bệnh nhân chỉ hủy lịch của mình, Bác sĩ chỉ hủy lịch mình phụ trách, Admin có toàn quyền
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
            bn = (await db.execute(stmt_bn)).scalar_one_or_none()
            if not bn or lich.benh_nhan_id != bn.id:
                raise ForbiddenException("Bạn không có quyền hủy lịch hẹn của người khác!")
        elif user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs = (await db.execute(stmt_bs)).scalar_one_or_none()
            if not bs or lich.bac_si_id != bs.id:
                raise ForbiddenException("Bạn chỉ có thể hủy lịch khám thuộc trách nhiệm phụ trách của mình!")

        # Ràng buộc thời gian: chỉ được hủy trước tối thiểu 02 tiếng
        appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        diff_hours = (appointment_dt - datetime.now()).total_seconds() / 3600.0

        if diff_hours < settings.CANCELLATION_MINIMUM_HOURS:
            raise AppException(
                f"Theo quy định phòng khám, bạn chỉ có thể hủy lịch trước giờ khám tối thiểu "
                f"{settings.CANCELLATION_MINIMUM_HOURS} tiếng. Vui lòng gọi Hotline để được hỗ trợ khẩn cấp!"
            )

        lich.trang_thai = TrangThaiLichEnum.DA_HUY.value
        lich.ly_do_huy = payload.ly_do_huy
        lich.thoi_gian_huy = datetime.now(timezone.utc)
        lich.nguoi_huy_vai_tro = user.vai_tro
        await db.commit()

        logger.info(f"🚫 [APPOINTMENT CANCELLED] ID: {appointment_id} | Lý do: {payload.ly_do_huy}")
        return {
            "appointment_id": appointment_id,
            "ma_lich_kham": lich.ma_lich_kham,
            "message": "Đã hủy lịch hẹn khám thành công và giải phóng khung giờ cho người bệnh khác."
        }


appointment_service = AppointmentService()
