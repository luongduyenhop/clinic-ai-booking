import { createAsyncThunk } from '@reduxjs/toolkit'
import { patientPortalService } from '../../../services/user/PatientPortalService'
import { unwrapApi, unwrapPagedApi, pickErrorMessage } from '../../../utils/helpers/apiHelper'
import { mapMedicalRecords } from '../../../utils/helpers/patientMedicalMapping'
import { mapPrescriptions, mapLabResults } from '../../../utils/helpers/patientResultMapping'

const appointmentStatus = status => ({
    cho_xac_nhan: 'PENDING', da_xac_nhan: 'CONFIRMED',
    da_kham: 'COMPLETED', da_huy: 'CANCELLED',
    PENDING: 'PENDING', CONFIRMED: 'CONFIRMED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED',
})[status] || status

const unwrapList = (response, message) => {
    const data = unwrapApi(response)
    if (!Array.isArray(data)) throw new Error(message)
    return data
}

const loadPortalData = async (request, map, message) => {
    try {
        return { data: map(await request()), error: '' }
    } catch (error) {
        return { data: null, error: pickErrorMessage(error, message) }
    }
}

export const fetchPrescriptionsAsync = createAsyncThunk('user/fetchPrescriptions', async ({ page = 1 } = {}, { rejectWithValue, signal }) => {
    try {
        const response = await patientPortalService.getPrescriptionsPage(page, signal)
        unwrapList(response, 'Dữ liệu đơn thuốc không hợp lệ')
        const result = unwrapPagedApi(response)
        return { ...result, items: mapPrescriptions(result.items) }
    } catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
export const fetchLabResultsAsync = createAsyncThunk('user/fetchLabResults', async ({ page = 1 } = {}, { rejectWithValue, signal }) => {
    try {
        const response = await patientPortalService.getLabResultsPage(page, signal)
        unwrapList(response, 'Dữ liệu kết quả cận lâm sàng không hợp lệ')
        const result = unwrapPagedApi(response)
        return { ...result, items: mapLabResults(result.items) }
    } catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
export const fetchPatientPortalAsync = createAsyncThunk('user/fetchPatientPortal', async () => {
    const [appointments, familyMembers, prescriptions, labResults, medicalHistory] = await Promise.all([
        loadPortalData(
            () => patientPortalService.getBookings(),
            (response) => unwrapList(response, 'Dữ liệu lịch hẹn không hợp lệ').map((item) => ({
                id: `BE-${item.id}`, realId: item.id, appointmentCode: item.ma_lich_kham,
                doctorId: String(item.bac_si?.id || ''), doctorName: item.bac_si?.ho_ten || 'Bác sĩ phụ trách',
                specialtyName: item.bac_si?.chuyen_khoa || '',
                appointmentDate: item.ngay_kham, timeSlot: item.gio_kham?.slice(0, 5),
                status: appointmentStatus(item.trang_thai), reason: item.ly_do_kham,
            })),
            'Không thể tải lịch hẹn',
        ),
        loadPortalData(
            () => patientPortalService.getFamilyMembers(),
            (response) => unwrapList(response, 'Dữ liệu người thân không hợp lệ'),
            'Không thể tải hồ sơ người thân',
        ),
        loadPortalData(
            () => patientPortalService.getPrescriptionsPage(1),
            (response) => {
                unwrapList(response, 'Dữ liệu đơn thuốc không hợp lệ')
                const page = unwrapPagedApi(response)
                return { items: mapPrescriptions(page.items), meta: page.meta }
            },
            'Không thể tải đơn thuốc',
        ),
        loadPortalData(
            () => patientPortalService.getLabResultsPage(1),
            (response) => {
                unwrapList(response, 'Dữ liệu kết quả cận lâm sàng không hợp lệ')
                const page = unwrapPagedApi(response)
                return { items: mapLabResults(page.items), meta: page.meta }
            },
            'Không thể tải kết quả cận lâm sàng',
        ),
        loadPortalData(
            () => patientPortalService.getMedicalRecords(),
            (response) => mapMedicalRecords(unwrapList(response, 'Dữ liệu lịch sử khám không hợp lệ')).map((record) => ({
                id: record.id, code: record.maKcb, date: record.ngayKham,
                doctor: record.bacSi, specialty: record.chuyenKhoa, diagnosis: record.chanDoan?.icd10Chinh || 'Chưa có chẩn đoán',
                symptoms: record.lyDoKham, advice: record.chanDoan?.ketLuan || 'Chưa có kết luận', status: record.trangThai,
            })),
            'Không thể tải lịch sử khám',
        ),
    ])

    return {
        appointments: appointments.data,
        appointmentsError: appointments.error,
        familyMembers: familyMembers.data,
        familyMembersError: familyMembers.error,
        prescriptions: prescriptions.data?.items,
        prescriptionMeta: prescriptions.data?.meta,
        prescriptionError: prescriptions.error,
        labResults: labResults.data?.items,
        labMeta: labResults.data?.meta,
        labError: labResults.error,
        medicalHistory: medicalHistory.data,
        medicalHistoryError: medicalHistory.error,
    }
})
export const fetchMedicalRecordsAsync = createAsyncThunk('user/fetchMedicalRecords', async (_, { rejectWithValue }) => {
    try { return mapMedicalRecords(unwrapList(await patientPortalService.getMedicalRecords(), 'Dữ liệu lịch sử khám không hợp lệ')) }
    catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
export const findPatientCodeAsync = createAsyncThunk('user/findPatientCode', async (keyword, { rejectWithValue }) => {
    try { return unwrapApi(await patientPortalService.findLostPatientCode(keyword)) }
    catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
export const addFamilyMemberAsync = createAsyncThunk('user/addFamilyMember', async (member, { rejectWithValue }) => {
    try { return unwrapApi(await patientPortalService.addFamilyMember({
        ...member, quan_he: member.quan_he || member.moi_quan_he,
    })) }
    catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
export const submitPatientFeedbackAsync = createAsyncThunk('user/submitPatientFeedback', async (payload, { rejectWithValue }) => {
    try { return unwrapApi(await patientPortalService.submitFeedback(payload)) }
    catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
