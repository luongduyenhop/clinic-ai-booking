from datetime import date, datetime, time

from app.services.appointment.appointment_service import clinic_now
from app.services.reception import (
    queue_board_service,
    queue_call_service,
    queue_checkin_service,
    queue_resource_service,
    queue_shift_audit_service,
    queue_waitlist_service,
)

__all__ = ["QueueService", "queue_service", "clinic_now", "date", "datetime", "time"]


class QueueService:
    _determine_shift = queue_checkin_service._determine_shift
    _resolve_doctor_shift_room = queue_checkin_service._resolve_doctor_shift_room
    _generate_queue_code = queue_checkin_service._generate_queue_code
    _to_ticket_response = queue_checkin_service._to_ticket_response
    _get_ticket_with_relations = queue_checkin_service._get_ticket_with_relations
    check_in_patient = queue_checkin_service.check_in_patient
    check_in_walk_in = queue_checkin_service.check_in_walk_in

    call_next_patient = queue_call_service.call_next_patient
    _get_ticket_entity = queue_call_service._get_ticket_entity
    postpone_ticket = queue_call_service.postpone_ticket
    restore_ticket = queue_call_service.restore_ticket
    close_ticket = queue_call_service.close_ticket
    patient_leave_queue = queue_call_service.patient_leave_queue
    transfer_ticket = queue_call_service.transfer_ticket

    get_doctor_queue_board = queue_board_service.get_doctor_queue_board
    get_patient_flow_board = queue_board_service.get_patient_flow_board
    get_shift_dashboard = queue_board_service.get_shift_dashboard
    get_room_status_dashboard = queue_board_service.get_room_status_dashboard

    search_appointments = queue_resource_service.search_appointments
    get_reception_appointments = queue_resource_service.get_reception_appointments
    get_roster_resources = queue_resource_service.get_roster_resources
    get_rooms_resources = queue_resource_service.get_rooms_resources
    get_roster_template_resources = queue_resource_service.get_roster_template_resources
    get_patient_history_summary = queue_resource_service.get_patient_history_summary

    process_no_shows_end_of_shift = queue_waitlist_service.process_no_shows_end_of_shift
    get_reception_waitlist = queue_waitlist_service.get_reception_waitlist
    check_in_from_waitlist = queue_waitlist_service.check_in_from_waitlist
    cancel_waitlist_entry = queue_waitlist_service.cancel_waitlist_entry

    get_reception_report_summary = queue_shift_audit_service.get_reception_report_summary
    get_reception_audit_logs = queue_shift_audit_service.get_reception_audit_logs
    get_shift_pre_close_audit = queue_shift_audit_service.get_shift_pre_close_audit
    close_reception_shift = queue_shift_audit_service.close_reception_shift


queue_service = QueueService()
