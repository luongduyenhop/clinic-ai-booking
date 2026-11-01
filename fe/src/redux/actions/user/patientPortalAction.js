import { createAsyncThunk } from '@reduxjs/toolkit'
import { patientPortalService } from '../../../services/user/PatientPortalService'
import { unwrapApi, unwrapPagedApi, pickErrorMessage } from '../../../utils/helpers/apiHelper'
import { mapPrescriptions, mapLabResults } from '../../../utils/helpers/patientResultMapping'

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
            appointments: bookings.status === 'fulfilled' ? unwrapApi(bookings.value).map((item) => ({
                id: `BE-${item.id}`, realId: item.id, appointmentCode: item.ma_lich_kham,
                doctorId: item.bac_si_id, doctorName: item.bac_si?.ho_ten || 'Bác sĩ phụ trách',
                appointmentDate: item.ngay_kham, timeSlot: item.gio_kham?.slice(0, 5), status: item.trang_thai, reason: item.ly_do_kham,
            })) : [],
            familyMembers: family.status === 'fulfilled' ? unwrapApi(family.value) : [],
            medicalHistory: records.status === 'fulfilled' ? records.value.map((record) => ({
                id: record.id, code: record.maKcb, date: record.ngayKham,
                doctor: record.bacSi, specialty: record.chuyenKhoa, diagnosis: record.chanDoan.icd10Chinh,
                symptoms: record.lyDoKham, advice: record.chanDoan.ketLuan, status: record.trangThai,
            })) : [],
            doctorSchedules: [],
            prescriptions: prescriptionPage ? mapPrescriptions(prescriptionPage.items) : [],
            prescriptionMeta: prescriptionPage?.meta,
            prescriptionError: rx.status === 'rejected' ? pickErrorMessage(rx.reason) : '',
            labResults: labPage ? mapLabResults(labPage.items) : [], labMeta: labPage?.meta,
            labError: lab.status === 'rejected' ? pickErrorMessage(lab.reason) : '',
        }
    } catch (error) { return rejectWithValue(pickErrorMessage(error)) }
})
