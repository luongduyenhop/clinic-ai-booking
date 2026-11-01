const resultLabels = {
    XET_NGHIEM: 'Xét nghiệm', CHAN_DOAN_HINH_ANH: 'Chẩn đoán hình ảnh',
    THAM_DO_CHUC_NANG: 'Thăm dò chức năng', NOI_SOI: 'Nội soi', THU_THUAT: 'Thủ thuật',
}
export function mapPrescriptions(items) { return items.map((rx) => ({
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
            })) }
export function mapLabResults(items) { return items.map((result) => ({
                id: `lab-${result.id}`,
                code: result.ma_dich_vu,
                date: result.ngay_tra_ket_qua?.slice(0, 10),
                visitId: `visit-${result.luot_kham_id}`,
                type: resultLabels[result.loai_ket_qua] || 'Chưa phân loại',
                name: result.ten_dich_vu,
                department: resultLabels[result.loai_ket_qua] || 'Chưa phân loại',
                status: 'Đã có kết quả',
                summary: result.ket_luan,
                details: result.chi_tiet.map((detail) => ({
                    label: detail.ten_chi_so,
                    value: detail.gia_tri,
                    reference: detail.khoang_tham_chieu || '—',
                })),
                attachments: result.tep_dinh_kem,
            })) }
