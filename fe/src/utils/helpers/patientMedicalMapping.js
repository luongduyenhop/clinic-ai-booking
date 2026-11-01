export function mapMedicalRecords(records) {
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
