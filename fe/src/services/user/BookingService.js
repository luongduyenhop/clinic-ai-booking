import { http } from '../BaseService.js'

class BookingService {
    async getBookings() {
        const response = await http.get('/api/v1/appointments/my-appointments')
        const items = response?.data?.data
        if (!Array.isArray(items)) throw new Error('Không nhận được danh sách lịch hẹn từ Backend')
        return items.map((item) => ({
            id: `BE-${item.id}`,
            realId: item.id,
            appointmentCode: item.ma_lich_kham,
            doctorId: String(item.bac_si?.id || ''),
            doctorName: item.bac_si?.ho_ten || 'Bác sĩ phụ trách',
            specialtyName: item.bac_si?.chuyen_khoa || '',
            appointmentDate: item.ngay_kham,
            timeSlot: item.gio_kham?.slice(0, 5) || '',
            status: item.trang_thai,
            reason: item.ly_do_kham,
        }))
    }

    async getAvailableSlots({ doctorId, appointmentDate }) {
        if (!Number.isInteger(Number(doctorId)) || !appointmentDate) throw new Error('Chưa chọn bác sĩ hoặc ngày khám hợp lệ')
        const res = await http.get(`/api/v1/appointments/doctors/${doctorId}/slots`, { params: { query_date: appointmentDate } })
        if (!Array.isArray(res?.data?.data?.slots)) throw new Error('Dữ liệu khung giờ không hợp lệ')
        return res.data.data.slots.filter((slot) => slot.status === 'available').map((slot) => ({ value: slot.time_str, available: true }))
    }

    async createBooking(payload) {
        const doctorId = Number(payload.doctorId)
        if (!Number.isInteger(doctorId) || !payload.appointmentDate || !payload.timeSlot) throw new Error('Thông tin đặt lịch chưa đầy đủ')
        const startTime = (payload.timeSlot || '').split(' - ')[0]
        const body = {
            bac_si_id: doctorId,
            ngay_kham: payload.appointmentDate,
            gio_kham: startTime.length === 5 ? `${startTime}:00` : startTime,
            ly_do_kham: payload.patient?.reason || 'Khám theo lịch hẹn',
            trieu_chung_ban_dau: payload.aiRecommendation?.symptoms || payload.patient?.reason || '',
            phan_tich_ai_id: payload.aiRecommendation?.analysisId || null,
        }
        const res = await http.post('/api/v1/appointments', body)
        const record = res?.data?.data
        if (!record?.id || !record?.ma_lich_kham) throw new Error('Backend chưa xác nhận lịch hẹn. Vui lòng thử lại.')
        return {
            ...payload,
            id: `BE-${record.id}`,
            realId: record.id,
            appointmentCode: record.ma_lich_kham,
            status: record.trang_thai,
            doctorName: record.bac_si?.ho_ten || '',
            specialtyName: record.bac_si?.chuyen_khoa || '',
            patientName: record.benh_nhan?.ho_ten || '',
            patientPhone: record.benh_nhan?.so_dien_thoai || '',
            createdAt: new Date().toISOString(),
        }
    }
}

export const bookingService = new BookingService()
