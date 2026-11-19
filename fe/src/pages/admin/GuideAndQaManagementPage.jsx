import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import {
    StatusBadge,
    EmptyState,
    BookOpenText,
    Folders,
    ChatCircleDots,
    Plus,
    FloppyDisk,
    Trash,
    Camera,
    UploadSimple,
    CheckCircle,
} from '../../components/common/ClinicIcon'

export default function GuideAndQaManagementPage() {
    const location = useLocation()
    const dispatch = useDispatch()
    const { clinicData } = useSelector((state) => state.app.admin)

    const isCategoryMode = location.pathname.includes('danh-muc-huong-dan')
    const isQaMode = location.pathname.includes('hoi-dap')

    const guideCategories = clinicData?.guideCategories || []
    const guides = clinicData?.guides || []
    const qaList = clinicData?.qaList || []

    const masterOptions = getMasterOptions(clinicData)
    const defaults = getFormDefaults(clinicData)
    const specialties = masterOptions.specialties || ['Nội tổng quát', 'Tai mũi họng', 'Cơ xương khớp']

    const [catForm, setCatForm] = useState(
        () =>
            guideCategories[0] || {
                id: '',
                tenDanhMuc: '',
                moTa: '',
                thuTu: 1,
                nguoiTao: 'Admin',
                trangThai: true,
            }
    )

    const [guideForm, setGuideForm] = useState(
        () =>
            guides[0] || {
                id: '',
                danhMuc: guideCategories[0]?.tenDanhMuc || '',
                tieuDe: '',
                tieuDePhu: '',
                moTa: '',
                noiDung: '',
                hienThiTrangChu: true,
                guiThongBao: false,
                trangThai: true,
            }
    )

    const [qaForm, setQaForm] = useState(
        () =>
            qaList[0] || {
                id: '',
                nguoiHoi: '',
                chuyenKhoa: defaults.defaultSpecialty,
                cauHoi: '',
                traLoi: '',
                bacSiTraLoi: defaults.defaultDoctor,
                trangThai: 'Đã trả lời',
            }
    )

    const handleSaveGuideCategory = async () => {
        if (!catForm.tenDanhMuc?.trim()) {
            AppToast.error('Vui lòng nhập tên danh mục hướng dẫn!')
            return
        }
        const exists = guideCategories.some((c) => c.id === catForm.id && catForm.id)
        const updated = exists
            ? guideCategories.map((c) => (c.id === catForm.id ? { ...c, ...catForm } : c))
            : [...guideCategories, { ...catForm, id: `DMHD-0${guideCategories.length + 1}`, stt: guideCategories.length + 1 }]

        await dispatch(updateClinicCollectionAsync({ collectionKey: 'guideCategories', items: updated }))
        AppToast.success('Đã lưu danh mục hướng dẫn!')
    }

    const handleSaveGuide = async () => {
        if (!guideForm.tieuDe?.trim()) {
            AppToast.error('Vui lòng nhập tiêu đề bài hướng dẫn!')
            return
        }
        const exists = guides.some((g) => g.id === guideForm.id && guideForm.id)
        const updated = exists
            ? guides.map((g) => (g.id === guideForm.id ? { ...g, ...guideForm } : g))
            : [
                  ...guides,
                  {
                      ...guideForm,
                      id: `HD-0${guides.length + 1}`,
                      stt: guides.length + 1,
                      ngayTao: new Date().toISOString().slice(0, 10),
                  },
              ]

        await dispatch(updateClinicCollectionAsync({ collectionKey: 'guides', items: updated }))
        AppToast.success('Đã lưu bài viết hướng dẫn quy trình khám!')
    }

    const handleSaveQa = async () => {
        if (!qaForm.cauHoi?.trim()) {
            AppToast.error('Vui lòng nhập nội dung câu hỏi!')
            return
        }
        const payload = {
            ...qaForm,
            trangThai: qaForm.traLoi?.trim() ? 'Đã trả lời' : 'Chờ phản hồi',
            bacSiTraLoi: qaForm.bacSiTraLoi || defaults.defaultDoctor,
        }
        const exists = qaList.some((q) => q.id === payload.id && payload.id)
        const updated = exists
            ? qaList.map((q) => (q.id === payload.id ? payload : q))
            : [
                  ...qaList,
                  { ...payload, id: `QA-0${qaList.length + 1}`, ngayHoi: new Date().toISOString().replace('T', ' ').slice(0, 16) },
              ]

        await dispatch(updateClinicCollectionAsync({ collectionKey: 'qaList', items: updated }))
        setQaForm(payload)
        AppToast.success('Đã lưu phản hồi tư vấn hỏi đáp bệnh nhân!')
    }

    return (
        <div className="space-y-3.5">
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
                    <Link
                        to="/admin/huong-dan"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 ${
                            !isCategoryMode && !isQaMode
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <BookOpenText size={15} weight={!isCategoryMode && !isQaMode ? 'fill' : 'duotone'} />
                        <span>1. Bài viết Hướng dẫn ({guides.length})</span>
                    </Link>
                    <Link
                        to="/admin/danh-muc-huong-dan"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 ${
                            isCategoryMode
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <Folders size={15} weight={isCategoryMode ? 'fill' : 'duotone'} />
                        <span>2. Danh mục Hướng dẫn ({guideCategories.length})</span>
                    </Link>
                    <Link
                        to="/admin/hoi-dap"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 ${
                            isQaMode
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <ChatCircleDots size={15} weight={isQaMode ? 'fill' : 'duotone'} />
                        <span>3. Tư vấn &amp; Hỏi đáp Bệnh nhân ({qaList.length})</span>
                    </Link>
                </div>
                <span className="text-xs text-clinic-text-secondary">
                    Quản trị hướng dẫn quy trình khám &amp; Hỏi đáp chuyên môn
                </span>
            </div>

            {isCategoryMode ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-5 medpro-card p-3.5">
                        <div className="medpro-section-title">
                            <span>DANH SÁCH DANH MỤC HƯỚNG DẪN</span>
                        </div>
                        <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                            <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Tên danh mục</th>
                                        <th>Thứ tự</th>
                                        <th>TT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {guideCategories.map((c, idx) => (
                                        <tr
                                            key={c.id}
                                            onClick={() => setCatForm({ ...c })}
                                            className={`cursor-pointer transition-colors ${
                                                catForm.id === c.id ? '!bg-clinic-surface-alt font-semibold' : ''
                                            }`}
                                        >
                                            <td className="tabular-nums font-bold">{idx + 1}</td>
                                            <td className="font-semibold text-clinic-navy">{c.tenDanhMuc}</td>
                                            <td className="tabular-nums">{c.thuTu}</td>
                                            <td>
                                                <StatusBadge status={c.trangThai ? 'Hiển thị' : 'Ẩn'} compact />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-7 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clinic-border pb-3">
                            <h2 className="font-display font-extrabold text-sm text-clinic-navy uppercase">
                                CHI TIẾT DANH MỤC HƯỚNG DẪN
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCatForm({ id: '', tenDanhMuc: '', moTa: '', thuTu: 1, trangThai: true })}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    <Plus size={14} weight="bold" className="text-clinic-cta" />
                                    <span>Thêm mới</span>
                                </button>
                                <button type="button" onClick={handleSaveGuideCategory} className="medpro-btn-primary !py-1.5 !px-3 text-xs">
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu danh mục</span>
                                </button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="medpro-label">Tên danh mục hướng dẫn *</label>
                                <input
                                    type="text"
                                    value={catForm.tenDanhMuc || ''}
                                    onChange={(e) => setCatForm({ ...catForm, tenDanhMuc: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Mô tả</label>
                                <textarea
                                    rows={3}
                                    value={catForm.moTa || ''}
                                    onChange={(e) => setCatForm({ ...catForm, moTa: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : isQaMode ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-5 medpro-card p-3.5">
                        <div className="medpro-section-title">
                            <span>DANH SÁCH CÂU HỎI TƯ VẤN TỪ BỆNH NHÂN</span>
                        </div>
                        <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                            <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                                <thead>
                                    <tr>
                                        <th>Người hỏi</th>
                                        <th>Chuyên khoa</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {qaList.map((q) => (
                                        <tr
                                            key={q.id}
                                            onClick={() => setQaForm({ ...q })}
                                            className={`cursor-pointer transition-colors ${
                                                qaForm.id === q.id ? '!bg-clinic-surface-alt font-semibold' : ''
                                            }`}
                                        >
                                            <td className="font-semibold text-clinic-navy">{q.nguoiHoi}</td>
                                            <td className="text-clinic-text-secondary">{q.chuyenKhoa}</td>
                                            <td>
                                                <StatusBadge status={q.trangThai} compact />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-7 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clinic-border pb-3">
                            <h2 className="font-display font-extrabold text-sm text-clinic-navy uppercase">
                                PHẢN HỒI CÂU HỎI TƯ VẤN BỆNH NHÂN
                            </h2>
                            <button type="button" onClick={handleSaveQa} className="medpro-btn-primary !py-1.5 !px-3 text-xs">
                                <CheckCircle size={15} weight="fill" />
                                <span>Gửi phản hồi tư vấn</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">Bệnh nhân gửi câu hỏi</label>
                                <input
                                    type="text"
                                    value={qaForm.nguoiHoi || ''}
                                    onChange={(e) => setQaForm({ ...qaForm, nguoiHoi: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Chuyên khoa tư vấn</label>
                                <select
                                    value={qaForm.chuyenKhoa || specialties[0]}
                                    onChange={(e) => setQaForm({ ...qaForm, chuyenKhoa: e.target.value })}
                                    className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                >
                                    {specialties.map((sp) => (
                                        <option key={sp} value={sp}>
                                            {sp}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Nội dung câu hỏi của người bệnh</label>
                                <textarea
                                    rows={3}
                                    value={qaForm.cauHoi || ''}
                                    onChange={(e) => setQaForm({ ...qaForm, cauHoi: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Nội dung Bác sĩ phản hồi tư vấn *</label>
                                <textarea
                                    rows={4}
                                    value={qaForm.traLoi || ''}
                                    onChange={(e) => setQaForm({ ...qaForm, traLoi: e.target.value })}
                                    placeholder="Nhập câu trả lời hướng dẫn chăm sóc sức khỏe và khuyến nghị chuyên khoa khám..."
                                    className="medpro-input font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-5 medpro-card p-3.5">
                        <div className="medpro-section-title">
                            <span>DANH SÁCH BÀI VIẾT HƯỚNG DẪN ({guides.length})</span>
                        </div>
                        <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                            <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Tiêu đề hướng dẫn</th>
                                        <th>Danh mục</th>
                                        <th>Trang chủ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {guides.map((g, idx) => (
                                        <tr
                                            key={g.id}
                                            onClick={() => setGuideForm({ ...g })}
                                            className={`cursor-pointer transition-colors ${
                                                guideForm.id === g.id ? '!bg-clinic-surface-alt font-semibold' : ''
                                            }`}
                                        >
                                            <td className="tabular-nums font-bold">{idx + 1}</td>
                                            <td className="font-semibold text-clinic-navy">{g.tieuDe}</td>
                                            <td className="text-xs text-clinic-cta font-bold">{g.danhMuc}</td>
                                            <td>
                                                <StatusBadge status={g.hienThiTrangChu ? 'Hiển thị' : 'Ẩn'} compact />
                                            </td>
                                        </tr>
                                    ))}
                                    {guides.length === 0 && (
                                        <tr>
                                            <td colSpan={4}>
                                                <EmptyState icon="BookOpenText" title="Chưa có bài viết hướng dẫn" />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-7 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clinic-border pb-3">
                            <h2 className="font-display font-extrabold text-sm text-clinic-navy uppercase">
                                THÔNG TIN BÀI VIẾT HƯỚNG DẪN QUY TRÌNH KHÁM
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setGuideForm({
                                            id: '',
                                            danhMuc: guideCategories[0]?.tenDanhMuc || '',
                                            tieuDe: '',
                                            tieuDePhu: '',
                                            moTa: '',
                                            noiDung: '',
                                            hienThiTrangChu: true,
                                            guiThongBao: true,
                                            trangThai: true,
                                        })
                                    }
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    <Plus size={14} weight="bold" className="text-clinic-cta" />
                                    <span>Làm mới</span>
                                </button>
                                <button type="button" onClick={handleSaveGuide} className="medpro-btn-primary !py-1.5 !px-3 text-xs">
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu hướng dẫn</span>
                                </button>
                                {guideForm.id && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const updated = guides.filter((x) => x.id !== guideForm.id)
                                            await dispatch(updateClinicCollectionAsync({ collectionKey: 'guides', items: updated }))
                                            setGuideForm(updated[0] || {})
                                            AppToast.info('Đã xóa bài hướng dẫn!')
                                        }}
                                        className="medpro-btn-danger !py-1.5 !px-3 text-xs"
                                    >
                                        <Trash size={14} weight="bold" />
                                        <span>Xóa</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                            <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border">
                                <div className="w-full h-28 rounded-[6px] bg-clinic-surface-alt flex flex-col items-center justify-center text-clinic-navy mb-2 border border-dashed border-clinic-cta">
                                    <Camera size={26} weight="duotone" className="text-clinic-cta" />
                                    <span className="text-[11px] font-bold mt-1">Ảnh minh họa hướng dẫn</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => AppToast.info('Đã chọn ảnh minh họa cho bài hướng dẫn!')}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs w-full"
                                >
                                    <UploadSimple size={14} weight="bold" className="text-clinic-cta" />
                                    <span>Chọn ảnh</span>
                                </button>
                            </div>

                            <div className="sm:col-span-8 space-y-2.5">
                                <div>
                                    <label className="medpro-label">Danh mục hướng dẫn</label>
                                    <select
                                        value={guideForm.danhMuc || ''}
                                        onChange={(e) => setGuideForm({ ...guideForm, danhMuc: e.target.value })}
                                        className="medpro-input !py-1.5 h-9 text-xs font-semibold truncate"
                                    >
                                        {guideCategories.map((c) => (
                                            <option key={c.id} value={c.tenDanhMuc}>
                                                {c.tenDanhMuc}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="medpro-label">Tiêu đề hướng dẫn *</label>
                                    <input
                                        type="text"
                                        value={guideForm.tieuDe || ''}
                                        onChange={(e) => setGuideForm({ ...guideForm, tieuDe: e.target.value })}
                                        className="medpro-input font-bold text-clinic-navy"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Tiêu đề phụ</label>
                                    <input
                                        type="text"
                                        value={guideForm.tieuDePhu || ''}
                                        onChange={(e) => setGuideForm({ ...guideForm, tieuDePhu: e.target.value })}
                                        className="medpro-input"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-12 space-y-2.5">
                                <div>
                                    <label className="medpro-label">Mô tả ngắn</label>
                                    <input
                                        type="text"
                                        value={guideForm.moTa || ''}
                                        onChange={(e) => setGuideForm({ ...guideForm, moTa: e.target.value })}
                                        className="medpro-input"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Nội dung các bước hướng dẫn chi tiết</label>
                                    <textarea
                                        rows={5}
                                        value={guideForm.noiDung || ''}
                                        onChange={(e) => setGuideForm({ ...guideForm, noiDung: e.target.value })}
                                        className="medpro-input leading-relaxed"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-6 pt-1">
                                    <label className="inline-flex items-center gap-2 text-xs font-bold text-clinic-navy cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(guideForm.hienThiTrangChu)}
                                            onChange={(e) => setGuideForm({ ...guideForm, hienThiTrangChu: e.target.checked })}
                                            className="w-4 h-4 accent-clinic-cta"
                                        />
                                        Hiển thị trên Trang chủ Cổng bệnh nhân
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-xs font-bold text-clinic-navy cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(guideForm.guiThongBao)}
                                            onChange={(e) => setGuideForm({ ...guideForm, guiThongBao: e.target.checked })}
                                            className="w-4 h-4 accent-clinic-cta"
                                        />
                                        Gửi thông báo tự động khi bệnh nhân đặt lịch thành công
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
