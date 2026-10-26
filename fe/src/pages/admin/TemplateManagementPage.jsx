import { useState, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions } from '../../utils/helpers/clinicConfigHelpers'
import {
    ClinicIcon,
    StatusBadge,
    EmptyState,
    Plus,
    FloppyDisk,
    Trash,
    UploadSimple,
    DownloadSimple,
    MagnifyingGlass,
} from '../../components/common/ClinicIcon'

export default function TemplateManagementPage() {

    const templateInputRef = useRef(null)

    const handleDownloadTemplate = () => {
        const content = form.noiDung || 'BIỂU MẪU Y TẾ TIÊU CHUẨN PHÒNG KHÁM\nMã mẫu: ' + (form.maMau || 'BM01')
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = form.tenFile || 'bieu-mau.txt'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        AppToast.success(`Đã tải xuống file mẫu: ${form.tenFile || 'bieu-mau.txt'}`)
    }

    const handleUploadTemplateFile = (e) => {
        const f = e.target.files?.[0]
        if (!f) return
        setForm(prev => ({ ...prev, tenFile: f.name }))
        AppToast.success(`Đã tải lên tệp mẫu: ${f.name} thành công!`)
        e.target.value = ''
    }

    const { loaiMau = 'mau-in' } = useParams()
    const dispatch = useDispatch()
    const { clinicData } = useSelector((state) => state.app.admin)
    const templates = clinicData?.templates || []

    const masterOptions = getMasterOptions(clinicData)
    const templateTypes = masterOptions.templateTypes || []
    const currentTypeMeta = templateTypes.find((t) => t.key === loaiMau) || templateTypes[0] || {
        key: 'mau-in',
        label: '1. Mẫu in',
        title: 'Quản lý Mẫu in',
        fileExt: '.docx',
        icon: 'Printer',
    }

    const filteredTemplates = useMemo(
        () => templates.filter((t) => t.loaiMau === loaiMau),
        [templates, loaiMau]
    )

    const [searchText, setSearchText] = useState('')
    const [form, setForm] = useState(
        () =>
            filteredTemplates[0] || {
                id: '',
                loaiMau,
                danhMuc: 'Khám chữa bệnh',
                loaiDichVu: 'Đa khoa',
                tenMau: '',
                tenFile: '',
                noiDung: '',
                trangThai: true,
            }
    )

    const handleSwitchType = (typeKey) => {
        const listForType = templates.filter((t) => t.loaiMau === typeKey)
        setForm(
            listForType[0] || {
                id: '',
                loaiMau: typeKey,
                danhMuc: 'Khám chữa bệnh',
                loaiDichVu: 'Đa khoa',
                tenMau: '',
                tenFile: '',
                noiDung: '',
                trangThai: true,
            }
        )
    }

    const handleNewTemplate = () => {
        setForm({
            id: '',
            loaiMau,
            danhMuc: 'Khám chữa bệnh',
            loaiDichVu: 'Tùy chỉnh',
            tenMau: '',
            tenFile: `Mau_Moi_${Date.now().toString().slice(-4)}${currentTypeMeta.fileExt}`,
            noiDung: '',
            trangThai: true,
        })
        AppToast.info(`Đã khởi tạo ${currentTypeMeta.label} mới!`)
    }

    const handleSaveTemplate = async () => {
        if (!form.tenMau?.trim()) {
            AppToast.error('Vui lòng nhập Tên mẫu!')
            return
        }
        const payload = { ...form, loaiMau }
        const exists = templates.some((t) => t.id === payload.id && payload.id)
        let updated
        if (exists) {
            updated = templates.map((t) => (t.id === payload.id ? payload : t))
        } else {
            const newRecord = { ...payload, id: `MAU-${Date.now().toString().slice(-4)}` }
            updated = [newRecord, ...templates]
            setForm(newRecord)
        }

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'templates',
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_TEMPLATE' : 'CREATE_TEMPLATE',
                    doiTuong: `${payload.tenMau} (${currentTypeMeta.label})`,
                    mucDich: 'Quản lý biểu mẫu in, báo cáo, CLS, đơn thuốc & gói dịch vụ',
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật biểu mẫu thành công!' : 'Đã thêm mới biểu mẫu thành công!')
    }

    const handleDeleteTemplate = async () => {
        if (!form.id) return
        const updated = templates.filter((t) => t.id !== form.id)
        await dispatch(updateClinicCollectionAsync({ collectionKey: 'templates', items: updated }))
        const remaining = updated.filter((t) => t.loaiMau === loaiMau)
        setForm(remaining[0] || { id: '', loaiMau, tenMau: '', tenFile: '', noiDung: '', trangThai: true })
        AppToast.info('Đã xóa biểu mẫu!')
    }

    return (
        <div className="space-y-3.5">
            {/* Top 7 Template Categories Tabs matching Video 10 */}
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    {templateTypes.map((t) => {
                        const count = templates.filter((x) => x.loaiMau === t.key).length
                        const active = loaiMau === t.key
                        return (
                            <Link
                                key={t.key}
                                to={`/admin/quan-ly-mau/${t.key}`}
                                onClick={() => handleSwitchType(t.key)}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                                    active
                                        ? 'bg-[#00B5F1] text-white shadow-xs'
                                        : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/15'
                                }`}
                            >
                                <ClinicIcon name={t.icon || 'FileText'} size={14} weight={active ? 'fill' : 'duotone'} />
                                <span>
                                    {t.label} ({count})
                                </span>
                            </Link>
                        )
                    })}
                </div>
                <span className="text-xs text-slate-500">Phân hệ Video 10: Quản lý 7 loại Mẫu nghiệp vụ</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                {/* LEFT PANEL (5 cols): Danh sách mẫu */}
                <div className="lg:col-span-5 medpro-card p-3.5 flex flex-col h-[calc(100vh-145px)]">
                    <div className="medpro-section-title">
                        <span>DANH SÁCH {currentTypeMeta.label.toUpperCase()}</span>
                        <StatusBadge status={`${filteredTemplates.length} mẫu`} compact />
                    </div>

                    <div className="mb-3 relative">
                        <MagnifyingGlass
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Tìm tên mẫu, danh mục, tên file..."
                            className="medpro-input !pl-8"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Tên mẫu nghiệp vụ</th>
                                    <th>Phân loại</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTemplates
                                    .filter(
                                        (item) =>
                                            !searchText ||
                                            item.tenMau?.toLowerCase().includes(searchText.toLowerCase()) ||
                                            item.danhMuc?.toLowerCase().includes(searchText.toLowerCase())
                                    )
                                    .map((item, idx) => (
                                        <tr
                                            key={item.id}
                                            onClick={() => setForm({ ...item })}
                                            className={`cursor-pointer ${
                                                form.id === item.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                            }`}
                                        >
                                            <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                            <td>
                                                <div className="font-semibold text-[#12263F]">{item.tenMau}</div>
                                                <div className="text-[11px] font-mono text-slate-400">{item.tenFile}</div>
                                            </td>
                                            <td className="text-xs text-[#00B5F1] font-bold">{item.loaiDichVu}</td>
                                            <td>
                                                <StatusBadge status={item.trangThai ? 'Hiển thị' : 'Ẩn'} compact />
                                            </td>
                                        </tr>
                                    ))}
                                {filteredTemplates.length === 0 && (
                                    <tr>
                                        <td colSpan={4}>
                                            <EmptyState icon="FileText" title="Chưa có mẫu trong phân mục này" />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT PANEL (7 cols): Biểu mẫu Cấu hình & Upload File Mẫu */}
                <div className="lg:col-span-7 medpro-card p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F4FD] pb-3">
                        <div>
                            <h2 className="font-display font-extrabold text-base text-[#003553] uppercase">
                                {currentTypeMeta.title}
                            </h2>
                            <p className="text-xs text-slate-500">
                                Tải lên file mẫu ({currentTypeMeta.fileExt}) hoặc chỉnh sửa trực tiếp nội dung mẫu
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={handleNewTemplate} className="medpro-btn-outline text-xs">
                                <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                                <span>Tạo mẫu mới</span>
                            </button>
                            <button type="button" onClick={handleSaveTemplate} className="medpro-btn-primary text-xs">
                                <FloppyDisk size={15} weight="bold" />
                                <span>Lưu biểu mẫu</span>
                            </button>
                            {form.id && (
                                <button type="button" onClick={handleDeleteTemplate} className="medpro-btn-danger text-xs">
                                    <Trash size={14} weight="bold" />
                                    <span>Xóa</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="medpro-label">Danh mục áp dụng</label>
                            <input
                                type="text"
                                value={form.danhMuc || ''}
                                onChange={(e) => setForm({ ...form, danhMuc: e.target.value })}
                                className="medpro-input font-semibold"
                            />
                        </div>
                        <div>
                            <label className="medpro-label">Loại dịch vụ / Chuyên khoa</label>
                            <input
                                type="text"
                                value={form.loaiDichVu || ''}
                                onChange={(e) => setForm({ ...form, loaiDichVu: e.target.value })}
                                className="medpro-input"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="medpro-label">Tên mẫu hiển thị *</label>
                            <input
                                type="text"
                                value={form.tenMau || ''}
                                onChange={(e) => setForm({ ...form, tenMau: e.target.value })}
                                className="medpro-input font-bold text-[#003553]"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="medpro-label">Tệp đính kèm biểu mẫu ({currentTypeMeta.fileExt})</label>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="text"
                                    value={form.tenFile || ''}
                                    onChange={(e) => setForm({ ...form, tenFile: e.target.value })}
                                    className="medpro-input font-mono flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => templateInputRef.current?.click()}
                                    className="medpro-btn-outline text-xs"
                                >
                                    <UploadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                                    <span>Chọn file tải lên</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="medpro-btn-amber text-xs font-bold"
                                >
                                    <DownloadSimple size={14} weight="bold" />
                                    <span>Tải file mẫu về</span>
                                </button>
                                <input ref={templateInputRef} type="file" className="hidden" onChange={handleUploadTemplateFile} />
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="medpro-label">
                                Nội dung chi tiết biểu mẫu / Cấu trúc biến trộn (Merge Fields)
                            </label>
                            <textarea
                                rows={7}
                                value={form.noiDung || ''}
                                onChange={(e) => setForm({ ...form, noiDung: e.target.value })}
                                className="medpro-input font-mono text-xs leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
