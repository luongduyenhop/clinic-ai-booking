import { useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions } from '../../services/admin/clinicSeedData'
import {
    StatusBadge,
    EmptyState,
    Microscope,
    FirstAidKit,
    FloppyDisk,
    CheckCircle,
    Printer,
    UploadSimple,
    Trash,
    MagnifyingGlass,
    Funnel,
} from '../../components/common/ClinicIcon'

export default function ParaclinicalPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const isPtTtMode = location.pathname.includes('pt-tt')

    const { clinicData } = useSelector((state) => state.app.admin)
    const tasks = clinicData?.paraclinicalTasks || []
    const staffList = clinicData?.staffList || []
    const templates = clinicData?.templates || []

    const masterOptions = getMasterOptions(clinicData)
    const paraclinicalStatuses = masterOptions.paraclinicalStatuses || ['Chờ thực hiện', 'Đang thực hiện', 'Đã có kết quả']

    const clsTemplates = useMemo(
        () => templates.filter((t) => t.loaiMau === 'mau-ket-qua-cls'),
        [templates]
    )

    const queryFilter = new URLSearchParams(location.search).get('filter')
    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [activeSubTab, setActiveSubTab] = useState('KET_QUA_CLS')
    const [form, setForm] = useState(() => tasks[0] || {})
    const [newImageName, setNewImageName] = useState('')
    const [newImageNote, setNewImageNote] = useState('')

    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
            const matchText =
                !searchText ||
                t.hoTen?.toLowerCase().includes(searchText.toLowerCase()) ||
                t.maKCB?.includes(searchText) ||
                t.tenDV?.toLowerCase().includes(searchText.toLowerCase())
            const matchStatus = statusFilter === 'ALL' || t.trangThai === statusFilter

            // Lọc theo chuyên khoa từ Query Filter trên Header Tabbar
            let matchType = true
            if (queryFilter) {
                const lower = (t.tenDV || '').toLowerCase()
                if (queryFilter === 'XET_NGHIEM' || queryFilter === 'BENH_PHAM') {
                    matchType = lower.includes('xét nghiệm') || lower.includes('huyết học') || lower.includes('sinh hóa') || lower.includes('máu')
                } else if (queryFilter === 'SIEU_AM') {
                    matchType = lower.includes('siêu âm')
                } else if (queryFilter === 'X_QUANG') {
                    matchType = lower.includes('xquang') || lower.includes('x-quang')
                } else if (queryFilter === 'NOI_SOI') {
                    matchType = lower.includes('nội soi')
                } else if (queryFilter === 'DIEN_TIM') {
                    matchType = lower.includes('điện tim') || lower.includes('ecg')
                }
            }

            return matchText && matchStatus && matchType
        })
    }, [tasks, searchText, statusFilter, queryFilter])

    const handleApplyResultTemplate = (templateId) => {
        const tpl = clsTemplates.find((t) => t.id === templateId)
        if (!tpl) return
        setForm({
            ...form,
            mauKetQua: tpl.id,
            moTa: tpl.noiDung,
            ketLuan: tpl.tenMau.replace('Mẫu kết quả ', ''),
        })
        AppToast.success(`Đã áp dụng mẫu kết quả: ${tpl.tenMau}`)
    }

    const handleAddImage = () => {
        const imgName = newImageName.trim() || `DICOM_${form.maDV || 'CLS'}_${Date.now().toString().slice(-4)}.jpg`
        const newImg = {
            id: `IMG-${Date.now().toString().slice(-4)}`,
            tenAnh: imgName,
            ghiChu: newImageNote || 'Hình ảnh kết quả Chẩn đoán hình ảnh kỹ thuật số',
            thoiGian: new Date().toISOString().replace('T', ' ').slice(0, 16),
        }
        setForm({
            ...form,
            hinhAnh: [...(form.hinhAnh || []), newImg],
        })
        setNewImageName('')
        setNewImageNote('')
        AppToast.success(`Đã tải lên hình ảnh: ${imgName}`)
    }

    const handleSaveClsResult = async (markCompleted = false) => {
        const doctor = staffList.find((s) => s.hoTen === form.bacSiThucHien)
        if (markCompleted && doctor && doctor.trangThaiCCHN === 'EXPIRED') {
            AppToast.error(
                `CHẶN TRẢ KẾT QUẢ (INT-05): Bác sĩ ${doctor.hoTen} có Chứng chỉ hành nghề (${doctor.soCCHN}) đã hết hạn ngày ${doctor.ngayHetHanCCHN}. Vui lòng chọn bác sĩ đủ điều kiện!`
            )
            return
        }

        const updatedRecord = {
            ...form,
            trangThai: markCompleted ? 'Đã có kết quả' : form.trangThai,
            ngayThucHien: new Date().toISOString().replace('T', ' ').slice(0, 16),
        }
        setForm(updatedRecord)

        const updatedList = tasks.map((t) => (t.id === updatedRecord.id ? updatedRecord : t))
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'paraclinicalTasks',
                items: updatedList,
                auditEntry: {
                    hanhDong: markCompleted ? 'COMPLETE_PARACLINICAL_RESULT' : 'UPDATE_PARACLINICAL_DRAFT',
                    doiTuong: `${updatedRecord.tenDV} - BN ${updatedRecord.hoTen}`,
                    mucDich: 'Thực hiện & trả kết quả Cận lâm sàng / PT-TT',
                },
            })
        )
        AppToast.success(markCompleted ? 'Đã hoàn thành và trả kết quả Cận lâm sàng!' : 'Đã lưu kết quả Cận lâm sàng!')
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* LEFT PANEL (4 cols): Danh sách chờ thực hiện CLS / PT-TT */}
            <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-88px)]">
                <div className="medpro-section-title">
                    <span className="inline-flex items-center gap-1.5">
                        {isPtTtMode ? (
                            <FirstAidKit size={16} weight="duotone" className="text-[#00B5F1]" />
                        ) : (
                            <Microscope size={16} weight="duotone" className="text-[#00B5F1]" />
                        )}
                        <span>{isPtTtMode ? 'DANH SÁCH PHẪU THUẬT - THỦ THUẬT' : 'DANH SÁCH CẬN LÂM SÀNG'}</span>
                    </span>
                    <StatusBadge status={`${filteredTasks.length} ca`} compact />
                </div>

                <div className="grid grid-cols-12 gap-2 mb-3">
                    <div className="col-span-7 relative">
                        <MagnifyingGlass
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Tìm tên BN, Mã KCB, Dịch vụ..."
                            className="medpro-input !pl-8"
                        />
                    </div>
                    <div className="col-span-5 relative">
                        <Funnel
                            size={13}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="medpro-input !pl-7"
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            {paraclinicalStatuses.map((st) => (
                                <option key={st} value={st}>
                                    {st}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl">
                    <table className="medpro-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Mã KCB</th>
                                <th>Họ tên BN</th>
                                <th>Dịch vụ</th>
                                <th className="text-center">TT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.map((t, idx) => (
                                <tr
                                    key={t.id}
                                    onClick={() => setForm({ ...t })}
                                    className={`cursor-pointer ${
                                        form.id === t.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                    }`}
                                >
                                    <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                    <td className="font-mono text-[11px] font-bold text-[#00B5F1]">{t.maKCB}</td>
                                    <td className="font-semibold text-[#12263F]">{t.hoTen}</td>
                                    <td className="text-xs">{t.tenDV}</td>
                                    <td className="text-center">
                                        <StatusBadge status={t.trangThai} showText={false} />
                                    </td>
                                </tr>
                            ))}
                            {filteredTasks.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState
                                            icon="Microscope"
                                            title="Không có chỉ định Cận lâm sàng phù hợp"
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* RIGHT PANEL (8 cols): Thực hiện Cận lâm sàng (Mô tả, Kết luận, Mẫu kết quả, Hình ảnh DICOM) */}
            <div className="lg:col-span-8 medpro-card p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8F4FD]">
                    <div>
                        <h2 className="font-display text-base font-extrabold text-[#003553] uppercase">
                            {isPtTtMode
                                ? 'THỰC HIỆN PHẪU THUẬT - THỦ THUẬT & VLTL (VIDEO 03B)'
                                : 'THỰC HIỆN CẬN LÂM SÀNG — X-QUANG, SIÊU ÂM, NỘI SOI (VIDEO 03B)'}
                        </h2>
                        <p className="text-xs text-slate-500">
                            Bệnh nhân: <strong className="text-[#003553]">{form.hoTen}</strong> ({form.maBN}) • Dịch vụ:{' '}
                            <strong className="text-[#00B5F1]">{form.tenDV}</strong>
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => handleSaveClsResult(false)}
                            className="medpro-btn-outline text-xs"
                        >
                            <FloppyDisk size={15} weight="duotone" className="text-[#00B5F1]" />
                            <span>Lưu kết quả</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSaveClsResult(true)}
                            className="medpro-btn-primary text-xs"
                        >
                            <CheckCircle size={15} weight="fill" />
                            <span>Trả kết quả & Hoàn thành</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => AppToast.success(`Đang in Phiếu trả kết quả ${form.tenDV} kèm ảnh...`)}
                            className="medpro-btn-amber text-xs font-bold"
                        >
                            <Printer size={15} weight="bold" />
                            <span>In phiếu kết quả</span>
                        </button>
                    </div>
                </div>

                {/* Sub-tabs: Kết quả CLS | Kê thuốc & Vật tư tiêu hao */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('KET_QUA_CLS')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                            activeSubTab === 'KET_QUA_CLS'
                                ? 'bg-[#00B5F1] text-white'
                                : 'bg-[#F0F7FC] text-[#003553]'
                        }`}
                    >
                        1. Kết quả Cận lâm sàng & Hình ảnh ({form.hinhAnh?.length || 0} ảnh)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('VAT_TU_TIEU_HAO')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                            activeSubTab === 'VAT_TU_TIEU_HAO'
                                ? 'bg-[#00B5F1] text-white'
                                : 'bg-[#F0F7FC] text-[#003553]'
                        }`}
                    >
                        2. Định mức Thuốc & Vật tư tiêu hao ca CLS
                    </button>
                </div>

                {activeSubTab === 'KET_QUA_CLS' ? (
                    <div className="space-y-4">
                        {/* Execution Info Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="medpro-label">Phòng thực hiện</label>
                                <input type="text" value={form.phongTH || ''} readOnly className="medpro-input font-semibold" />
                            </div>
                            <div>
                                <label className="medpro-label">Bác sĩ thực hiện (Kiểm tra CCHN)</label>
                                <select
                                    value={form.bacSiThucHien || ''}
                                    onChange={(e) => setForm({ ...form, bacSiThucHien: e.target.value })}
                                    className="medpro-input font-semibold"
                                >
                                    {staffList.map((s) => (
                                        <option key={s.id} value={s.hoTen}>
                                            {s.hoTen} ({s.trangThaiCCHN})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Chọn Mẫu kết quả CLS chuẩn</label>
                                <select
                                    value={form.mauKetQua || ''}
                                    onChange={(e) => handleApplyResultTemplate(e.target.value)}
                                    className="medpro-input font-bold text-[#00B5F1]"
                                >
                                    <option value="">-- Chọn mẫu mô tả nhanh --</option>
                                    {clsTemplates.map((tpl) => (
                                        <option key={tpl.id} value={tpl.id}>
                                            {tpl.tenMau}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Trạng thái thực hiện</label>
                                <select
                                    value={form.trangThai || paraclinicalStatuses[0]}
                                    onChange={(e) => setForm({ ...form, trangThai: e.target.value })}
                                    className="medpro-input font-bold"
                                >
                                    {paraclinicalStatuses.map((st) => (
                                        <option key={st} value={st}>
                                            {st}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Description & Conclusion */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-7 space-y-3">
                                <div>
                                    <label className="medpro-label">Mô tả chi tiết hình ảnh / Kết quả cận lâm sàng</label>
                                    <textarea
                                        rows={6}
                                        value={form.moTa || ''}
                                        onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                                        className="medpro-input font-sans leading-relaxed"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Kết luận Cận lâm sàng *</label>
                                    <input
                                        type="text"
                                        value={form.ketLuan || ''}
                                        onChange={(e) => setForm({ ...form, ketLuan: e.target.value })}
                                        className="medpro-input font-bold text-[#003553]"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Lời khuyên / Đề nghị chuyên môn</label>
                                    <input
                                        type="text"
                                        value={form.deNghi || ''}
                                        onChange={(e) => setForm({ ...form, deNghi: e.target.value })}
                                        className="medpro-input"
                                    />
                                </div>
                            </div>

                            {/* Right Column: Image Upload & DICOM Preview */}
                            <div className="lg:col-span-5 p-3.5 rounded-xl bg-[#F8FBFE] border border-[#CBE9FA] space-y-3">
                                <div className="text-xs font-bold text-[#003553] uppercase flex items-center justify-between">
                                    <span>DANH SÁCH HÌNH ẢNH KẾT QUẢ (X-QUANG / SIÊU ÂM)</span>
                                    <StatusBadge status={`${form.hinhAnh?.length || 0} tệp`} compact />
                                </div>

                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={newImageName}
                                        onChange={(e) => setNewImageName(e.target.value)}
                                        placeholder="Tên file ảnh (VD: XQuang_NgucThang.jpg)..."
                                        className="medpro-input"
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newImageNote}
                                            onChange={(e) => setNewImageNote(e.target.value)}
                                            placeholder="Ghi chú hình ảnh..."
                                            className="medpro-input"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddImage}
                                            className="medpro-btn-primary text-xs shrink-0"
                                        >
                                            <UploadSimple size={14} weight="bold" />
                                            <span>Tải ảnh lên</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                    {(form.hinhAnh || []).map((img, i) => (
                                        <div
                                            key={img.id}
                                            className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-10 h-10 rounded-lg bg-[#003553] text-[#00B5F1] flex items-center justify-center font-mono text-[10px] font-bold">
                                                    DICOM
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[#12263F]">
                                                        {i + 1}. {img.tenAnh}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">{img.ghiChu}</div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setForm({
                                                        ...form,
                                                        hinhAnh: form.hinhAnh.filter((x) => x.id !== img.id),
                                                    })
                                                }
                                                className="text-rose-600 hover:text-rose-700 cursor-pointer"
                                                title="Xóa ảnh"
                                            >
                                                <Trash size={15} weight="bold" />
                                            </button>
                                        </div>
                                    ))}
                                    {(!form.hinhAnh || form.hinhAnh.length === 0) && (
                                        <EmptyState
                                            icon="UploadSimple"
                                            title="Chưa có ảnh kết quả"
                                            description="Nhấn 'Tải ảnh lên' để đính kèm phim X-Quang hoặc ảnh Siêu âm."
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-[#E8F4FD] text-xs text-[#003553]">
                            Định mức vật tư tiêu hao áp dụng tự động theo <strong>Mẫu tiêu hao (Video 10)</strong> cho dịch vụ{' '}
                            <strong>{form.tenDV}</strong>:
                        </div>
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Tên vật tư / Thuốc tiêu hao</th>
                                    <th>ĐVT</th>
                                    <th>Số lượng định mức</th>
                                    <th>Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1</td>
                                    <td className="font-semibold">Phim X-Quang kỹ thuật số khô 35x43cm / Gel siêu âm dẫn truyền</td>
                                    <td>Tờ / Lượt</td>
                                    <td className="font-bold">01</td>
                                    <td>Trừ kho vật tư phòng Cận lâm sàng</td>
                                </tr>
                                <tr>
                                    <td>2</td>
                                    <td className="font-semibold">Găng tay y tế tiệt trùng + Bao đựng kết quả</td>
                                    <td>Bộ</td>
                                    <td className="font-bold">01</td>
                                    <td>Định mức chuẩn</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
