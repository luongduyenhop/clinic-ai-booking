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

export const fetchPrescriptionsAsync = createAsyncThunk('user/fetchPrescriptions', async ({ page = 1 } = {}, { rejectWithValue, signal }) => {
    try {
        const result = unwrapPagedApi(await patientPortalService.getPrescriptionsPage(page, signal))
        return { ...result, items: mapPrescriptions(result.items) }
    } catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
export const fetchLabResultsAsync = createAsyncThunk('user/fetchLabResults', async ({ page = 1 } = {}, { rejectWithValue, signal }) => {
    try {
        const result = unwrapPagedApi(await patientPortalService.getLabResultsPage(page, signal))
        return { ...result, items: mapLabResults(result.items) }
    } catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
export const fetchPatientPortalAsync = createAsyncThunk('user/fetchPatientPortal', async (_, { rejectWithValue }) => {
    try {
        const [bookings, family, rx, lab, records] = await Promise.allSettled([
            patientPortalService.getBookings(), patientPortalService.getFamilyMembers(),
            patientPortalService.getPrescriptionsPage(1), patientPortalService.getLabResultsPage(1),
            patientPortalService.getMedicalRecords(),
        ])
        const prescriptionPage = rx.status === 'fulfilled' ? unwrapPagedApi(rx.value) : null
        const labPage = lab.status === 'fulfilled' ? unwrapPagedApi(lab.value) : null
        return {
            appointments: bookings.status === 'fulfilled' ? (() => {
                try {
                    return unwrapApi(bookings.value).map((item) => ({
                        id: `BE-${item.id}`, realId: item.id, appointmentCode: item.ma_lich_kham,
                        doctorId: String(item.bac_si?.id || ''), doctorName: item.bac_si?.ho_ten || 'Bác sĩ phụ trách',
                        specialtyName: item.bac_si?.chuyen_khoa || '',
                        appointmentDate: item.ngay_kham, timeSlot: item.gio_kham?.slice(0, 5),
                        status: appointmentStatus(item.trang_thai), reason: item.ly_do_kham,
                    }))
                } catch {
                    return []
                }
            })() : [],
            familyMembers: family.status === 'fulfilled' ? (() => {
                try {
                    return unwrapApi(family.value)
                } catch {
                    return []
                }
            })() : [],
            medicalHistory: records.status === 'fulfilled' ? (() => {
                try {
                    return mapMedicalRecords(unwrapApi(records.value)).map((record) => ({
                        id: record.id, code: record.maKcb, date: record.ngayKham,
                        doctor: record.bacSi, specialty: record.chuyenKhoa, diagnosis: record.chanDoan?.icd10Chinh || 'Chưa có chẩn đoán',
                        symptoms: record.lyDoKham, advice: record.chanDoan?.ketLuan || 'Chưa có kết luận', status: record.trangThai,
                    }))
                } catch {
                    return []
                }
            })() : [],
            doctorSchedules: [],
            prescriptions: prescriptionPage ? (() => {
                try {
                    return mapPrescriptions(prescriptionPage.items)
                } catch {
                    return []
                }
            })() : [],
            prescriptionMeta: prescriptionPage?.meta,
            prescriptionError: rx.status === 'rejected' ? pickErrorMessage(rx.reason) : '',
            labResults: labPage ? (() => {
                try {
                    return mapLabResults(labPage.items)
                } catch {
                    return []
                }
            })() : [],
            labMeta: labPage?.meta,
            labError: lab.status === 'rejected' ? pickErrorMessage(lab.reason) : '',
        }
    } catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
export const fetchMedicalRecordsAsync = createAsyncThunk('user/fetchMedicalRecords', async (_, { rejectWithValue }) => {
    try { return mapMedicalRecords(unwrapApi(await patientPortalService.getMedicalRecords())) }
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