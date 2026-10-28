import { useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, Link } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import {
    StatusBadge,
    EmptyState,
    Newspaper,
    Folders,
    Plus,
    FloppyDisk,
    Trash,
    Camera,
    UploadSimple,
    MagnifyingGlass,
    Eye,
} from '../../components/common/ClinicIcon'

export default function NewsManagementPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const isCategoryMode = location.pathname.includes('danh-muc-tin-tuc')

    const { clinicData } = useSelector((state) => state.app.admin)
    const categories = clinicData?.newsCategories || []
    const articles = clinicData?.newsArticles || []
    const defaults = getFormDefaults(clinicData)

    const [searchText, setSearchText] = useState('')
    const [catForm, setCatForm] = useState(
        () =>
            categories[0] || {
                id: '',
                tenDanhMuc: '',
                moTa: '',
                thuTu: 1,
                nguoiTao: 'Admin',
                ngayTao: '2026-10-12',
                trangThai: true,
            }
    )

    const [artForm, setArtForm] = useState(
        () =>
            articles[0] || {
                id: '',
                tieuDe: '',
                danhMuc: categories[0]?.tenDanhMuc || 'Tin y tế & Sức khỏe cộng đồng',
                moTa: '',
                noiDung: '',
                nguoiTao: defaults.defaultDoctor,
                ngayTao: '2026-10-12',
                luotXem: 100,
                trangThai: true,
            }
    )

    const filteredCategories = useMemo(
        () =>
            categories.filter(
                (c) => !searchText || c.tenDanhMuc?.toLowerCase().includes(searchText.toLowerCase())
            ),
        [categories, searchText]
    )

    const filteredArticles = useMemo(
        () =>
            articles.filter(
                (a) =>
                    !searchText ||
                    a.tieuDe?.toLowerCase().includes(searchText.toLowerCase()) ||
                    a.danhMuc?.toLowerCase().includes(searchText.toLowerCase())
            ),
        [articles, searchText]
    )

    const handleSaveCategory = async () => {
        if (!catForm.tenDanhMuc?.trim()) {
            AppToast.error('Vui lòng nhập Tên danh mục tin tức!')
            return
        }
        const exists = categories.some((c) => c.id === catForm.id && catForm.id)
        let updated
        if (exists) {
            updated = categories.map((c) => (c.id === catForm.id ? { ...c, ...catForm } : c))
        } else {
            const newCat = {
                ...catForm,
                id: `DMTT-0${categories.length + 1}`,
                stt: categories.length + 1,
                ngayTao: new Date().toISOString().slice(0, 10),
            }
            updated = [...categories, newCat]
            setCatForm(newCat)
        }
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'newsCategories',
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_NEWS_CATEGORY' : 'CREATE_NEWS_CATEGORY',
                    doiTuong: catForm.tenDanhMuc,
                    mucDich: 'Quản lý danh mục tin tức y tế',
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật danh mục tin tức!' : 'Đã thêm mới danh mục tin tức!')
    }

    const handleDeleteCategory = async () => {
        if (!catForm.id) return
        const updated = categories.filter((c) => c.id !== catForm.id)
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'newsCategories',
                items: updated,
            })
        )
        setCatForm(updated[0] || { id: '', tenDanhMuc: '', moTa: '', thuTu: 1, trangThai: true })
        AppToast.info('Đã xóa danh mục tin tức!')
    }

    const handleSaveArticle = async () => {
        if (!artForm.tieuDe?.trim()) {
            AppToast.error('Vui lòng nhập Tiêu đề bài viết tin tức!')
            return
        }
        const exists = articles.some((a) => a.id === artForm.id && artForm.id)
        let updated
        if (exists) {
            updated = articles.map((a) => (a.id === artForm.id ? { ...a, ...artForm } : a))
        } else {
            const newArt = {
                ...artForm,
                id: `TT-0${articles.length + 1}`,
                stt: articles.length + 1,
                ngayTao: new Date().toISOString().slice(0, 10),
                luotXem: Number(artForm.luotXem) || 1,
            }
            updated = [newArt, ...articles]
            setArtForm(newArt)
        }
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'newsArticles',
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_NEWS_ARTICLE' : 'CREATE_NEWS_ARTICLE',
                    doiTuong: artForm.tieuDe,
                    mucDich: 'Quản lý bài viết tin tức y khoa',
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật bài viết tin tức!' : 'Đã đăng bài viết tin tức mới!')
    }

    const handleDeleteArticle = async () => {
        if (!artForm.id) return
        const updated = articles.filter((a) => a.id !== artForm.id)
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'newsArticles',
                items: updated,
            })
        )
        setArtForm(updated[0] || { id: '', tieuDe: '', danhMuc: '', moTa: '', noiDung: '', trangThai: true })
        AppToast.info('Đã xóa bài viết tin tức!')
    }

    return (
        <div className="space-y-3.5">
            {/* Mode Switch Header */}
            <div className="medpro-card p-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link
                        to="/admin/danh-muc-tin-tuc"
                        className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                            isCategoryMode
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/15'
                        }`}
                    >
                        <Folders size={15} weight={isCategoryMode ? 'fill' : 'duotone'} />
                        <span>1. Danh mục Tin tức ({categories.length})</span>
                    </Link>
                    <Link
                        to="/admin/tin-tuc"
                        className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                            !isCategoryMode
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/15'
                        }`}
                    >
                        <Newspaper size={15} weight={!isCategoryMode ? 'fill' : 'duotone'} />
                        <span>2. Quản lý Bài viết Tin tức ({articles.length})</span>
                    </Link>
                </div>
                <span className="text-xs text-slate-500">
                    Phân hệ Video 06: Quản lý Danh mục tin tức & Biên tập Tin tức Y tế
                </span>
            </div>

            {isCategoryMode ? (
                /* ── VIEW 1: DANH MỤC TIN TỨC ── */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-5 medpro-card p-3.5 flex flex-col">
                        <div className="medpro-section-title">
                            <span className="inline-flex items-center gap-1.5">
                                <Folders size={16} weight="duotone" className="text-[#00B5F1]" />
                                <span>DANH SÁCH DANH MỤC TIN TỨC</span>
                            </span>
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
                                placeholder="Tìm tên danh mục..."
                                className="medpro-input !pl-8"
                            />
                        </div>
                        <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Tên danh mục</th>
                                        <th>Thứ tự</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCategories.map((c, idx) => (
                                        <tr
                                            key={c.id}
                                            onClick={() => setCatForm({ ...c })}
                                            className={`cursor-pointer ${
                                                catForm.id === c.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                            }`}
                                        >
                                            <td className="tabular-nums font-bold">{idx + 1}</td>
                                            <td className="font-semibold text-[#12263F]">{c.tenDanhMuc}</td>
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
                        <div className="flex items-center justify-between border-b border-[#E8F4FD] pb-3">
                            <h2 className="font-display font-extrabold text-base text-[#003553] uppercase">
                                THÔNG TIN CHI TIẾT DANH MỤC TIN TỨC
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCatForm({
                                            id: '',
                                            tenDanhMuc: '',
                                            moTa: '',
                                            thuTu: categories.length + 1,
                                            nguoiTao: 'Admin',
                                            trangThai: true,
                                        })
                                    }
                                    className="medpro-btn-outline text-xs"
                                >
                                    <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                                    <span>Thêm mới</span>
                                </button>
                                <button type="button" onClick={handleSaveCategory} className="medpro-btn-primary text-xs">
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu danh mục</span>
                                </button>
                                {catForm.id && (
                                    <button type="button" onClick={handleDeleteCategory} className="medpro-btn-danger text-xs">
                                        <Trash size={14} weight="bold" />
                                        <span>Xóa</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên danh mục tin tức *</label>
                                <input
                                    type="text"
                                    value={catForm.tenDanhMuc || ''}
                                    onChange={(e) => setCatForm({ ...catForm, tenDanhMuc: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Mô tả chuyên mục</label>
                                <textarea
                                    rows={3}
                                    value={catForm.moTa || ''}
                                    onChange={(e) => setCatForm({ ...catForm, moTa: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Thứ tự hiển thị</label>
                                <input
                                    type="number"
                                    value={catForm.thuTu || 1}
                                    onChange={(e) => setCatForm({ ...catForm, thuTu: Number(e.target.value) })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-5">
                                <input
                                    id="cat-active"
                                    type="checkbox"
                                    checked={Boolean(catForm.trangThai)}
                                    onChange={(e) => setCatForm({ ...catForm, trangThai: e.target.checked })}
                                    className="w-4 h-4 accent-[#00B5F1]"
                                />
                                <label htmlFor="cat-active" className="text-xs font-bold text-[#003553] cursor-pointer">
                                    Kích hoạt hiển thị trên Cổng thông tin bệnh nhân
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── VIEW 2: QUẢN LÝ BÀI VIẾT TIN TỨC ── */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-5 medpro-card p-3.5 flex flex-col">
                        <div className="medpro-section-title">
                            <span className="inline-flex items-center gap-1.5">
                                <Newspaper size={16} weight="duotone" className="text-[#00B5F1]" />
                                <span>DANH SÁCH BÀI VIẾT ({filteredArticles.length})</span>
                            </span>
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
                                placeholder="Tìm tiêu đề bài viết, danh mục..."
                                className="medpro-input !pl-8"
                            />
                        </div>
                        <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Tiêu đề bài viết</th>
                                        <th>Danh mục</th>
                                        <th>Lượt xem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredArticles.map((a, idx) => (
                                        <tr
                                            key={a.id}
                                            onClick={() => setArtForm({ ...a })}
                                            className={`cursor-pointer ${
                                                artForm.id === a.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                            }`}
                                        >
                                            <td className="tabular-nums font-bold">{idx + 1}</td>
                                            <td className="font-semibold text-[#12263F]">{a.tieuDe}</td>
                                            <td className="text-xs text-[#00B5F1] font-bold">{a.danhMuc}</td>
                                            <td className="tabular-nums">
                                                <span className="inline-flex items-center gap-1">
                                                    <Eye size={13} className="text-slate-400" />
                                                    {a.luotXem}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredArticles.length === 0 && (
                                        <tr>
                                            <td colSpan={4}>
                                                <EmptyState icon="Newspaper" title="Không tìm thấy bài viết tin tức" />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-7 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F4FD] pb-3">
                            <h2 className="font-display font-extrabold text-base text-[#003553] uppercase">
                                BIÊN TẬP BÀI VIẾT TIN TỨC Y TẾ
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setArtForm({
                                            id: '',
                                            tieuDe: '',
                                            danhMuc: categories[0]?.tenDanhMuc || '',
                                            moTa: '',
                                            noiDung: '',
                                            nguoiTao: defaults.defaultDoctor,
                                            luotXem: 0,
                                            trangThai: true,
                                        })
                                    }
                                    className="medpro-btn-outline text-xs"
                                >
                                    <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                                    <span>Tạo bài viết mới</span>
                                </button>
                                <button type="button" onClick={handleSaveArticle} className="medpro-btn-primary text-xs">
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu &amp; Đăng bài</span>
                                </button>
                                {artForm.id && (
                                    <button type="button" onClick={handleDeleteArticle} className="medpro-btn-danger text-xs">
                                        <Trash size={14} weight="bold" />
                                        <span>Xóa</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                            <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl bg-[#F8FBFE] border border-[#CBE9FA]">
                                <div className="w-full h-32 rounded-xl bg-[#E8F4FD] flex flex-col items-center justify-center text-[#003553] mb-2 border border-dashed border-[#00B5F1]">
                                    <Camera size={28} weight="duotone" className="text-[#00B5F1]" />
                                    <span className="text-[11px] font-bold mt-1">Ảnh đại diện bài viết</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => AppToast.info('Đã chọn ảnh bìa cho bài viết tin tức!')}
                                    className="medpro-btn-outline !py-1 !px-3 text-xs w-full"
                                >
                                    <UploadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                                    <span>Chọn ảnh bìa</span>
                                </button>
                            </div>

                            <div className="sm:col-span-8 space-y-3">
                                <div>
                                    <label className="medpro-label">Chuyên mục tin tức</label>
                                    <select
                                        value={artForm.danhMuc || ''}
                                        onChange={(e) => setArtForm({ ...artForm, danhMuc: e.target.value })}
                                        className="medpro-input font-semibold"
                                    >
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.tenDanhMuc}>
                                                {c.tenDanhMuc}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="medpro-label">Tiêu đề bài viết *</label>
                                    <input
                                        type="text"
                                        value={artForm.tieuDe || ''}
                                        onChange={(e) => setArtForm({ ...artForm, tieuDe: e.target.value })}
                                        className="medpro-input font-bold text-[#003553]"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Mô tả tóm tắt (Sapo)</label>
                                    <textarea
                                        rows={2}
                                        value={artForm.moTa || ''}
                                        onChange={(e) => setArtForm({ ...artForm, moTa: e.target.value })}
                                        className="medpro-input"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-12">
                                <label className="medpro-label">Nội dung chi tiết bài viết</label>
                                <textarea
                                    rows={6}
                                    value={artForm.noiDung || ''}
                                    onChange={(e) => setArtForm({ ...artForm, noiDung: e.target.value })}
                                    className="medpro-input leading-relaxed"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
