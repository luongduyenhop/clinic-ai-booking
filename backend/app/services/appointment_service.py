import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, AppException
from app.core.config import settings
from app.models.user import TaiKhoan, BenhNhan, BacSi, NguoiDung, ChuyenKhoa, VaiTroEnum
from app.models.appointment import (
    LichLamViec,
    LichKham,
    TrangThaiLichEnum,
    CANCELLED_STATUSES,
    OCCUPYING_SLOT_STATUSES,
    DanhSachCho,
    TrangThaiWaitlistEnum,
    CaLamViecEnum,
    HangDoiKham,
    TrangThaiHangDoiEnum,
)
from app.services.medical_service import DEFAULT_SPECIALTY_NAME, medical_service

# Schemas & DTOs for Appointment Domain (Data Transfer Objects)
from app.schemas.appointment import (
    AppointmentCreateRequest,
    AppointmentCancelRequest,
    AppointmentCancelResponse,
    AppointmentResponse,
    DoctorScheduleSlotsResponse,
    TimeSlotResponse,
    DoctorBriefResponse,
    PatientBriefResponse,
    AppointmentConfirmResponse,
    NoShowMarkRequest,
    NoShowMarkResponse,
    WaitlistCreateRequest,
    WaitlistResponse,
    AutoProcessNoShowResponse,
    AppointmentRescheduleRequest,
)


# Logger instance for Appointment Service
logger = logging.getLogger("clinic_backend")

# Trạng thái lịch có thể hủy hoặc đổi lịch (Quy tắc Bahmni: lịch đã tiếp nhận/check-in cũng có thể hủy/đổi lịch nếu chưa khám)
CANCELLABLE_STATUSES = {
    TrangThaiLichEnum.CHO_XAC_NHAN.value,
    TrangThaiLichEnum.DA_XAC_NHAN.value,
    TrangThaiLichEnum.DA_TIEP_NHAN.value,
}


def clinic_now() -> datetime:
    """Thời điểm hiện tại theo giờ phòng khám (naive, cùng hệ quy chiếu với ngay_kham/gio_kham),
    không phụ thuộc múi giờ của server - container Docker/CI mặc định chạy UTC"""
    clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
    return datetime.now(clinic_tz).replace(tzinfo=None)


def overlaps_any(start: datetime, end: datetime, ranges: Iterable[Tuple[datetime, datetime]]) -> bool:
    """Hai khoảng nửa mở [a, b) và [c, d) giao nhau khi a < d và c < b: bắt được cả lịch lệch mốc
    (VD đặt 08:15) hoặc lịch dài 60 phút chiếm 2 slot liền nhau; lịch 08:00-08:30 không chạm slot 08:30"""
    return any(range_start < end and start < range_end for range_start, range_end in ranges)


def _merge_shifts(query_date: date, shifts: Iterable[Tuple[time, time]]) -> List[List[datetime]]:
    """Gộp các ca chồng lấn/liền kề thành các khoảng làm việc rời nhau, sắp xếp theo giờ bắt đầu"""
    intervals = []
    for shift_start, shift_end in shifts:
        start_dt = datetime.combine(query_date, shift_start)
        end_dt = datetime.combine(query_date, shift_end)
        # Ca kết thúc lúc 00:00 hoặc vắt qua nửa đêm: chỉ lấy phần thuộc ngày query_date
        if shift_end == time(0) or end_dt < start_dt:
            end_dt = datetime.combine(query_date + timedelta(days=1), time(0))
        intervals.append([start_dt, end_dt])

    merged = []
    for start_dt, end_dt in sorted(intervals):
        if merged and start_dt <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end_dt)
        else:
            merged.append([start_dt, end_dt])
    return merged


def build_day_slots(
    query_date: date,
    shifts: Iterable[Tuple[time, time]],
    booked_ranges: Iterable[Tuple[datetime, datetime]],
    now: datetime,
    slot_minutes: Optional[int] = None
) -> List[TimeSlotResponse]:
    """Chia các ca làm việc thành slot cố định rồi gán trạng thái cho từng slot (lõi thuật toán UC-B02).

    - shifts: các cặp (giờ bắt đầu, giờ kết thúc) của ca làm việc còn hiệu lực trong ngày
    - booked_ranges: các khoảng [bắt đầu, kết thúc) của lịch hẹn đang chiếm chỗ
    Slot chỉ được sinh nếu nằm trọn trong ca; ưu tiên trạng thái: booked > past > available.
    Hàm thuần (không truy vấn CSDL), dùng chung cho tra cứu slot (UC-B02) và kiểm tra giờ đặt lịch (UC-B03)."""
    # Đọc cấu hình lúc gọi hàm (không gắn cứng lúc import) để thay đổi settings có hiệu lực ngay
    if slot_minutes is None:
        slot_minutes = settings.SLOT_DURATION_MINUTES
    slot_length = timedelta(minutes=slot_minutes)
    booked_ranges = list(booked_ranges)
    slots: List[TimeSlotResponse] = []

    # Ca chồng lấn lệch mốc (dữ liệu nhập sai, VD 08:00-10:00 và 08:15-10:15) được gộp trước khi chia,
    # nếu chia riêng từng ca sẽ sinh ra các slot 08:00, 08:15... đè lên nhau
    for curr_dt, end_dt in _merge_shifts(query_date, shifts):
        # Slot cuối phải kết thúc trước hoặc đúng giờ hết ca, phần dư lẻ (< 30 phút) bị bỏ
        while curr_dt + slot_length <= end_dt:
            if overlaps_any(curr_dt, curr_dt + slot_length, booked_ranges):
                slot_status = "booked"     # Đã có người đặt
            elif curr_dt < now:
                slot_status = "past"       # Đã qua hoặc đang diễn ra, không nhận đặt nữa
            else:
                slot_status = "available"  # Còn trống, sẵn sàng nhận đặt

            slot_time = curr_dt.time()
            slots.append(TimeSlotResponse(time_str=slot_time.strftime("%H:%M"), time_val=slot_time, status=slot_status))
            curr_dt += slot_length

    return slots


class AppointmentService:
    """Tầng Control xử lý nghiệp vụ đặt lịch, tính toán slot động và kiểm soát xung đột (Package B)"""

    async def _get_active_doctor(self, doctor_id: int, db: AsyncSession) -> Tuple[BacSi, NguoiDung, str]:
        """Lấy Bác sĩ còn hoạt động kèm họ tên và tên chuyên khoa; dùng chung cho tra cứu slot và đặt lịch.
        Dùng đúng điều kiện hiển thị của danh mục UC-B01 (ngừng hành nghề, hồ sơ đã xóa, chuyên khoa đóng):
        bác sĩ bị ẩn khỏi danh mục thì cũng không nhận lịch, coi như không tồn tại với bệnh nhân (404)"""
        stmt_bs = medical_service._visible_doctors(BacSi, NguoiDung, ChuyenKhoa).where(BacSi.id == doctor_id)
        bs_row = (await db.execute(stmt_bs)).first()
        if not bs_row:
            raise NotFoundException(f"Không tìm thấy Bác sĩ với mã ID {doctor_id}")

        bac_si, nguoi_dung, chuyen_khoa = bs_row
        return bac_si, nguoi_dung, chuyen_khoa.ten_chuyen_khoa if chuyen_khoa else DEFAULT_SPECIALTY_NAME

    async def _get_occupied_ranges(
        self,
        owner_filter,
        query_date: date,
        db: AsyncSession
    ) -> List[Tuple[datetime, datetime]]:
        """Các khoảng [bắt đầu, kết thúc) của lịch hẹn đang chiếm chỗ trong ngày (lọc theo bác sĩ hoặc bệnh nhân).
        Loại trừ lịch đã hủy/tự động hủy - khớp Unique Partial Index uq_active_doctor_slot trên CSDL"""
        stmt_lk = select(LichKham.gio_kham, LichKham.thoi_luong_phut).where(
            and_(
                owner_filter,
                LichKham.ngay_kham == query_date,
                LichKham.trang_thai.in_(OCCUPYING_SLOT_STATUSES)
            )
        )
        occupied_ranges = []
        for gio_kham, thoi_luong_phut in (await db.execute(stmt_lk)).all():
            start_dt = datetime.combine(query_date, gio_kham)
            occupied_ranges.append((start_dt, start_dt + timedelta(minutes=thoi_luong_phut)))
        return occupied_ranges

    async def _compute_day_slots(
        self,
        doctor_id: int,
        query_date: date,
        db: AsyncSession,
        lock_shifts: bool = False,
        slot_minutes: Optional[int] = None
    ) -> List[TimeSlotResponse]:
        """Đọc ca làm việc + lịch đã đặt của Bác sĩ trong ngày rồi chạy thuật toán chia slot"""
        # Chỉ lấy ca còn hiệu lực (ca nghỉ đột xuất có is_active = False)
        stmt_llv = select(LichLamViec.gio_bat_dau, LichLamViec.gio_ket_thuc).where(
            and_(
                LichLamViec.bac_si_id == doctor_id,
                LichLamViec.ngay_lam_viec == query_date,
                LichLamViec.is_active.is_(True)
            )
        ).order_by(LichLamViec.id)
        if lock_shifts:
            # CHỐT CHẶN CONCURRENCY: khóa các dòng ca làm việc (luôn tồn tại khi slot hợp lệ) để mọi yêu cầu
            # đặt lịch cùng Bác sĩ, cùng ngày được tuần tự hóa. Khóa dòng LichKham của slot trống thì không có
            # dòng nào để khóa, 2 request đồng thời sẽ cùng lọt qua bước kiểm tra.
            # ORDER BY id để mọi giao dịch khóa ca sáng/chiều theo cùng thứ tự, tránh deadlock
            stmt_llv = stmt_llv.with_for_update()
        shifts = (await db.execute(stmt_llv)).all()

        booked_ranges = await self._get_occupied_ranges(LichKham.bac_si_id == doctor_id, query_date, db)
        return build_day_slots(query_date, shifts, booked_ranges, clinic_now(), slot_minutes)

    async def get_doctor_available_slots(
        self,
        doctor_id: int,
        query_date: date,
        db: AsyncSession
    ) -> DoctorScheduleSlotsResponse:
        """Tính toán các khung giờ khám 30 phút còn trống trong ngày (Dynamic Slot Calculation - UC-B02)"""
        # 1. Kiểm tra Bác sĩ tồn tại và còn hoạt động
        bac_si, nguoi_dung, specialty_name = await self._get_active_doctor(doctor_id, db)

        # 2. Chia ca thành slot 30 phút và gán trạng thái available / booked / past
        generated_slots = await self._compute_day_slots(doctor_id, query_date, db)

        return DoctorScheduleSlotsResponse(
            doctor_id=bac_si.id,
            doctor_name=nguoi_dung.ho_ten,
            specialty_name=specialty_name,
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
        # 1. Xác định hồ sơ bệnh nhân từ tài khoản hiện tại; khóa dòng bệnh nhân để 2 yêu cầu đặt lịch đồng thời
        # của cùng 1 người (kể cả với 2 bác sĩ khác nhau) phải chờ nhau. Thứ tự khóa luôn là bệnh nhân -> ca
        # làm việc của bác sĩ nên không gây deadlock
        stmt_bn = (
            select(BenhNhan, NguoiDung)
            .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
            .where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
            .with_for_update(of=BenhNhan)
        )
        bn_row = (await db.execute(stmt_bn)).first()
        if not bn_row:
            raise ForbiddenException("Tài khoản chưa có hồ sơ Bệnh nhân hợp lệ!")
        benh_nhan, bn_info = bn_row
        # Bệnh nhân bị khóa đặt online (vắng mặt không báo trước nhiều lần - module No-show) chỉ đặt qua Hotline.
        # Đọc sau khi đã khóa dòng nên không lọt qua được khi cờ vừa được bật
        if benh_nhan.is_blocked_booking:
            raise ForbiddenException(
                "Tài khoản của bạn đang bị tạm khóa đặt lịch trực tuyến do vắng mặt không báo trước nhiều lần. "
                "Vui lòng liên hệ Hotline phòng khám để được hỗ trợ!"
            )

        # 2. Bác sĩ phải tồn tại và còn hoạt động (404 thay vì lỗi khóa ngoại 500)
        bac_si, bs_info, specialty_name = await self._get_active_doctor(payload.bac_si_id, db)

        # 3. Không cho phép đặt ngày trong quá khứ (so theo giờ phòng khám)
        slot_minutes = settings.SLOT_DURATION_MINUTES
        booking_dt = datetime.combine(payload.ngay_kham, payload.gio_kham)
        booking_end = booking_dt + timedelta(minutes=slot_minutes)
        if booking_dt < clinic_now():
            raise AppException("Không thể đặt lịch khám trong quá khứ!")

        # 4. Bệnh nhân không được có lịch khác chồng giờ (so theo khoảng thời gian, không chỉ giờ bắt đầu)
        patient_ranges = await self._get_occupied_ranges(LichKham.benh_nhan_id == benh_nhan.id, payload.ngay_kham, db)
        if overlaps_any(booking_dt, booking_end, patient_ranges):
            raise ConflictException("Bạn đã có một lịch hẹn khám khác trong khung giờ này!")

        # 5. Khóa ca làm việc rồi đối chiếu với đúng thuật toán slot của UC-B02: chỉ đặt được giờ đang hiển thị
        # 'available' - chặn giờ lệch mốc (08:15), ngoài ca/ca nghỉ, hoặc bị lịch dài 60 phút chiếm một phần
        slots = await self._compute_day_slots(
            payload.bac_si_id, payload.ngay_kham, db, lock_shifts=True, slot_minutes=slot_minutes
        )
        chosen_slot = next((slot for slot in slots if slot.time_val == payload.gio_kham), None)
        if chosen_slot is None:
            raise AppException(
                f"Khung giờ đã chọn không nằm trong lịch làm việc của Bác sĩ! "
                f"Vui lòng chọn một mốc {slot_minutes} phút còn trống trong ca."
            )
        if chosen_slot.status == "booked":
            raise ConflictException("Rất tiếc! Khung giờ này vừa được người bệnh khác giữ chỗ trước.")
        if chosen_slot.status != "available":
            raise AppException("Không thể đặt lịch khám trong quá khứ!")

        # 5b. Kiểm tra giới hạn số lượng người bệnh trong ca (gioi_han_ca_kham):
        stmt_active_shift = select(LichLamViec).where(
            and_(
                LichLamViec.bac_si_id == payload.bac_si_id,
                LichLamViec.ngay_lam_viec == payload.ngay_kham,
                LichLamViec.gio_bat_dau <= payload.gio_kham,
                LichLamViec.gio_ket_thuc >= booking_end.time(),
                LichLamViec.is_active.is_(True),
            )
        )
        active_shift = (await db.execute(stmt_active_shift)).scalar_one_or_none()
        if active_shift and active_shift.gioi_han_ca_kham:
            stmt_shift_bookings = select(func.count(LichKham.id)).where(
                and_(
                    LichKham.bac_si_id == payload.bac_si_id,
                    LichKham.ngay_kham == payload.ngay_kham,
                    LichKham.gio_kham >= active_shift.gio_bat_dau,
                    LichKham.gio_kham < active_shift.gio_ket_thuc,
                    LichKham.trang_thai.in_(OCCUPYING_SLOT_STATUSES),
                )
            )
            booked_in_shift = (await db.execute(stmt_shift_bookings)).scalar() or 0
            if booked_in_shift >= active_shift.gioi_han_ca_kham:
                raise ConflictException(
                    f"Ca khám này của Bác sĩ đã đạt giới hạn tiếp nhận tối đa ({active_shift.gioi_han_ca_kham} người bệnh). "
                    "Vui lòng chọn ca khám khác!"
                )


        # 6. Số thứ tự khám = số lớn nhất đã cấp + 1 (tính cả lịch đã hủy) để không trùng số của lịch còn hiệu lực;
        # mã lịch đếm cả lịch đã hủy để không trùng mã đã cấp (lịch không bao giờ bị xóa, chỉ đổi trạng thái)
        # - an toàn nhờ khóa ca ở bước 5
        stmt_count = select(
            func.count(LichKham.id),
            func.coalesce(func.max(LichKham.so_thu_tu), 0)
        ).where(
            and_(
                LichKham.bac_si_id == payload.bac_si_id,
                LichKham.ngay_kham == payload.ngay_kham
            )
        )
        total_count, max_so_thu_tu = (await db.execute(stmt_count)).one()
        so_thu_tu = max_so_thu_tu + 1

        # 7. Sinh mã lịch khám duy nhất theo mẫu: LK-YYYYMMDD-<mã BS><thứ tự cấp mã>
        ma_lich = f"LK-{payload.ngay_kham.strftime('%Y%m%d')}-{payload.bac_si_id:02d}{total_count + 1:03d}"

        # 8. Khởi tạo bản ghi LichKham
        lich_kham = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=benh_nhan.id,
            bac_si_id=payload.bac_si_id,
            ngay_kham=payload.ngay_kham,
            gio_kham=payload.gio_kham,
            thoi_luong_phut=slot_minutes,
            so_thu_tu=so_thu_tu,
            ly_do_kham=payload.ly_do_kham,
            trieu_chung_ban_dau=payload.trieu_chung_ban_dau,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value
        )
        db.add(lich_kham)
        try:
            await db.commit()
        except IntegrityError as exc:
            # Chốt chặn cuối: Unique Partial Index cấp CSDL bắt được xung đột lọt qua khóa dòng -> trả 409, không 500.
            # Chỉ 2 index trùng giờ mới là xung đột đặt chỗ; vi phạm ràng buộc khác là lỗi hệ thống, không che đi
            await db.rollback()
            violated = str(exc.orig)
            if "uq_active_patient_slot" in violated:
                raise ConflictException("Bạn đã có một lịch hẹn khám khác trong khung giờ này!")
            if "uq_active_doctor_slot" in violated:
                logger.warning(f"⚠️ [BOOKING CONFLICT] Bác sĩ {payload.bac_si_id} | {booking_dt} | vi phạm ràng buộc CSDL")
                raise ConflictException("Rất tiếc! Khung giờ này vừa được người bệnh khác giữ chỗ trước.")
            raise
        await db.refresh(lich_kham)

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
                chuyen_khoa=specialty_name,
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
    ) -> AppointmentCancelResponse:
        """Hủy lịch hẹn khám với ràng buộc an toàn y tế tối thiểu 02 tiếng (UC-B05)"""
        # 1. Khóa dòng lịch hẹn để 2 yêu cầu hủy/đổi đồng thời được tuần tự hóa
        stmt = select(LichKham).where(LichKham.id == appointment_id).with_for_update()
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        # 2. Kiểm tra quyền trước trạng thái để không lộ tình trạng lịch hẹn của người khác
        # Bệnh nhân chỉ hủy lịch của mình, Bác sĩ chỉ hủy lịch mình phụ trách, Admin có toàn quyền
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

        # 3. Chỉ lịch chưa diễn ra (chờ xác nhận / đã xác nhận) mới được hủy
        if lich.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Lịch hẹn này đã bị hủy trước đó!")
        if lich.trang_thai not in CANCELLABLE_STATUSES:
            raise ConflictException(
                f"Lịch hẹn đang ở trạng thái '{lich.trang_thai}' (đang khám/đã khám/vắng mặt) nên không thể hủy!"
            )
        if lich.trang_thai == TrangThaiLichEnum.DA_TIEP_NHAN.value and user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            raise ConflictException(
                "Lịch hẹn đã được tiếp nhận tại quầy! Vui lòng liên hệ Lễ tân để hủy hoặc đổi lịch."
            )

        # 4. Ràng buộc thời gian tính theo giờ phòng khám: Đã tới hoặc qua giờ khám thì không ai được hủy
        appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        diff_hours = (appointment_dt - clinic_now()).total_seconds() / 3600.0

        if diff_hours <= 0:
            raise ConflictException("Đã tới hoặc đã qua giờ khám, không thể hủy lịch hẹn này!")

        # Bệnh nhân phải hủy trước tối thiểu 02 tiếng; Bác sĩ/Admin/Lễ tân (tiếp nhận qua Hotline hoặc tại quầy) được hủy sát giờ
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value and diff_hours < settings.CANCELLATION_MINIMUM_HOURS:
            raise AppException(
                f"Theo quy định phòng khám, bạn chỉ có thể hủy lịch trước giờ khám tối thiểu "
                f"{settings.CANCELLATION_MINIMUM_HOURS} tiếng. Vui lòng gọi Hotline để được hỗ trợ khẩn cấp!"
            )

        # 5. Cập nhật trạng thái - khung giờ được giải phóng vì mọi truy vấn slot đều loại trừ lịch đã hủy
        lich.trang_thai = TrangThaiLichEnum.DA_HUY.value
        lich.ly_do_huy = payload.ly_do_huy
        lich.thoi_gian_huy = datetime.now(timezone.utc)
        lich.nguoi_huy_vai_tro = user.vai_tro

        # Hủy vé hàng đợi liên quan nếu bệnh nhân đã check-in trước đó (Quy tắc Bahmni Lifecycle)
        stmt_ticket = select(HangDoiKham).where(
            HangDoiKham.lich_kham_id == lich.id,
            HangDoiKham.trang_thai.in_([
                TrangThaiHangDoiEnum.CHO_KHAM.value,
                TrangThaiHangDoiEnum.TAM_HOAN.value,
            ]),
        )
        active_tickets = (await db.execute(stmt_ticket)).scalars().all()
        for ticket in active_tickets:
            ticket.trang_thai = TrangThaiHangDoiEnum.BO_KHAM.value
            ticket.ghi_chu_dieu_phoi = (
                f"{ticket.ghi_chu_dieu_phoi or ''} | Đóng vé sảnh do hủy lịch hẹn (Quy tắc Bahmni)".strip(" |")
            )

        await db.commit()

        # Tự động tìm và đôn ứng viên đầu tiên trong Danh sách chờ (Waitlist Promotion)
        promoted = await self._promote_waitlist_candidate(lich, db)
        if promoted:
            await db.commit()


        logger.info(f"🚫 [APPOINTMENT CANCELLED] ID: {appointment_id} | Người hủy: {user.vai_tro} | Lý do: {payload.ly_do_huy}")
        return AppointmentCancelResponse(
            appointment_id=lich.id,
            ma_lich_kham=lich.ma_lich_kham,
            trang_thai=lich.trang_thai,
            ly_do_huy=lich.ly_do_huy,
            thoi_gian_huy=lich.thoi_gian_huy,
            nguoi_huy_vai_tro=lich.nguoi_huy_vai_tro
        )

    async def reschedule_booking(
        self,
        appointment_id: int,
        payload: AppointmentRescheduleRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> AppointmentResponse:
        """Đổi lịch hẹn khám sang khung giờ mới (hoặc bác sĩ mới) với ràng buộc an toàn y tế tối thiểu 02 tiếng (UC-B03/B05)"""
        # 1. Khóa dòng lịch hẹn cũ
        stmt = select(LichKham).where(LichKham.id == appointment_id).with_for_update()
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        # 2. Kiểm tra phân quyền RBAC
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
            bn = (await db.execute(stmt_bn)).scalar_one_or_none()
            if not bn or lich.benh_nhan_id != bn.id:
                raise ForbiddenException("Bạn không có quyền đổi lịch hẹn của người khác!")
        elif user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs = (await db.execute(stmt_bs)).scalar_one_or_none()
            if not bs or lich.bac_si_id != bs.id:
                raise ForbiddenException("Bạn chỉ có thể đổi lịch khám thuộc trách nhiệm phụ trách của mình!")

        # 3. Trạng thái lịch phải là chưa diễn ra
        if lich.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Lịch hẹn này đã bị hủy trước đó!")
        if lich.trang_thai not in CANCELLABLE_STATUSES:
            raise ConflictException(
                f"Lịch hẹn đang ở trạng thái '{lich.trang_thai}' nên không thể đổi lịch!"
            )

        # 4. Ràng buộc thời gian cách giờ khám cũ tối thiểu 02 tiếng
        old_appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        diff_hours = (old_appointment_dt - clinic_now()).total_seconds() / 3600.0

        if diff_hours <= 0 and user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            raise ConflictException("Đã tới hoặc đã qua giờ khám cũ, không thể đổi lịch hẹn này!")

        if user.vai_tro == VaiTroEnum.BENH_NHAN.value and diff_hours < settings.CANCELLATION_MINIMUM_HOURS:
            raise AppException(
                f"Theo quy định phòng khám, bạn chỉ có thể đổi lịch trước giờ khám cũ tối thiểu "
                f"{settings.CANCELLATION_MINIMUM_HOURS} tiếng. Vui lòng gọi Hotline để được hỗ trợ khẩn cấp!"
            )

        # 5. Xác định bác sĩ mục tiêu và kiểm tra hoạt động
        target_bs_id = payload.bac_si_id_moi or lich.bac_si_id
        bac_si, bs_info, specialty_name = await self._get_active_doctor(target_bs_id, db)

        # 6. Kiểm tra ngày/giờ khám mới
        slot_minutes = settings.SLOT_DURATION_MINUTES
        new_booking_dt = datetime.combine(payload.ngay_kham_moi, payload.gio_kham_moi)
        new_booking_end = new_booking_dt + timedelta(minutes=slot_minutes)

        if new_booking_dt < clinic_now():
            raise AppException("Không thể đổi sang khung giờ trong quá khứ!")

        # 7. Kiểm tra ca trực của bác sĩ mục tiêu trong ngày mới
        shift = await self._find_doctor_shift(target_bs_id, payload.ngay_kham_moi, payload.gio_kham_moi, new_booking_end.time(), db)
        is_off, off_reason = await self._is_doctor_off(target_bs_id, payload.ngay_kham_moi, db)
        if is_off:
            raise ConflictException(f"Bác sĩ có lịch nghỉ đột xuất vào ngày {payload.ngay_kham_moi}: {off_reason}")

        # Khóa ca làm việc mục tiêu
        stmt_shift_lock = select(LichLamViec).where(LichLamViec.id == shift.id).with_for_update()
        shift = (await db.execute(stmt_shift_lock)).scalar_one()

        # 8. Kiểm tra bệnh nhân không bị trùng với lịch khác của chính mình
        stmt_dup = select(LichKham).where(
            LichKham.id != lich.id,
            LichKham.benh_nhan_id == lich.benh_nhan_id,
            LichKham.ngay_kham == payload.ngay_kham_moi,
            LichKham.gio_kham == payload.gio_kham_moi,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES)
        )
        if (await db.execute(stmt_dup)).first():
            raise ConflictException("Bạn đã có một lịch hẹn khám khác trong khung giờ này!")

        # 9. Kiểm tra slot mới của bác sĩ đã bị ai đặt chưa (Pessimistic Check)
        stmt_slot = select(LichKham).where(
            LichKham.id != lich.id,
            LichKham.bac_si_id == target_bs_id,
            LichKham.ngay_kham == payload.ngay_kham_moi,
            LichKham.gio_kham == payload.gio_kham_moi,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES)
        )
        if (await db.execute(stmt_slot)).first():
            raise ConflictException(f"Rất tiếc! Khung giờ {payload.gio_kham_moi.strftime('%H:%M')} ngày {payload.ngay_kham_moi} vừa được người bệnh khác đặt trước.")

        # 10. Tính số thứ tự trong ca mới
        stmt_stt = select(func.max(LichKham.so_thu_tu)).where(
            LichKham.id != lich.id,
            LichKham.bac_si_id == target_bs_id,
            LichKham.ngay_kham == payload.ngay_kham_moi,
            LichKham.ca_kham == shift.ca_lam_viec,
            LichKham.trang_thai.notin_(CANCELLED_STATUSES)
        )
        max_stt = (await db.execute(stmt_stt)).scalar() or 0
        new_stt = max_stt + 1

        # Lưu thông tin slot cũ để phục vụ đôn waitlist
        old_bs_id = lich.bac_si_id
        old_ngay = lich.ngay_kham
        old_gio = lich.gio_kham

        # 11. Cập nhật bản ghi LichKham
        note_change = f"Đổi từ {old_ngay} {old_gio.strftime('%H:%M')} (BS ID {old_bs_id}). Lý do: {payload.ly_do_doi or 'Không có'}"
        lich.ghi_chu = f"{lich.ghi_chu} | {note_change}" if lich.ghi_chu else note_change
        lich.ngay_kham = payload.ngay_kham_moi
        lich.gio_kham = payload.gio_kham_moi
        lich.bac_si_id = target_bs_id
        lich.ca_kham = shift.ca_lam_viec
        lich.so_thu_tu = new_stt
        lich.trang_thai = TrangThaiLichEnum.DA_XAC_NHAN.value

        # Hủy vé hàng đợi cũ nếu đã check-in trước đó (Quy tắc Bahmni Appointment Reschedule)
        stmt_ticket = select(HangDoiKham).where(
            HangDoiKham.lich_kham_id == lich.id,
            HangDoiKham.trang_thai.in_([
                TrangThaiHangDoiEnum.CHO_KHAM.value,
                TrangThaiHangDoiEnum.TAM_HOAN.value,
            ]),
        )
        active_tickets = (await db.execute(stmt_ticket)).scalars().all()
        for ticket in active_tickets:
            ticket.trang_thai = TrangThaiHangDoiEnum.BO_KHAM.value
            ticket.ghi_chu_dieu_phoi = (
                f"{ticket.ghi_chu_dieu_phoi or ''} | Đóng vé sảnh do dời lịch sang {payload.ngay_kham_moi} (Quy tắc Bahmni)".strip(" |")
            )

        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise ConflictException("Khung giờ mới vừa có xung đột đặt chỗ!")

        # 12. Tự động đôn Waitlist cho slot cũ vừa được giải phóng
        class _OldSlotProxy:
            def __init__(self, b_id, d, t):
                self.bac_si_id = b_id
                self.ngay_kham = d
                self.gio_kham = t
        promoted = await self._promote_waitlist_candidate(_OldSlotProxy(old_bs_id, old_ngay, old_gio), db)
        if promoted:
            await db.commit()

        # Lấy thông tin bệnh nhân để trả về response
        stmt_bn_info = select(BenhNhan, NguoiDung).join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id).where(BenhNhan.id == lich.benh_nhan_id)
        benh_nhan, bn_info = (await db.execute(stmt_bn_info)).first()

        logger.info(f"🔄 [APPOINTMENT RESCHEDULED] Mã: {lich.ma_lich_kham} | Sang ngày: {payload.ngay_kham_moi} {payload.gio_kham_moi}")
        return AppointmentResponse(
            id=lich.id,
            ma_lich_kham=lich.ma_lich_kham,
            ngay_kham=lich.ngay_kham,
            gio_kham=lich.gio_kham,
            so_thu_tu=lich.so_thu_tu,
            trang_thai=lich.trang_thai,
            ly_do_kham=lich.ly_do_kham,
            trieu_chung_ban_dau=lich.trieu_chung_ban_dau,
            bac_si=DoctorBriefResponse(
                id=bac_si.id,
                ho_ten=bs_info.ho_ten,
                chuyen_khoa=specialty_name,
                hoc_vi=bac_si.hoc_vi
            ),
            benh_nhan=PatientBriefResponse(
                id=benh_nhan.id,
                ho_ten=bn_info.ho_ten,
                so_dien_thoai=bn_info.so_dien_thoai
            )
        )

    async def get_patient_appointments(
        self,
        user: TaiKhoan,
        db: AsyncSession,
        trang_thai: Optional[str] = None
    ) -> List[AppointmentResponse]:
        """Bệnh nhân tra cứu lịch sử và danh sách lịch hẹn của bản thân kèm số thứ tự (UC-B04)"""
        # 1. Ràng buộc phân quyền RBAC: Chức năng chỉ dành riêng cho vai trò Bệnh nhân
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chức năng tra cứu lịch hẹn cá nhân chỉ dành riêng cho Bệnh nhân!")

        # 2. Xác định hồ sơ bệnh nhân từ tài khoản hiện tại
        stmt_bn = select(BenhNhan, NguoiDung).join(
            NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id
        ).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        bn_row = (await db.execute(stmt_bn)).first()

        if not bn_row:
            raise ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bệnh nhân hợp lệ!")

        benh_nhan, bn_info = bn_row

        # 2. Xây dựng câu truy vấn danh sách lịch hẹn kèm thông tin Bác sĩ và Chuyên khoa
        stmt_lk = (
            select(LichKham, BacSi, NguoiDung, ChuyenKhoa)
            .join(BacSi, LichKham.bac_si_id == BacSi.id)
            .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
            .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
            .where(LichKham.benh_nhan_id == benh_nhan.id)
        )

        # Hỗ trợ lọc theo trạng thái nếu có
        if trang_thai:
            stmt_lk = stmt_lk.where(LichKham.trang_thai == trang_thai)

        # Sắp xếp lịch hẹn theo ngày và giờ mới nhất
        stmt_lk = stmt_lk.order_by(LichKham.ngay_kham.desc(), LichKham.gio_kham.desc())

        rows = (await db.execute(stmt_lk)).all()

        # 3. Ánh xạ sang danh sách DTO AppointmentResponse kèm số thứ tự khám (so_thu_tu)
        appointments: List[AppointmentResponse] = []
        for lk, bs, bs_info, ck in rows:
            appointments.append(
                AppointmentResponse(
                    id=lk.id,
                    ma_lich_kham=lk.ma_lich_kham,
                    ngay_kham=lk.ngay_kham,
                    gio_kham=lk.gio_kham,
                    so_thu_tu=lk.so_thu_tu,
                    trang_thai=lk.trang_thai,
                    ly_do_kham=lk.ly_do_kham,
                    trieu_chung_ban_dau=lk.trieu_chung_ban_dau,
                    bac_si=DoctorBriefResponse(
                        id=bs.id,
                        ho_ten=bs_info.ho_ten,
                        chuyen_khoa=ck.ten_chuyen_khoa if ck else "Nội khoa",
                        hoc_vi=bs.hoc_vi
                    ),
                    benh_nhan=PatientBriefResponse(
                        id=benh_nhan.id,
                        ho_ten=bn_info.ho_ten,
                        so_dien_thoai=bn_info.so_dien_thoai
                    )
                )
            )

        logger.info(
            f"📋 [PATIENT APPOINTMENTS] Bệnh nhân ID: {benh_nhan.id} | "
            f"Số lịch tìm thấy: {len(appointments)}"
        )
        return appointments

    async def _promote_waitlist_candidate(self, lich: LichKham, db: AsyncSession) -> Optional[DanhSachCho]:
        """Tự động tìm và đôn ứng viên xếp đầu danh sách chờ (Waitlist) khi có slot trống"""
        ca = CaLamViecEnum.SANG.value if lich.gio_kham < time(12, 0) else CaLamViecEnum.CHIEU.value
        stmt_candidate = (
            select(DanhSachCho)
            .where(
                and_(
                    DanhSachCho.bac_si_id == lich.bac_si_id,
                    DanhSachCho.ngay_mong_muon == lich.ngay_kham,
                    DanhSachCho.ca_mong_muon == ca,
                    DanhSachCho.trang_thai == TrangThaiWaitlistEnum.DANG_CHO.value
                )
            )
            .order_by(DanhSachCho.thu_tu_uu_tien.asc(), DanhSachCho.created_at.asc())
            .with_for_update()
        )
        candidate = (await db.execute(stmt_candidate)).scalars().first()
        if candidate:
            now = datetime.now(timezone.utc)
            candidate.trang_thai = TrangThaiWaitlistEnum.DA_THONG_BAO.value
            candidate.slot_duoc_cap_id = lich.id
            candidate.thoi_gian_thong_bao = now
            candidate.thoi_gian_het_han_giu_slot = now + timedelta(minutes=30)
            logger.info(
                f"📢 [WAITLIST PROMOTED] Bệnh nhân ID: {candidate.benh_nhan_id} được giữ slot {lich.ma_lich_kham} trong 30 phút!"
            )
            return candidate
        return None

    async def confirm_appointment(
        self,
        appointment_id: int,
        user: TaiKhoan,
        db: AsyncSession
    ) -> AppointmentConfirmResponse:
        """Bệnh nhân xác nhận lịch hẹn trước 24h để giữ slot khám (Reconfirmation Flow)"""
        stmt = select(LichKham).where(LichKham.id == appointment_id).with_for_update()
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:  
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        # Bệnh nhân chỉ xác nhận lịch của mình; Bác sĩ/Admin được xác nhận thay qua hotline
        if user.vai_tro == VaiTroEnum.BENH_NHAN.value:
            stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
            bn = (await db.execute(stmt_bn)).scalar_one_or_none()
            if not bn or lich.benh_nhan_id != bn.id:
                raise ForbiddenException("Bạn không có quyền xác nhận lịch hẹn của người khác!")

        if lich.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Lịch hẹn này đã bị hủy trước đó, không thể xác nhận!")

        if lich.trang_thai == TrangThaiLichEnum.DA_XAC_NHAN.value and lich.is_reconfirmed_24h:
            raise ConflictException("Lịch hẹn này đã được xác nhận trước đó!")

        if lich.trang_thai not in (TrangThaiLichEnum.CHO_XAC_NHAN.value, TrangThaiLichEnum.DA_XAC_NHAN.value):
            raise ConflictException(f"Lịch hẹn đang ở trạng thái '{lich.trang_thai}', không thể xác nhận!")

        appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        if (appointment_dt - clinic_now()).total_seconds() <= 0:
            raise ConflictException("Đã tới hoặc đã qua giờ khám, không thể xác nhận lịch hẹn này!")

        now = datetime.now(timezone.utc)
        lich.is_reconfirmed_24h = True
        lich.trang_thai = TrangThaiLichEnum.DA_XAC_NHAN.value
        lich.thoi_gian_xac_nhan = now
        await db.commit()

        logger.info(f"✅ [APPOINTMENT CONFIRMED] Mã: {lich.ma_lich_kham} | Bệnh nhân: {lich.benh_nhan_id} đã xác nhận 24h.")
        return AppointmentConfirmResponse(
            appointment_id=lich.id,
            ma_lich_kham=lich.ma_lich_kham,
            trang_thai=lich.trang_thai,
            is_reconfirmed_24h=lich.is_reconfirmed_24h,
            thoi_gian_xac_nhan=lich.thoi_gian_xac_nhan,
            message="Xác nhận lịch hẹn khám thành công! Chúc bạn có buổi khám sức khỏe thuận lợi."
        )

    async def mark_no_show(
        self,
        appointment_id: int,
        payload: NoShowMarkRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> NoShowMarkResponse:
        """Bác sĩ hoặc Quản trị viên đánh dấu người bệnh vắng mặt không lý do (No-show)"""
        if user.vai_tro not in (VaiTroEnum.BAC_SI.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chỉ Bác sĩ phụ trách hoặc Quản trị viên mới có quyền đánh dấu No-show!")

        stmt = select(LichKham).where(LichKham.id == appointment_id).with_for_update()
        lich = (await db.execute(stmt)).scalar_one_or_none()
        if not lich:
            raise NotFoundException("Không tìm thấy thông tin lịch hẹn yêu cầu!")

        if user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bs = (await db.execute(stmt_bs)).scalar_one_or_none()
            if not bs or lich.bac_si_id != bs.id:
                raise ForbiddenException("Bạn chỉ có thể đánh dấu No-show cho lịch khám do mình phụ trách!")

        if lich.trang_thai in CANCELLED_STATUSES:
            raise ConflictException("Lịch hẹn này đã bị hủy, không thể đánh dấu No-show!")

        if lich.trang_thai == TrangThaiLichEnum.NO_SHOW.value:
            raise ConflictException("Lịch hẹn này đã được đánh dấu No-show trước đó!")

        if lich.trang_thai in (TrangThaiLichEnum.DANG_KHAM.value, TrangThaiLichEnum.DA_KHAM.value):
            raise ConflictException("Người bệnh đã được tiếp nhận hoặc đã hoàn tất ca khám, không thể ghi nhận No-show!")

        appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        if appointment_dt > clinic_now() + timedelta(minutes=15):
            raise ConflictException("Chưa đến giờ hẹn khám của người bệnh, không thể đánh dấu No-show trước giờ!")

        lich.trang_thai = TrangThaiLichEnum.NO_SHOW.value

        stmt_bn = select(BenhNhan).where(BenhNhan.id == lich.benh_nhan_id).with_for_update()
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if benh_nhan:
            benh_nhan.so_lan_no_show += 1
            tong_so_lan = benh_nhan.so_lan_no_show
        else:
            tong_so_lan = 1

        await db.commit()

        canh_bao = tong_so_lan >= 3
        logger.warning(f"⚠️ [NO-SHOW MARKED] Mã hẹn: {lich.ma_lich_kham} | Bệnh nhân ID: {lich.benh_nhan_id} | Tổng vi phạm: {tong_so_lan}")
        return NoShowMarkResponse(
            appointment_id=lich.id,
            ma_lich_kham=lich.ma_lich_kham,
            trang_thai=lich.trang_thai,
            benh_nhan_id=lich.benh_nhan_id,
            so_lan_no_show=tong_so_lan,
            canh_bao_khoa_tai_khoan=canh_bao
        )

    async def register_waitlist(
        self,
        payload: WaitlistCreateRequest,
        user: TaiKhoan,
        db: AsyncSession
    ) -> WaitlistResponse:
        """Bệnh nhân đăng ký vào danh sách chờ khi ca khám hết slot (OpenMRS Smart Waitlist)"""
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chức năng đăng ký danh sách chờ chỉ dành riêng cho Bệnh nhân!")

        stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not benh_nhan:
            raise ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bệnh nhân hợp lệ!")

        # Chặn nếu vi phạm No-show quá 3 lần
        if benh_nhan.so_lan_no_show >= 3:
            raise ForbiddenException("Tài khoản của bạn đã vi phạm No-show quá 3 lần. Vui lòng liên hệ Hotline phòng khám để được hỗ trợ!")

        # Kiểm tra Bác sĩ tồn tại và đang hoạt động
        bac_si, bs_info, specialty_name = await self._get_active_doctor(payload.bac_si_id, db)

        # Kiểm tra ngày mong muốn
        if payload.ngay_mong_muon < clinic_now().date():
            raise AppException("Không thể đăng ký danh sách chờ cho ngày trong quá khứ!")

        # Kiểm tra xem bệnh nhân đã có yêu cầu chờ cho cùng Bác sĩ + Ngày + Ca chưa
        stmt_exist = select(DanhSachCho).where(
            and_(
                DanhSachCho.benh_nhan_id == benh_nhan.id,
                DanhSachCho.bac_si_id == payload.bac_si_id,
                DanhSachCho.ngay_mong_muon == payload.ngay_mong_muon,
                DanhSachCho.ca_mong_muon == payload.ca_mong_muon,
                DanhSachCho.trang_thai == TrangThaiWaitlistEnum.DANG_CHO.value
            )
        )
        if (await db.execute(stmt_exist)).scalar_one_or_none():
            raise ConflictException("Bạn đã có một yêu cầu trong danh sách chờ cho ca khám này rồi!")

        # Tính thứ tự ưu tiên (FIFO)
        stmt_max = select(func.coalesce(func.max(DanhSachCho.thu_tu_uu_tien), 0)).where(
            and_(
                DanhSachCho.bac_si_id == payload.bac_si_id,
                DanhSachCho.ngay_mong_muon == payload.ngay_mong_muon,
                DanhSachCho.ca_mong_muon == payload.ca_mong_muon,
                DanhSachCho.trang_thai == TrangThaiWaitlistEnum.DANG_CHO.value
            )
        )
        max_priority = (await db.execute(stmt_max)).scalar() or 0
        thu_tu_uu_tien = max_priority + 1

        entry = DanhSachCho(
            benh_nhan_id=benh_nhan.id,
            bac_si_id=payload.bac_si_id,
            ngay_mong_muon=payload.ngay_mong_muon,
            ca_mong_muon=payload.ca_mong_muon,
            trieu_chung=payload.trieu_chung,
            thu_tu_uu_tien=thu_tu_uu_tien,
            trang_thai=TrangThaiWaitlistEnum.DANG_CHO.value
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)

        logger.info(f"⏳ [WAITLIST REGISTERED] Bệnh nhân: {benh_nhan.id} | Bác sĩ: {payload.bac_si_id} | Thứ tự: {thu_tu_uu_tien}")
        return WaitlistResponse(
            id=entry.id,
            benh_nhan_id=entry.benh_nhan_id,
            bac_si_id=entry.bac_si_id,
            bac_si_ho_ten=bs_info.ho_ten,
            chuyen_khoa=specialty_name,
            ngay_mong_muon=entry.ngay_mong_muon,
            ca_mong_muon=entry.ca_mong_muon,
            trieu_chung=entry.trieu_chung,
            thu_tu_uu_tien=entry.thu_tu_uu_tien,
            trang_thai=entry.trang_thai,
            thoi_gian_thong_bao=entry.thoi_gian_thong_bao,
            thoi_gian_het_han_giu_slot=entry.thoi_gian_het_han_giu_slot,
            slot_duoc_cap_id=entry.slot_duoc_cap_id,
            created_at=entry.created_at
        )

    async def get_my_waitlist(
        self,
        user: TaiKhoan,
        db: AsyncSession
    ) -> List[WaitlistResponse]:
        """Bệnh nhân tra cứu các yêu cầu trong danh sách chờ của bản thân"""
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chức năng này chỉ dành riêng cho Bệnh nhân!")

        stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        benh_nhan = (await db.execute(stmt_bn)).scalar_one_or_none()
        if not benh_nhan:
            return []

        stmt = (
            select(DanhSachCho, BacSi, NguoiDung, ChuyenKhoa)
            .join(BacSi, DanhSachCho.bac_si_id == BacSi.id)
            .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
            .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
            .where(DanhSachCho.benh_nhan_id == benh_nhan.id)
            .order_by(DanhSachCho.ngay_mong_muon.desc(), DanhSachCho.thu_tu_uu_tien.asc())
        )
        rows = (await db.execute(stmt)).all()

        results = []
        for entry, bs, bs_info, ck in rows:
            results.append(
                WaitlistResponse(
                    id=entry.id,
                    benh_nhan_id=entry.benh_nhan_id,
                    bac_si_id=entry.bac_si_id,
                    bac_si_ho_ten=bs_info.ho_ten,
                    chuyen_khoa=ck.ten_chuyen_khoa if ck else DEFAULT_SPECIALTY_NAME,
                    ngay_mong_muon=entry.ngay_mong_muon,
                    ca_mong_muon=entry.ca_mong_muon,
                    trieu_chung=entry.trieu_chung,
                    thu_tu_uu_tien=entry.thu_tu_uu_tien,
                    trang_thai=entry.trang_thai,
                    thoi_gian_thong_bao=entry.thoi_gian_thong_bao,
                    thoi_gian_het_han_giu_slot=entry.thoi_gian_het_han_giu_slot,
                    slot_duoc_cap_id=entry.slot_duoc_cap_id,
                    created_at=entry.created_at
                )
            )
        return results

    async def accept_waitlist_slot(
        self,
        waitlist_id: int,
        user: TaiKhoan,
        db: AsyncSession
    ) -> AppointmentResponse:
        """Bệnh nhân xác nhận nhận slot được cấp từ danh sách chờ (Waitlist Acceptance Flow)"""
        # 1. Ràng buộc quyền: Chỉ Bệnh nhân mới có quyền nhận slot của mình
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chỉ Bệnh nhân mới có quyền xác nhận nhận slot từ danh sách chờ!")

        stmt_bn = select(BenhNhan, NguoiDung).join(
            NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id
        ).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        bn_row = (await db.execute(stmt_bn)).first()
        if not bn_row:
            raise ForbiddenException("Tài khoản chưa được liên kết với hồ sơ Bệnh nhân hợp lệ!")
        benh_nhan, bn_info = bn_row

        # 2. Khóa dòng bản ghi danh sách chờ để chống Race Condition
        stmt_entry = select(DanhSachCho).where(DanhSachCho.id == waitlist_id).with_for_update()
        entry = (await db.execute(stmt_entry)).scalar_one_or_none()
        if not entry:
            raise NotFoundException("Không tìm thấy thông tin lượt đăng ký trong danh sách chờ!")

        if entry.benh_nhan_id != benh_nhan.id:
            raise ForbiddenException("Bạn không có quyền thao tác trên lượt đăng ký chờ của người khác!")

        if entry.trang_thai == TrangThaiWaitlistEnum.DA_NHAN_SLOT.value:
            raise ConflictException("Bạn đã xác nhận nhận slot khám này trước đó rồi!")

        if entry.trang_thai != TrangThaiWaitlistEnum.DA_THONG_BAO.value:
            raise ConflictException(
                f"Lượt đăng ký đang ở trạng thái '{entry.trang_thai}', chưa có slot trống được thông báo để nhận!"
            )

        # 3. Kiểm tra thời hạn 30 phút giữ slot
        now = datetime.now(timezone.utc)
        if entry.thoi_gian_het_han_giu_slot and now > entry.thoi_gian_het_han_giu_slot:
            entry.trang_thai = TrangThaiWaitlistEnum.DA_BO_QUA.value
            await db.commit()
            raise ConflictException("Rất tiếc! Đã quá thời hạn 30 phút giữ chỗ. Khung giờ này đã được chuyển cho người tiếp theo.")

        # 4. Lấy thông tin slot cũ đã bị hủy
        stmt_slot = select(LichKham).where(LichKham.id == entry.slot_duoc_cap_id).with_for_update()
        freed_slot = (await db.execute(stmt_slot)).scalar_one_or_none()
        if not freed_slot:
            raise NotFoundException("Không tìm thấy thông tin khung giờ khám được cấp!")

        # 5. Kiểm tra Bác sĩ còn hoạt động
        bac_si, bs_info, specialty_name = await self._get_active_doctor(entry.bac_si_id, db)

        # 6. Tính số thứ tự khám tiếp theo
        stmt_count = select(
            func.count(LichKham.id),
            func.coalesce(func.max(LichKham.so_thu_tu), 0)
        ).where(
            and_(
                LichKham.bac_si_id == entry.bac_si_id,
                LichKham.ngay_kham == freed_slot.ngay_kham
            )
        )
        total_count, max_so_thu_tu = (await db.execute(stmt_count)).one()
        so_thu_tu = max_so_thu_tu + 1
        ma_lich = f"LK-{freed_slot.ngay_kham.strftime('%Y%m%d')}-{entry.bac_si_id:02d}{total_count + 1:03d}"

        # 7. Khởi tạo lịch khám chính thức đã xác nhận cho người bệnh
        new_booking = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=benh_nhan.id,
            bac_si_id=entry.bac_si_id,
            ngay_kham=freed_slot.ngay_kham,
            gio_kham=freed_slot.gio_kham,
            thoi_luong_phut=freed_slot.thoi_luong_phut,
            so_thu_tu=so_thu_tu,
            ly_do_kham=f"Đặt từ Danh sách chờ #{entry.id} (OpenMRS Waitlist)",
            trieu_chung_ban_dau=entry.trieu_chung,
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
            is_reconfirmed_24h=True,
            thoi_gian_xac_nhan=now
        )
        db.add(new_booking)

        # 8. Cập nhật trạng thái waitlist
        entry.trang_thai = TrangThaiWaitlistEnum.DA_NHAN_SLOT.value
        await db.commit()
        await db.refresh(new_booking)

        logger.info(f"🎉 [WAITLIST ACCEPTED] Bệnh nhân: {bn_info.ho_ten} đã nhận slot thành công: {ma_lich}")

        return AppointmentResponse(
            id=new_booking.id,
            ma_lich_kham=new_booking.ma_lich_kham,
            ngay_kham=new_booking.ngay_kham,
            gio_kham=new_booking.gio_kham,
            so_thu_tu=new_booking.so_thu_tu,
            trang_thai=new_booking.trang_thai,
            ly_do_kham=new_booking.ly_do_kham,
            trieu_chung_ban_dau=new_booking.trieu_chung_ban_dau,
            bac_si=DoctorBriefResponse(
                id=bac_si.id,
                ho_ten=bs_info.ho_ten,
                chuyen_khoa=specialty_name,
                hoc_vi=bac_si.hoc_vi
            ),
            benh_nhan=PatientBriefResponse(
                id=benh_nhan.id,
                ho_ten=bn_info.ho_ten,
                so_dien_thoai=bn_info.so_dien_thoai
            )
        )

    async def auto_process_unconfirmed_and_waitlist(

        self,
        db: AsyncSession,
        hours_threshold: float = 2.0
    ) -> AutoProcessNoShowResponse:
        """Tự động hủy các lịch hẹn chưa xác nhận trước giờ khám và đôn người trong Waitlist lên"""
        now = clinic_now()
        stmt = (
            select(LichKham)
            .where(
                and_(
                    LichKham.trang_thai == TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    LichKham.is_reconfirmed_24h.is_(False)
                )
            )
            .with_for_update()
        )
        candidates = (await db.execute(stmt)).scalars().all()

        cancelled_codes: List[str] = []
        promoted_count = 0

        for lich in candidates:
            appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
            diff_hours = (appointment_dt - now).total_seconds() / 3600.0

            # Nếu thời gian đến giờ khám nhỏ hơn ngưỡng (VD 2 tiếng) và chưa quá giờ
            if 0 < diff_hours <= hours_threshold:
                lich.trang_thai = TrangThaiLichEnum.TU_DONG_HUY.value
                lich.thoi_gian_huy = datetime.now(timezone.utc)
                lich.ly_do_huy = f"Hệ thống tự động hủy do người bệnh không xác nhận lịch hẹn trước {hours_threshold:.0f} tiếng theo quy định."
                lich.nguoi_huy_vai_tro = "system"
                cancelled_codes.append(lich.ma_lich_kham)

                # Đôn người từ Waitlist
                promoted = await self._promote_waitlist_candidate(lich, db)
                if promoted:
                    promoted_count += 1

        if cancelled_codes:
            await db.commit()
            logger.info(f"🤖 [AUTO CANCEL] Đã tự động hủy {len(cancelled_codes)} lịch chưa xác nhận, đôn {promoted_count} người từ Waitlist.")

        return AutoProcessNoShowResponse(
            so_lich_tu_dong_huy=len(cancelled_codes),
            so_nguoi_don_waitlist=promoted_count,
            danh_sach_ma_lich_huy=cancelled_codes
        )

    async def get_doctor_shift_appointments(
        self,
        date_str: Optional[str],
        user: TaiKhoan,
        db: AsyncSession,
    ) -> List[dict]:
        """Lấy danh sách ca khám và lịch hẹn trong ngày phục vụ Doctor Portal Workstation"""
        bac_si = None
        if user.vai_tro == VaiTroEnum.BAC_SI.value:
            stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        elif user.vai_tro == VaiTroEnum.ADMIN.value:
            stmt_bs = select(BacSi).order_by(BacSi.id.asc()).limit(1)
            bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()

        if not bac_si:
            return []

        target_date = date.today()
        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                target_date = date.today()

        stmt = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.luot_kham),
            )
            .where(
                LichKham.bac_si_id == bac_si.id,
                LichKham.ngay_kham == target_date,
            )
            .order_by(LichKham.gio_kham.asc())
        )
        appointments = (await db.execute(stmt)).scalars().all()

        stmt_tickets = select(HangDoiKham).where(
            HangDoiKham.bac_si_id == bac_si.id,
            HangDoiKham.ngay_kham == target_date,
        )
        tickets = (await db.execute(stmt_tickets)).scalars().all()
        ticket_map = {t.lich_kham_id: t for t in tickets if t.lich_kham_id}

        priority_labels = {
            1: "Cấp cứu",
            2: "Đúng hẹn",
            3: "Trả kết quả CLS",
            4: "Đến sớm",
            5: "Vãng lai / Muộn",
        }

        results = []
        for apt in appointments:
            bn = apt.benh_nhan
            nd = bn.nguoi_dung if bn else None
            enc = apt.luot_kham
            ticket = ticket_map.get(apt.id)

            start_t = apt.gio_kham.strftime("%H:%M") if apt.gio_kham else "08:00"
            duration = apt.thoi_luong_phut or 30
            end_dt = datetime.combine(apt.ngay_kham, apt.gio_kham) + timedelta(minutes=duration)
            end_t = end_dt.strftime("%H:%M")

            vitals = None
            if enc:
                vitals = {
                    "mach": enc.mach_lan_phut or 75,
                    "nhiet_do": float(enc.nhiet_do_c) if enc.nhiet_do_c else 36.8,
                    "huyet_ap_tam_thu": enc.huyet_ap_tam_thu or 120,
                    "huyet_ap_tam_truong": enc.huyet_ap_tam_truong or 80,
                    "nhip_tho": enc.nhip_tho_lan_phut or 18,
                    "spo2": 98,
                    "can_nang": float(enc.can_nang_kg) if enc.can_nang_kg else 60.0,
                    "chieu_cao": float(enc.chieu_cao_cm) if enc.chieu_cao_cm else 165.0,
                }

            priority = ticket.muc_do_uu_tien if ticket else 4

            results.append({
                "id": apt.id,
                "appointment_code": apt.ma_lich_kham,
                "patient_name": nd.ho_ten if nd else "Bệnh nhân",
                "patient_phone": nd.so_dien_thoai if nd else "",
                "patient_gender": nd.gioi_tinh if nd else "Nam",
                "patient_birth_year": nd.ngay_sinh.year if nd and nd.ngay_sinh else 1990,
                "appointment_date": apt.ngay_kham.isoformat(),
                "start_time": start_t,
                "end_time": end_t,
                "symptoms_text": apt.trieu_chung_ban_dau or apt.ly_do_kham or "",
                "status": apt.trang_thai,
                "queue_priority": priority,
                "priority_label": priority_labels.get(priority, "Đúng hẹn"),
                "is_locked": enc.is_locked if enc else (apt.trang_thai == "da_kham"),
                "encounter_id": enc.id if enc else None,
                "vitals": vitals,
            })

        return results


appointment_service = AppointmentService()

