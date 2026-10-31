import { http } from '../BaseService.js'
import { bookingService } from './BookingService.js'
import { doctors, specialties } from '../../data/user/publicPortalData.js'
import { demoAppointments, doctorShiftPatterns, medicalHistory } from '../../data/user/patientPortalData.js'

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
            const dateTime = record.thoi_gian_bat_dau || (record.ngay_kham ? `${record.ngay_kham}T00:00:00` : '')
            const rx = record.don_thuoc_chi_tiet?.[0]
            const medicines = rx?.thuoc || []

            const displayVital = (value, suffix) => value == null ? 'Chưa ghi nhận' : `${value}${suffix}`
            const displayDiagnosis = (diagnosis) => diagnosis
                ? `${diagnosis.ma_icd10} - ${diagnosis.ten_benh_chan_doan}`
                : 'Chưa có chẩn đoán'

            return {
                id: String(record.luot_kham_id),
                maKcb: `HSK-${String(record.luot_kham_id).padStart(6, '0')}`,
                ngayKham: record.ngay_kham,
                gioKham: dateTime ? dateTime.slice(11, 16) : 'Chưa ghi nhận',
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
                canLamSang: (record.chi_dinh_cls || []).map((order) => ({
                    id: String(order.id), tenDichVu: order.ten_dich_vu,
                    ngayCoKetQua: order.ngay_tra || 'Chưa ghi nhận',
                    ketLuan: order.ket_luan || 'Chưa có kết luận',
                    hinhAnhUrl: order.tep_dinh_kem?.find((url) => /\.(png|jpe?g|webp)(\?|$)/i.test(url)),
                    chiTiet: Object.entries(order.chi_so || {}).map(([name, value]) => [name, typeof value === 'object' ? value.gia_tri || value.value : value, typeof value === 'object' ? value.khoang_tham_chieu || value.reference : '']),
                })),
                donThuoc: {
                    maDon: rx?.ma_don || 'Không có đơn thuốc',
                    soNgayDung: Math.max(0, ...medicines.map((item) => Number(item.so_ngay) || 0)),
                    loiDanChung: rx?.loi_dan || record.loi_dan_bac_si || 'Không có lời dặn',
                    danhSachThuoc: medicines.map((item) => [`${item.ten} ${item.ham_luong || ''}`.trim(), item.don_vi, item.so_luong, item.sang || '—', item.trua || '—', item.chieu || '—', item.toi || '—', item.cach_dung]),
                },
                taiKham: {
                    ngayHen: record.ngay_hen_tai_kham || 'Chưa có lịch hẹn',
                    loiDanTaiKham: record.loi_dan_bac_si || 'Bác sĩ chưa ghi nhận lời dặn tái khám.',
                },
                danhGia: null,
            }
        })
    }

    async getPrescriptionsPage(page = 1, signal) {
        const response = await http.get('/api/v1/patient/prescriptions', { params: { page, page_size: 20 }, signal })
        const items = response.data.data
        return { items: items.map((rx) => ({
                id: `rx-${rx.id}`,
                code: rx.ma_don_thuoc,
                visitId: `visit-${rx.luot_kham_id}`,
                date: rx.ngay_ke_don?.slice(0, 10),
                doctor: rx.bac_si_ho_ten,
                diagnosis: rx.chan_doan,
                status: rx.da_ky_so ? 'Đã ký điện tử' : rx.trang_thai,
                signedAt: rx.ngay_ky,
                note: rx.loi_dan_uong_thuoc || 'Dùng thuốc đúng theo hướng dẫn của bác sĩ.',
                medicines: rx.danh_sach_thuoc.map((medicine) => ({
                    id: medicine.id,
                    name: `${medicine.ten_thuoc} ${medicine.ham_luong || ''}`.trim(),
                    quantity: `${medicine.so_luong} ${medicine.don_vi_tinh}`,
                    duration: `${medicine.so_ngay_dung} ngày`,
                    instruction: medicine.cach_dung,
                    doses: [
                        { label: 'Sáng', value: medicine.lieu_sang || '—' },
                        { label: 'Trưa', value: medicine.lieu_trua || '—' },
                        { label: 'Chiều', value: medicine.lieu_chieu || '—' },
                        { label: 'Tối', value: medicine.lieu_toi || '—' },
                    ],
                })),
            })), meta: response.data.meta }
    }

    async getLabResultsPage(page = 1, signal) {
        const response = await http.get('/api/v1/patient/lab-results', { params: { page, page_size: 20 }, signal })
        const items = response.data.data
        return { items: items.map((result) => ({
                id: `lab-${result.id}`,
                code: result.ma_dich_vu,
                date: result.ngay_tra_ket_qua?.slice(0, 10),
                visitId: `visit-${result.luot_kham_id}`,
                type: result.loai_ket_qua === 'CHAN_DOAN_HINH_ANH' ? 'Chẩn đoán hình ảnh' : 'Xét nghiệm',
                name: result.ten_dich_vu,
                department: result.loai_ket_qua === 'CHAN_DOAN_HINH_ANH' ? 'Khoa Chẩn đoán hình ảnh' : 'Khoa Xét nghiệm',
                status: 'Đã có kết quả',
                summary: result.ket_luan,
                details: result.chi_tiet.map((detail) => ({
                    label: detail.ten_chi_so,
                    value: detail.gia_tri,
                    reference: detail.khoang_tham_chieu || '—',
                })),
                attachments: result.tep_dinh_kem,
            })), meta: response.data.meta }
    }

    async getPortalData() {
        const savedAppointments = await bookingService.getBookings()
        // Dashboard summaries always start at page 1. Detail screens load independently.
        const [rxSummary, labSummary] = await Promise.allSettled([
            this.getPrescriptionsPage(1), this.getLabResultsPage(1),
        ])
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
            prescriptions: rxSummary.status === 'fulfilled' ? rxSummary.value.items : [],
            prescriptionMeta: rxSummary.status === 'fulfilled' ? rxSummary.value.meta : null,
            prescriptionError: rxSummary.status === 'rejected' ? 'Không tải được đơn thuốc' : '',
            labResults: labSummary.status === 'fulfilled' ? labSummary.value.items : [],
            labMeta: labSummary.status === 'fulfilled' ? labSummary.value.meta : null,
            labError: labSummary.status === 'rejected' ? 'Không tải được kết quả CLS' : '',
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
