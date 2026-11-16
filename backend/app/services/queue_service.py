import logging
from datetime import date, datetime, time
from typing import List, Optional, Union, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.appointment_service import clinic_now
from app.models.appointment import HangDoiKham
from app.models.user import TaiKhoan
from app.schemas.queue import (
    ReceptionWaitlistResponse,
    CheckInRequest,
    WalkInCheckInRequest,
    WalkInQuickRequest,
    QueueTicketResponse,
    CloseTicketResponse,
    CallNextResponse,
    DoctorQueueBoardResponse,
    PatientFlowBoardResponse,
    AppointmentReceptionSearchResult,
    ShiftDashboardResponse,
    RoomStatusDashboardResponse,
    ReceptionAppointmentsResponse,
    RosterItem,
    RoomResourceItem,
    RosterTemplateItem,
    PatientPackageItem,
    PatientHistorySummaryResponse,
    ProcessNoShowResponse,
    ReceptionReportSummaryResponse,
    ReceptionAuditLogResponse,
    PreCloseShiftAuditResponse,
    CloseReceptionShiftRequest,
    CloseReceptionShiftResponse,
    TransferTicketRequest,
)

from app.services.queue_modules import (
    queue_checkin_service,
    queue_call_service,
    queue_board_service,
    queue_resource_service,
    queue_waitlist_service,
    queue_shift_audit_service,
)

logger = logging.getLogger(__name__)


class QueueService:
    def _determine_shift(self, t: time) -> str:
        return queue_checkin_service._determine_shift(self, t)

    async def _resolve_doctor_shift_room(
        self,
        doctor_id: Optional[int],
        target_date: date,
        ca_kham: str,
        fallback_room_id: Optional[int],
        db: AsyncSession,
    ) -> Tuple[Optional[int], Optional[int]]:
        return await queue_checkin_service._resolve_doctor_shift_room(
            self, doctor_id, target_date, ca_kham, fallback_room_id, db
        )

    def _generate_queue_code(self, ticket: HangDoiKham) -> str:
        return queue_checkin_service._generate_queue_code(self, ticket)

    def _to_ticket_response(self, ticket: HangDoiKham) -> QueueTicketResponse:
        return queue_checkin_service._to_ticket_response(self, ticket)

    async def _get_ticket_with_relations(
        self, ticket_id: int, db: AsyncSession
    ) -> Optional[QueueTicketResponse]:
        return await queue_checkin_service._get_ticket_with_relations(self, ticket_id, db)

    async def check_in_patient(
        self, payload: CheckInRequest, receptionist_user: TaiKhoan, db: AsyncSession
    ) -> QueueTicketResponse:
        return await queue_checkin_service.check_in_patient(self, payload, receptionist_user, db)

    async def check_in_walk_in(
        self, payload: WalkInCheckInRequest, receptionist_user: TaiKhoan, db: AsyncSession
    ) -> QueueTicketResponse:
        return await queue_checkin_service.check_in_walk_in(self, payload, receptionist_user, db)

    async def check_in_walk_in_quick(
        self, payload: WalkInQuickRequest, receptionist_user: TaiKhoan, db: AsyncSession
    ) -> QueueTicketResponse:
        return await queue_checkin_service.check_in_walk_in_quick(self, payload, receptionist_user, db)

    async def call_next_patient(
        self, doctor_user: TaiKhoan, db: AsyncSession
    ) -> CallNextResponse:
        return await queue_call_service.call_next_patient(self, doctor_user, db)

    async def _get_ticket_entity(
        self, ticket_id: int, db: AsyncSession, for_update: bool = False
    ) -> HangDoiKham:
        return await queue_call_service._get_ticket_entity(self, ticket_id, db, for_update)

    async def postpone_ticket(
        self,
        ticket_id: int,
        doctor_user: TaiKhoan,
        db: AsyncSession,
        reason: Optional[str] = None,
    ) -> QueueTicketResponse:
        return await queue_call_service.postpone_ticket(self, ticket_id, doctor_user, db, reason)

    async def restore_ticket(
        self, ticket_id: int, receptionist_user: TaiKhoan, db: AsyncSession
    ) -> QueueTicketResponse:
        return await queue_call_service.restore_ticket(self, ticket_id, receptionist_user, db)

    async def close_ticket(
        self, ticket_id: int, ly_do: Optional[str], current_user: TaiKhoan, db: AsyncSession
    ) -> CloseTicketResponse:
        return await queue_call_service.close_ticket(self, ticket_id, ly_do, current_user, db)

    async def patient_leave_queue(
        self, ticket_id: int, ly_do: Optional[str], current_user: TaiKhoan, db: AsyncSession
    ) -> CloseTicketResponse:
        return await queue_call_service.patient_leave_queue(self, ticket_id, ly_do, current_user, db)

    async def transfer_ticket(
        self,
        ticket_id: int,
        payload: TransferTicketRequest,
        receptionist_user: TaiKhoan,
        db: AsyncSession,
    ) -> QueueTicketResponse:
        return await queue_call_service.transfer_ticket(
            self, ticket_id, payload, receptionist_user, db
        )

    async def get_doctor_queue_board(
        self,
        doctor_id: int,
        query_date: Optional[date] = None,
        ca_kham: Optional[Union[str, AsyncSession]] = None,
        db: Optional[AsyncSession] = None,
    ) -> DoctorQueueBoardResponse:
        return await queue_board_service.get_doctor_queue_board(
            self, doctor_id, query_date, ca_kham, db
        )

    async def get_patient_flow_board(
        self,
        doctor_id: Optional[int],
        query_date: Optional[date],
        user: TaiKhoan,
        db: AsyncSession,
        room_id: Optional[int] = None,
    ) -> PatientFlowBoardResponse:
        return await queue_board_service.get_patient_flow_board(
            self, doctor_id, query_date, user, db, room_id
        )

    async def get_shift_dashboard(
        self, query_date: Optional[date], ca_kham: Optional[str], db: AsyncSession
    ) -> ShiftDashboardResponse:
        return await queue_board_service.get_shift_dashboard(self, query_date, ca_kham, db)

    async def get_room_status_dashboard(
        self, query_date: Optional[date], ca_kham: Optional[str], db: AsyncSession
    ) -> RoomStatusDashboardResponse:
        return await queue_board_service.get_room_status_dashboard(self, query_date, ca_kham, db)

    async def search_appointments(
        self, query_str: str, query_date: Optional[date], db: AsyncSession
    ) -> List[AppointmentReceptionSearchResult]:
        return await queue_resource_service.search_appointments(self, query_str, query_date, db)

    async def get_reception_appointments(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        bac_si_id: Optional[int],
        chuyen_khoa_id: Optional[int],
        trang_thai: Optional[str],
        search: Optional[str],
        page: int,
        page_size: int,
        db: AsyncSession,
    ) -> ReceptionAppointmentsResponse:
        return await queue_resource_service.get_reception_appointments(
            self,
            query_date,
            ca_kham,
            bac_si_id,
            chuyen_khoa_id,
            trang_thai,
            search,
            page,
            page_size,
            db,
        )

    async def get_roster_resources(
        self,
        query_date: Optional[date] = None,
        ca_kham: Optional[str] = None,
        chuyen_khoa_id: Optional[Union[int, AsyncSession]] = None,
        db: Optional[AsyncSession] = None,
    ) -> List[RosterItem]:
        return await queue_resource_service.get_roster_resources(
            self, query_date, ca_kham, chuyen_khoa_id, db
        )

    async def get_rooms_resources(
        self, chuyen_khoa_id: Optional[int], db: AsyncSession
    ) -> List[RoomResourceItem]:
        return await queue_resource_service.get_rooms_resources(self, chuyen_khoa_id, db)

    async def get_roster_template_resources(
        self,
        thu_trong_tuan: Optional[int],
        db: AsyncSession,
        query_date: Optional[date] = None,
        ca_kham: Optional[str] = None,
        chuyen_khoa_id: Optional[int] = None,
        tu_ngay: Optional[date] = None,
        den_ngay: Optional[date] = None,
    ) -> List[RosterTemplateItem]:
        return await queue_resource_service.get_roster_template_resources(
            self,
            thu_trong_tuan,
            db,
            query_date,
            ca_kham,
            chuyen_khoa_id,
            tu_ngay,
            den_ngay,
        )

    async def get_patient_packages(
        self, benh_nhan_id: int, db: AsyncSession
    ) -> List[PatientPackageItem]:
        return await queue_resource_service.get_patient_packages(self, benh_nhan_id, db)

    async def get_patient_history_summary(
        self, benh_nhan_id: int, db: AsyncSession
    ) -> PatientHistorySummaryResponse:
        return await queue_resource_service.get_patient_history_summary(self, benh_nhan_id, db)

    async def process_no_shows_end_of_shift(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        current_user: TaiKhoan,
        db: AsyncSession,
    ) -> ProcessNoShowResponse:
        return await queue_waitlist_service.process_no_shows_end_of_shift(
            self, query_date, ca_kham, current_user, db
        )

    async def get_reception_waitlist(
        self,
        query_date: Optional[date],
        ca_kham: Optional[str],
        bac_si_id: Optional[int],
        chuyen_khoa_id: Optional[int],
        db: AsyncSession,
    ) -> ReceptionWaitlistResponse:
        return await queue_waitlist_service.get_reception_waitlist(
            self, query_date, ca_kham, bac_si_id, chuyen_khoa_id, db
        )

    async def check_in_from_waitlist(
        self, waitlist_id: int, receptionist_user: TaiKhoan, db: AsyncSession
    ) -> QueueTicketResponse:
        return await queue_waitlist_service.check_in_from_waitlist(
            self, waitlist_id, receptionist_user, db
        )

    async def cancel_waitlist_entry(
        self, waitlist_id: int, receptionist_user: TaiKhoan, db: AsyncSession
    ) -> None:
        return await queue_waitlist_service.cancel_waitlist_entry(
            self, waitlist_id, receptionist_user, db
        )

    async def get_reception_report_summary(
        self, query_date: Optional[date], ca_kham: Optional[str], db: AsyncSession
    ) -> ReceptionReportSummaryResponse:
        return await queue_shift_audit_service.get_reception_report_summary(
            self, query_date, ca_kham, db
        )

    async def get_reception_audit_logs(
        self,
        query_date: Optional[date],
        action_type: Optional[str],
        search: Optional[str],
        page: int,
        page_size: int,
        db: AsyncSession,
    ) -> ReceptionAuditLogResponse:
        return await queue_shift_audit_service.get_reception_audit_logs(
            self, query_date, action_type, search, page, page_size, db
        )

    async def get_shift_pre_close_audit(
        self, ca_kham: str, query_date: Optional[date], db: AsyncSession
    ) -> PreCloseShiftAuditResponse:
        return await queue_shift_audit_service.get_shift_pre_close_audit(
            self, ca_kham, query_date, db
        )

    async def close_reception_shift(
        self, payload: CloseReceptionShiftRequest, current_user: TaiKhoan, db: AsyncSession
    ) -> CloseReceptionShiftResponse:
        return await queue_shift_audit_service.close_reception_shift(
            self, payload, current_user, db
        )


queue_service = QueueService()
