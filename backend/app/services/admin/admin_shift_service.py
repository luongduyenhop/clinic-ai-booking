from app.services.admin.roster_leave_service import RosterLeaveMixin
from app.services.admin.shift_emergency_service import ShiftEmergencyMixin
from app.services.admin.shift_schedule_service import ShiftScheduleMixin


class AdminShiftService(ShiftScheduleMixin, RosterLeaveMixin, ShiftEmergencyMixin):
    pass


admin_shift_service = AdminShiftService()
