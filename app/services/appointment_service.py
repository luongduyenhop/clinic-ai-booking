import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.exc import IntegrityError
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, AppException
from app.core.config import settings
from app.models.user import TaiKhoan, BenhNhan, BacSi, NguoiDung, ChuyenKhoa, VaiTroEnum
from app.models.appointment import LichLamViec, LichKham, TrangThaiLichEnum, CANCELLED_STATUSES
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
)

# Logger instance for Appointment Service
logger = logging.getLogger("clinic_backend")

# Chỉ lịch chưa diễn ra mới được hủy; các trạng thái còn lại đã kết thúc hoặc bệnh nhân đã tới phòng khám
CANCELLABLE_STATUSES = {TrangThaiLichEnum.CHO_XAC_NHAN.value, TrangThaiLichEnum.DA_XAC_NHAN.value}


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
                LichKham.trang_thai.notin_(CANCELLED_STATUSES)
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
            trang_thai=TrangThaiLichEnum.CHO_XAC_NHAN.value
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
                f"Lịch hẹn đang ở trạng thái '{lich.trang_thai}' (đã tiếp nhận/đang khám/đã khám/vắng mặt) nên không thể hủy!"
            )

        # 4. Ràng buộc thời gian tính theo giờ phòng khám
        appointment_dt = datetime.combine(lich.ngay_kham, lich.gio_kham)
        diff_hours = (appointment_dt - clinic_now()).total_seconds() / 3600.0

        if diff_hours <= 0:
            raise ConflictException("Đã tới hoặc đã qua giờ khám, không thể hủy lịch hẹn này!")

        # Bệnh nhân phải hủy trước tối thiểu 02 tiếng; Bác sĩ/Admin (tiếp nhận qua Hotline) được hủy sát giờ
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


appointment_service = AppointmentService()
