function extractIndicators(raw, rawSummary) {
    let sourceObj = raw
    if (!sourceObj || (typeof sourceObj === 'object' && Object.keys(sourceObj).length === 0)) {
        if (typeof rawSummary === 'string' && rawSummary.trim().startsWith('{') && rawSummary.trim().endsWith('}')) {
            try {
                sourceObj = JSON.parse(rawSummary)
            } catch {
                sourceObj = {}
            }
        }
    }
    if (!sourceObj || typeof sourceObj !== 'object') return []
    if (Array.isArray(sourceObj.chi_tiet)) {
        return sourceObj.chi_tiet.filter(Boolean).map((item) => {
            const name = item?.ten || item?.ma || 'Chỉ số'
            const value = item?.gia_tri != null ? String(item.gia_tri) : '—'
            const ref = item?.khoang_tham_chieu || ''
            const unit = item?.don_vi || ''
            const status = (item?.danh_gia === 'CAO' || item?.flag === 'HIGH') ? 'high' : 'normal'
            const row = [name, value, ref]
            row.chiSo = name
            row.ketQua = value
            row.thamChieu = ref
            row.donVi = unit
            row.trangThai = status
            return row
        })
    }
    const finalSource = (sourceObj.chi_so && typeof sourceObj.chi_so === 'object' && !Array.isArray(sourceObj.chi_so)) ? sourceObj.chi_so : sourceObj
    const ignoredKeys = new Set(['loai', 'duyet', 'mo_ta', 'ket_luan', 'de_nghi', 'thiet_bi', 'so_bat_thuong', 'so_nguy_hiem', 'ma_mau', 'gioi_tinh_ap_dung', 'ghi_chu'])
    return Object.entries(finalSource)
        .filter(([key]) => !ignoredKeys.has(key))
        .map(([name, value]) => {
            const isObject = Boolean(value && typeof value === 'object' && !Array.isArray(value))
            const displayValue = isObject ? (value?.gia_tri ?? value?.value ?? '—') : (value != null ? String(value) : '—')
            const displayRef = isObject ? (value?.khoang_tham_chieu ?? value?.reference ?? '') : ''
            const unit = isObject ? (value?.don_vi || '') : ''
            const status = (isObject && (value?.danh_gia === 'CAO' || value?.flag === 'HIGH')) ? 'high' : 'normal'
            const row = [name, displayValue, displayRef]
            row.chiSo = name
            row.ketQua = displayValue
            row.thamChieu = displayRef
            row.donVi = unit
            row.trangThai = status
            return row
        })
}

export function mapMedicalRecords(records) {
    return (records || []).map((record) => {
        const vitalSigns = record.sinh_hieu ?? {}
        const diagnoses = record.danh_sach_chan_doan ?? []
        const primaryDiagnosis = diagnoses.find((item) => item.loai_chan_doan?.toLowerCase() === 'chinh')
        const secondaryDiagnoses = diagnoses.filter((item) => item !== primaryDiagnosis)
        const dateTime = record.thoi_gian_bat_dau || (record.ngay_kham ? `${record.ngay_kham}T00:00:00` : '')
        const rx = record.don_thuoc_chi_tiet?.[0] || record.don_thuoc
        const medicines = rx?.thuoc || rx?.danh_sach_chi_tiet || rx?.danh_sach_thuoc || record.danh_sach_thuoc || []

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
            bacSi: (() => {
                const rawName = String(record.bac_si_ho_ten || '').trim()
                const rawDegree = String(record.bac_si_hoc_vi || '').trim()
                if (!rawDegree || !rawName) return rawName || rawDegree
                if (
                    rawName.toLowerCase().startsWith(rawDegree.toLowerCase()) ||
                    /^(bs|p\.?gs|gs|ts|ths)/i.test(rawName)
                ) {
                    return rawName
                }
                return `${rawDegree} ${rawName}`
            })(),
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
            canLamSang: (record.chi_dinh_cls || []).map((order) => {
                let cleanConclusion = order.ket_luan || 'Chưa có kết luận'
                if (typeof cleanConclusion === 'string' && cleanConclusion.trim().startsWith('{') && cleanConclusion.trim().endsWith('}')) {
                    try {
                        const parsed = JSON.parse(cleanConclusion)
                        cleanConclusion = parsed.ket_luan || parsed.ghi_chu || 'Đã có kết quả xét nghiệm'
                    } catch {
                        cleanConclusion = 'Đã có kết quả'
                    }
                }
                const imageFiles = (order.tep_dinh_kem || []).filter((url) => /\.(png|jpe?g|webp)(\?|$)/i.test(url))
                return {
                    id: String(order.id),
                    tenDichVu: order.ten_dich_vu,
                    ngayCoKetQua: order.ngay_tra || 'Chưa ghi nhận',
                    ketLuan: cleanConclusion,
                    hinhAnhUrl: imageFiles[0] || null,
                    hinhAnhUrls: imageFiles,
                    chiTiet: extractIndicators(order.chi_so, order.ket_luan),
                }
            }),
            donThuoc: {
                maDon: rx?.ma_don || 'Không có đơn thuốc',
                soNgayDung: Math.max(0, ...medicines.map((item) => Number(item.so_ngay) || 0)),
                loiDanChung: rx?.loi_dan || record.loi_dan_bac_si || 'Không có lời dặn',
                danhSachThuoc: medicines.map((item) => [
                    `${item.ten || item.ten_thuoc || ''} ${item.ham_luong || ''}`.trim(),
                    item.don_vi || item.don_vi_tinh || 'Viên',
                    item.so_luong || 1,
                    item.sang || item.lieu_sang || '—',
                    item.trua || item.lieu_trua || '—',
                    item.chieu || item.lieu_chieu || '—',
                    item.toi || item.lieu_toi || '—',
                    item.cach_dung || item.cach_dung_day_du || 'Uống sau ăn',
                ]),
            },
            taiKham: {
                ngayHen: record.ngay_hen_tai_kham || 'Chưa có lịch hẹn',
                loiDanTaiKham: record.loi_dan_bac_si || 'Bác sĩ chưa ghi nhận lời dặn tái khám.',
            },
            danhGia: null,
        }
    })
}