import { BaseServices } from '../BaseService'

export class StaffService extends BaseServices {
    getDoctors = async () => {
        try {
            const res = await this.get('/api/v1/admin/staff/doctors', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            const fallback = await this.get('/api/v1/admin/doctors', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return fallback.data?.data || fallback.data || []
        }
    }

    createDoctor = async (payload) => {
        const res = await this.post('/api/v1/admin/staff/doctors', payload)
        return res.data?.data || res.data
    }

    updateDoctor = async (doctorId, payload) => {
        const res = await this.put(`/api/v1/admin/staff/doctors/${doctorId}`, payload)
        return res.data?.data || res.data
    }

    getShifts = async (params = {}) => {
        const q = new URLSearchParams()
        if (params.queryDate) q.append('query_date', params.queryDate)
        if (params.doctorId) q.append('doctor_id', params.doctorId)
        const qs = q.toString() ? `?${q.toString()}` : ''
        const res = await this.get(`/api/v1/admin/staff/shifts${qs}`, {
            __skipGlobalLoading: true,
        })
        return res.data?.data || res.data || []
    }

    createShift = async (payload) => {
        const res = await this.post('/api/v1/admin/staff/shifts', payload)
        return res.data?.data || res.data
    }

    updateShift = async (shiftId, payload) => {
        const res = await this.put(`/api/v1/admin/staff/shifts/${shiftId}`, payload)
        return res.data?.data || res.data
    }

    getDoctorLeaves = async (params = {}) => {
        const q = new URLSearchParams()
        if (params.doctorId) q.append('doctor_id', params.doctorId)
        if (params.trangThai) q.append('trang_thai', params.trangThai)
        const qs = q.toString() ? `?${q.toString()}` : ''
        const res = await this.get(`/api/v1/admin/staff/doctor-leaves${qs}`, {
            __skipGlobalLoading: true,
            __skipRefresh: true,
        })
        return res.data?.data || res.data || []
    }

    createDoctorLeave = async (payload) => {
        const res = await this.post('/api/v1/admin/staff/doctor-leaves', payload)
        return res.data?.data || res.data
    }

    approveDoctorLeave = async (leaveId, payload) => {
        const res = await this.post(`/api/v1/admin/staff/doctor-leaves/${leaveId}/approve`, payload)
        return res.data?.data || res.data
    }

    getRoles = async () => {
        try {
            const res = await this.get('/api/v1/admin/staff/roles', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    updateRoles = async (rolesList) => {
        const res = await this.put('/api/v1/admin/staff/roles', {
            items: rolesList,
            auditEntry: {
                hanhDong: 'UPDATE_ROLE_PERMISSIONS',
                doiTuong: 'roles',
                mucDich: 'Cập nhật ma trận 23 quyền hạn người dùng',
            },
        })
        return res.data?.data || res.data
    }

    getStaffList = async () => {
        try {
            const res = await this.get('/api/v1/admin/staff/staff', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    updateStaffList = async (staffItems) => {
        const res = await this.put('/api/v1/admin/staff/staff', {
            items: staffItems,
            auditEntry: {
                hanhDong: 'UPDATE_STAFF_CREDENTIAL',
                doiTuong: 'staffList',
                mucDich: 'Quản lý hồ sơ nhân sự và Chứng chỉ hành nghề',
            },
        })
        return res.data?.data || res.data
    }
}

export const staffService = new StaffService()
