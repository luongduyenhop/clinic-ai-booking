import { http } from '../BaseService.js'
import { bookingService } from './BookingService.js'
import { doctors, specialties } from '../../data/user/publicPortalData.js'
import { demoAppointments, doctorShiftPatterns, labResults, medicalHistory, prescriptions } from '../../data/user/patientPortalData.js'

const FAMILY_STORAGE_KEY = 'clinic_patient_family_members_v1'

const DEFAULT_FAMILY_MEMBERS = [
    {
        id: 1,
        ho_ten: 'Nguyễn Minh Khôi',
        moi_quan_he: 'Con trai',
        ngay_sinh: '2018-08-15',
        gioi_tinh: 'Nam',
        so_dien_thoai: '0901234567',
        ma_ho_so: 'BN-00108',
    },
    {
        id: 2,
        ho_ten: 'Trần Thị Mai',
        moi_quan_he: 'Mẹ ruột',
        ngay_sinh: '1962-03-20',
        gioi_tinh: 'Nữ',
        so_dien_thoai: '0912345678',
        ma_ho_so: 'BN-00042',
    },
]

function delay(ms = 140) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function toDateValue(date) {
    return date.toISOString().slice(0, 10)
}

function decorateAppointment(item) {
    const doctor = doctors.find((entry) => entry.id === item.doctorId || String(entry.realId) === String(item.doctorId) || (item.realId && entry.realId === item.realId))
    const specialty = specialties.find((entry) => entry.id === item.specialtyId || entry.code === item.specialtyId || String(entry.realId) === String(item.specialtyId))
    return {
        ...item,
        doctorName: item.doctorName || doctor?.name || 'Đang phân công',
        specialtyName: item.specialtyName || specialty?.name || 'Chưa xác định',
    }
}

function buildDoctorSchedules() {
    const dates = Array.from({ length: 7 }, (_, offset) => {
        const date = new Date()
        date.setHours(0, 0, 0, 0)
        date.setDate(date.getDate() + offset)
        return toDateValue(date)
    })
    return doctors.flatMap((doctor, doctorIndex) =>
        dates
            .filter((_, dayIndex) => (dayIndex + doctorIndex) % 3 !== 2)
            .map((date) => ({
                id: `${doctor.id}-${date}`,
                doctorId: doctor.id,
                doctorName: doctor.name,
                specialtyId: doctor.specialtyId,
                specialty: doctor.specialty,
                date,
                shifts: doctorShiftPatterns[doctor.id] || ['07:30 - 11:30'],
            }))
    )
}

function readLocalFamily() {
    try {
        const raw = localStorage.getItem(FAMILY_STORAGE_KEY)
        if (!raw) {
            localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(DEFAULT_FAMILY_MEMBERS))
            return DEFAULT_FAMILY_MEMBERS
        }
        return JSON.parse(raw)
    } catch {
        return DEFAULT_FAMILY_MEMBERS
    }
}

class PatientPortalService {
    async getMedicalRecords() {
        const response = await http.get('/api/v1/patient/medical-records')
        const records = response?.data?.data ?? []

        return records.map((record) => {
            const vitalSigns = record.sinh_hieu ?? {}
            const diagnoses = record.danh_sach_chan_doan ?? []
            const primaryDiagnosis = diagnoses.find((item) => item.loai_chan_doan?.toLowerCase() === 'chinh')
            const secondaryDiagnoses = diagnoses.filter((item) => item !== primaryDiagnosis)
            const dateTime = record.thoi_gian_bat_dau ?? `${record.ngay_kham}T00:00:00`

            const displayVital = (value, suffix) => value == null ? 'Chưa ghi nhận' : `${value}${suffix}`
            const displayDiagnosis = (diagnosis) => diagnosis
                ? `${diagnosis.ma_icd10} - ${diagnosis.ten_benh_chan_doan}`
                : 'Chưa có chẩn đoán'

            return {
                id: String(record.luot_kham_id),
                maKcb: `HSK-${String(record.luot_kham_id).padStart(6, '0')}`,
                ngayKham: record.ngay_kham,
                gioKham: dateTime.slice(11, 16),
                chuyenKhoa: record.chuyen_khoa,
                phongKham: record.phong_kham,
                bacSi: [record.bac_si_hoc_vi, record.bac_si_ho_ten].filter(Boolean).join(' '),
                trangThai: record.trang_thai_luot_kham,
                lyDoKham: record.ly_do_vao_kham || record.trieu_chung || 'Không ghi nhận',
                tienSu: record.benh_su || 'Không ghi nhận',
                sinhHieu: {
                    huyetAp: vitalSigns.huyet_ap_tam_thu != null && vitalSigns.huyet_ap_tam_truong != null
                        ? `${vitalSigns.huyet_ap_tam_thu}/${vitalSigns.huyet_ap_tam_truong} mmHg`
                        : 'Chưa ghi nhận',
                    mach: displayVital(vitalSigns.mach_lan_phut, ' bpm'),
                    nhietDo: displayVital(vitalSigns.nhiet_do_c, ' °C'),
                    spo2: displayVital(vitalSigns.spo2, '%'),
                    canNang: displayVital(vitalSigns.can_nang_kg, ' kg'),
                    chieuCao: displayVital(vitalSigns.chieu_cao_cm, ' cm'),
                    bmi: displayVital(vitalSigns.bmi, ''),
                },
                chanDoan: {
                    icd10Chinh: displayDiagnosis(primaryDiagnosis),
                    icd10Phu: secondaryDiagnoses.map(displayDiagnosis).join('; '),
                    ketLuan: record.ket_luan_dieu_tri || record.loi_dan_bac_si || 'Chưa có kết luận điều trị',
                },
                canLamSang: [],
                donThuoc: {
                    maDon: record.co_don_thuoc ? `Theo hồ sơ #${record.luot_kham_id}` : 'Không có đơn thuốc',
                    soNgayDung: 0,
                    loiDanChung: record.loi_dan_bac_si || 'Không có lời dặn',
                    danhSachThuoc: [],
                },
                taiKham: {
                    ngayHen: record.ngay_hen_tai_kham || 'Chưa có lịch hẹn',
                    loiDanTaiKham: record.loi_dan_bac_si || 'Bác sĩ chưa ghi nhận lời dặn tái khám.',
                },
                danhGia: null,
            }
        })
    }

    async getPortalData() {
        const savedAppointments = await bookingService.getBookings()
        await delay()
        const appointmentMap = new Map(
            [...savedAppointments, ...demoAppointments].map((item) => [item.id, decorateAppointment(item)])
        )

        // Đọc các ca khám thực tế đã hoàn thành từ Bác sĩ
        const dynamicHistory = []
        const dynamicPrescriptions = []
        const dynamicLabResults = []

        try {
            const rawHist = localStorage.getItem('clinic_patient_completed_encounters_v1')
            const completedList = rawHist ? JSON.parse(rawHist) : []

            completedList.forEach((enc) => {
                const visitId = `visit-${enc.id}`
                const dateStr = enc.thoi_gian_khoa?.slice(0, 10) || enc.ngay_kham || new Date().toISOString().slice(0, 10)
                const docName = enc.bac_si_kham || 'BS. CKI Trần Quốc Huy'
                const specName = enc.ai_triage?.ten_chuyen_khoa || 'Khoa Nội tổng quát'
                const primaryDx = (enc.danh_sach_chan_doan || []).find((d) => d.loai_chan_doan === 'chinh') || enc.danh_sach_chan_doan?.[0]
                const diagTitle = primaryDx ? `${primaryDx.ma_icd10 || primaryDx.ma} - ${primaryDx.ten_chan_doan || primaryDx.ten}` : 'Khám nội khoa tổng quát'

                // 1. Hồ sơ bệnh án
                dynamicHistory.push({
                    id: visitId,
                    code: `HSK-${enc.id}`,
                    date: dateStr,
                    doctor: docName,
                    specialty: specName,
                    diagnosis: diagTitle,
                    symptoms: enc.ly_do_vao_kham || enc.ai_triage?.trieu_chung_nhap || 'Khám lâm sàng',
                    advice: enc.loi_dan_bac_si || 'Uống thuốc đúng đơn, tái khám đúng hẹn',
                    status: 'Hoàn thành',
                })

                // 2. Đơn thuốc
                const rx = enc.don_thuoc
                if (rx && Array.isArray(rx.danh_sach_thuoc) && rx.danh_sach_thuoc.length > 0) {
                    dynamicPrescriptions.push({
                        id: `rx-${enc.id}`,
                        code: rx.ma_don_thuoc_quoc_gia || `DTQG-2026-LK${enc.id}`,
                        visitId,
                        date: dateStr,
                        doctor: docName,
                        diagnosis: diagTitle,
                        status: 'Đã cấp',
                        note: rx.loi_dan_uong_thuoc || enc.loi_dan_bac_si || 'Uống thuốc sau ăn no',
                        medicines: rx.danh_sach_thuoc.map((m) => ({
                            name: `${m.ten_thuoc} ${m.ham_luong || ''}`.trim(),
                            dosage: `Sáng: ${m.sang || 0}, Trưa: ${m.trua || 0}, Chiều: ${m.chieu || 0}, Tối: ${m.toi || 0} ${m.don_vi_tinh || 'viên'}`,
                            frequency: m.cach_dung || m.huong_dan_dung || 'Uống sau ăn no',
                            duration: `${m.so_luong || 10} ${m.don_vi_tinh || 'viên'}`,
                        })),
                    })
                }

                // 3. Kết quả Cận lâm sàng
                const orders = enc.danh_sach_chi_dinh || []
                orders.forEach((o) => {
                    if (o.trang_thai === 'da_co_ket_qua') {
                        dynamicLabResults.push({
                            id: `lab-${o.id}`,
                            code: o.ma_dich_vu || `CLS-${o.id}`,
                            date: o.thoi_gian_tra_ket_qua?.slice(0, 10) || dateStr,
                            visitId,
                            type: o.nhom_dich_vu === 'CDHA' ? 'Chẩn đoán hình ảnh' : o.nhom_dich_vu === 'NOI_SOI' ? 'Nội soi' : 'Xét nghiệm',
                            name: o.ten_dich_vu,
                            department: o.nhom_dich_vu === 'CDHA' ? 'Khoa Chẩn đoán hình ảnh' : 'Khoa Xét nghiệm',
                            status: 'Đã có kết quả',
                            summary: o.ket_qua_chi_tiet?.ket_luan || o.ket_qua_chi_tiet?.mo_ta || o.ket_qua_phan_loai || 'Chỉ số trong giới hạn bình thường',
                            details: o.ket_qua_chi_tiet?.chi_so || [],
                        })
                    }
                })
            })
        } catch (e) {
            console.warn('Error reading completed encounters in portal:', e)
        }

        return {
            appointments: [...appointmentMap.values()].sort((a, b) =>
                b.appointmentDate.localeCompare(a.appointmentDate)
            ),
            medicalHistory: [...dynamicHistory, ...medicalHistory],
            prescriptions: [...dynamicPrescriptions, ...prescriptions],
            labResults: [...dynamicLabResults, ...labResults],
            doctorSchedules: buildDoctorSchedules(),
            familyMembers: readLocalFamily(),
        }
    }

    async findLostPatientCode(keyword) {
        const q = String(keyword || '').trim()
        if (!q) return []
        try {
            const res = await http.post('/api/v1/patient/find-lost-code', { keyword: q })
            if (res?.data?.data?.length) return res.data.data
        } catch {
            // Fallback tra cứu cục bộ khi chạy offline
        }
        const localCandidates = [
            {
                benh_nhan_id: 101,
                ma_ho_so: 'BN-00101',
                ho_ten: 'Nguyễn Văn An',
                so_dien_thoai: '0901234567',
                ngay_sinh: '1990-05-15',
                gioi_tinh: 'Nam',
                cccd_so: '079090001234',
            },
            ...readLocalFamily().map((m, i) => ({
                benh_nhan_id: 200 + i,
                ma_ho_so: m.ma_ho_so || `BN-0020${i}`,
                ho_ten: m.ho_ten,
                so_dien_thoai: m.so_dien_thoai,
                ngay_sinh: m.ngay_sinh,
                gioi_tinh: m.gioi_tinh,
                cccd_so: '079090009999',
            })),
        ]
        const lower = q.toLowerCase()
        return localCandidates.filter(
            (c) =>
                c.so_dien_thoai?.includes(lower) ||
                c.cccd_so?.includes(lower) ||
                c.ho_ten?.toLowerCase().includes(lower) ||
                c.ma_ho_so?.toLowerCase().includes(lower)
        )
    }

    async addFamilyMember(member) {
        try {
            const res = await http.post('/api/v1/patient/family-members', member)
            if (res?.data?.data) return res.data.data
        } catch {
            // Fallback lưu localStorage
        }
        const current = readLocalFamily()
        const newEntry = {
            id: Date.now(),
            ho_ten: member.ho_ten,
            moi_quan_he: member.moi_quan_he || 'Người thân',
            ngay_sinh: member.ngay_sinh || '1995-01-01',
            gioi_tinh: member.gioi_tinh || 'Nam',
            so_dien_thoai: member.so_dien_thoai || '0909000111',
            ma_ho_so: `BN-00${Math.floor(300 + Math.random() * 600)}`,
        }
        const updated = [...current, newEntry]
        localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(updated))
        return newEntry
    }
}

export const patientPortalService = new PatientPortalService()
