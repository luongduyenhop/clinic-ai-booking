const resultLabels = {
    XET_NGHIEM: 'Xét nghiệm',
    CHAN_DOAN_HINH_ANH: 'Chẩn đoán hình ảnh',
    CDHA: 'Chẩn đoán hình ảnh',
    THAM_DO_CHUC_NANG: 'Thăm dò chức năng',
    TDCN: 'Thăm dò chức năng',
    NOI_SOI: 'Nội soi',
    THU_THUAT: 'Thủ thuật',
}

const INDICATOR_DICTIONARY = {
    GLU: { label: 'Glucose (Đường huyết)', ref: '3.9 – 6.4 mmol/L' },
    WBC: { label: 'Bạch cầu (WBC)', ref: '4.0 – 10.0 G/L' },
    'NEU%': { label: 'Bạch cầu trung tính (NEU%)', ref: '40 – 75 %' },
    RBC: { label: 'Hồng cầu (RBC)', ref: '3.8 – 5.0 T/L' },
    HGB: { label: 'Huyết sắc tố (HGB)', ref: '120 – 150 g/L' },
    HCT: { label: 'Dung tích hồng cầu (HCT)', ref: '0.36 – 0.46 L/L' },
    PLT: { label: 'Tiểu cầu (PLT)', ref: '150 – 400 G/L' },
    pH: { label: 'Độ pH nước tiểu', ref: '5.0 – 6.5' },
    SG: { label: 'Tỷ trọng nước tiểu (SG)', ref: '1.005 – 1.030' },
    PRO: { label: 'Protein niệu', ref: 'Âm tính' },
    LEU: { label: 'Bạch cầu niệu', ref: 'Âm tính' },
    NIT: { label: 'Nitrit niệu', ref: 'Âm tính' },
    CHOL: { label: 'Cholesterol toàn phần', ref: '< 5.2 mmol/L' },
    TG: { label: 'Triglycerid', ref: '< 1.7 mmol/L' },
    HDL: { label: 'HDL-C', ref: '> 1.0 mmol/L' },
    LDL: { label: 'LDL-C', ref: '< 3.4 mmol/L' },
    CRP: { label: 'CRP định lượng', ref: '< 5.0 mg/L' },
}

function resolveResultType(result) {
    const code = String(result?.ma_dich_vu || '').toUpperCase()
    const name = String(result?.ten_dich_vu || '').toLowerCase()
    if (code.includes('ECG') || code.includes('EEG') || code.includes('HO_HAP') || code.includes('THINH_LUC') || name.includes('điện tâm đồ') || name.includes('điện não') || name.includes('hô hấp ký')) {
        return 'Thăm dò chức năng'
    }
    if (code.includes('XQ') || code.includes('SA_') || code.includes('CT') || code.includes('MRI') || name.includes('x-quang') || name.includes('siêu âm')) {
        return 'Chẩn đoán hình ảnh'
    }
    if (code.includes('NS_') || name.includes('nội soi')) {
        return 'Nội soi'
    }
    if (code.includes('XN_') || name.includes('xét nghiệm') || name.includes('máu') || name.includes('nước tiểu') || name.includes('glucose')) {
        return 'Xét nghiệm'
    }
    const rawKey = String(result?.loai_ket_qua || '').toUpperCase()
    return resultLabels[rawKey] || 'Cận lâm sàng'
}

export function mapPrescriptions(items = []) {
    return (items || []).filter(Boolean).map((rx) => ({
        id: `rx-${rx.id}`,
        code: rx.ma_don_thuoc || rx.ma_don_quoc_gia || `DT-${rx.id}`,
        visitId: `visit-${rx.luot_kham_id}`,
        date: rx.ngay_ke_don ? String(rx.ngay_ke_don).slice(0, 10) : '',
        doctor: rx.bac_si_ho_ten || 'Bác sĩ phụ trách',
        diagnosis: rx.chan_doan || 'Chưa cập nhật',
        status: rx.da_ky_so ? 'Đã ký điện tử' : (rx.trang_thai || 'Đã kê đơn'),
        signedAt: rx.ngay_ky,
        note: rx.loi_dan_uong_thuoc || 'Dùng thuốc đúng theo hướng dẫn của bác sĩ.',
        medicines: (rx.danh_sach_thuoc || []).filter(Boolean).map((medicine) => ({
            id: medicine.id,
            name: `${medicine.ten_thuoc || 'Thuốc'} ${medicine.ham_luong || ''}`.trim(),
            quantity: `${medicine.so_luong || 0} ${medicine.don_vi_tinh || 'viên'}`,
            duration: `${medicine.so_ngay_dung || 1} ngày`,
            instruction: medicine.cach_dung || 'Uống theo chỉ định',
            doses: [
                { label: 'Sáng', value: medicine.lieu_sang || '—' },
                { label: 'Trưa', value: medicine.lieu_trua || '—' },
                { label: 'Chiều', value: medicine.lieu_chieu || '—' },
                { label: 'Tối', value: medicine.lieu_toi || '—' },
            ],
        })),
    }))
}

export function mapLabResults(items = []) {
    const mapped = (items || []).filter(Boolean).map((result) => {
        let summary = result.ket_luan || 'Đã có kết quả'
        let extraDetails = []
        if (typeof summary === 'string' && summary.trim().startsWith('{') && summary.trim().endsWith('}')) {
            try {
                const parsed = JSON.parse(summary)
                if (parsed && typeof parsed === 'object') {
                    summary = parsed.ket_luan || parsed.ghi_chu || 'Các chỉ số xét nghiệm đã được cập nhật đầy đủ.'
                    const source = (parsed.chi_so && typeof parsed.chi_so === 'object') ? parsed.chi_so : parsed
                    const ignored = new Set(['loai', 'duyet', 'mo_ta', 'ket_luan', 'de_nghi', 'thiet_bi', 'so_bat_thuong', 'so_nguy_hiem', 'ma_mau', 'gioi_tinh_ap_dung', 'ghi_chu'])
                    extraDetails = Object.entries(source)
                        .filter(([k]) => !ignored.has(k))
                        .map(([name, val]) => ({
                            label: name,
                            value: val != null ? String(val) : '—',
                            reference: '—',
                        }))
                }
            } catch {
                summary = 'Đã có kết quả'
            }
        }
        const rawDetails = (result.chi_tiet && result.chi_tiet.length > 0)
            ? result.chi_tiet
            : extraDetails

        const isUrinalysis = String(result?.ma_dich_vu || '').includes('NUOC_TIEU') || String(result?.ten_dich_vu || '').toLowerCase().includes('nước tiểu')

        const details = (rawDetails || []).filter(Boolean).map((detail) => {
            const rawCode = detail?.ten_chi_so || detail?.label || 'Chỉ số'
            const dictEntry = INDICATOR_DICTIONARY[rawCode]
            const resolvedLabel = rawCode === 'GLU' && isUrinalysis
                ? 'Glucose niệu'
                : (dictEntry?.label || rawCode)
            const resolvedRef = detail?.khoang_tham_chieu && detail.khoang_tham_chieu !== '—'
                ? detail.khoang_tham_chieu
                : detail?.reference && detail.reference !== '—'
                ? detail.reference
                : rawCode === 'GLU' && isUrinalysis
                ? 'Âm tính'
                : (dictEntry?.ref || '—')

            return {
                label: resolvedLabel,
                value: detail?.gia_tri != null ? String(detail.gia_tri) : (detail?.value != null ? String(detail.value) : '—'),
                reference: resolvedRef,
            }
        })

        const categoryLabel = resolveResultType(result)

        return {
            id: `lab-${result.id}`,
            code: result.ma_dich_vu || 'CLS',
            date: result.ngay_tra_ket_qua ? String(result.ngay_tra_ket_qua).slice(0, 10) : '',
            visitId: `visit-${result.luot_kham_id}`,
            type: categoryLabel,
            name: result.ten_dich_vu || 'Dịch vụ cận lâm sàng',
            department: categoryLabel,
            status: result.trang_thai === 'da_co_ket_qua' ? 'Đã có kết quả' : (result.trang_thai || 'Đã có kết quả'),
            summary,
            details,
            attachments: result.tep_dinh_kem || [],
        }
    })

    const seenByDayAndService = new Set()
    return mapped.filter((item) => {
        const dedupeKey = `${item.date}::${item.code}::${item.name}`
        if (seenByDayAndService.has(dedupeKey)) return false
        seenByDayAndService.add(dedupeKey)
        return true
    })
}
