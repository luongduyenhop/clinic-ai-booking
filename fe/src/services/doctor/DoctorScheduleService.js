import { BaseServices } from '../BaseService'

export class DoctorScheduleService extends BaseServices {
    getScheduleMatrix = (tu_ngay, den_ngay, doctor_id) => {
        return this.get('/api/v1/admin/shifts/schedule-matrix', {
            params: {
                tu_ngay,
                den_ngay,
                doctor_id: doctor_id || undefined,
            },
        })
    }
}

export const doctorScheduleService = new DoctorScheduleService()
