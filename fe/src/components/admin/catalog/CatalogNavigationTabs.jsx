import { Link } from 'react-router-dom'
import {
    ClinicIcon,
    DownloadSimple,
    UploadSimple,
} from '../../common/ClinicIcon'

export default function CatalogNavigationTabs({
    catalogRouteMap,
    loaiDanhMuc,
    catalogs,
    activeGeneralSubTab,
    generalSubTabs,
    setActiveGeneralSubTab,
    activeKhoaPhongView,
    setActiveKhoaPhongView,
    handleSwitchCatalogView,
    fileInputRef,
    handleImportFile,
    handleExportCatalog,
    handleOpenPriceHistory,
    handleOpenExportModal,
}) {
    return (
        <div className="space-y-3.5">
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(catalogRouteMap).map(([key, meta]) => {
                        const active = loaiDanhMuc === key
                        return (
                            <Link
                                key={key}
                                to={meta.path}
                                onClick={() =>
                                    handleSwitchCatalogView(
                                        catalogs[key === 'chung' ? activeGeneralSubTab : key] || []
                                    )
                                }
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                                    active
                                        ? 'bg-[#00B5F1] text-white shadow-xs'
                                        : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/15'
                                }`}
                            >
                                <ClinicIcon name={meta.icon || 'Folders'} size={14} weight={active ? 'fill' : 'duotone'} />
                                <span>{meta.title}</span>
                            </Link>
                        )
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="medpro-btn-outline !py-1 !px-3 text-xs"
                    >
                        <UploadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                        <span>Nạp dữ liệu (Import)</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleExportCatalog}
                        className="medpro-btn-outline !py-1 !px-3 text-xs"
                    >
                        <DownloadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                        <span>Xuất Excel</span>
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={handleImportFile} />
                </div>
            </div>

            {loaiDanhMuc === 'chung' && (
                <div className="medpro-card p-2.5 flex flex-wrap items-center gap-1.5 bg-[#F8FBFE]">
                    {generalSubTabs.map((sub) => {
                        const active = activeGeneralSubTab === sub.key
                        return (
                            <button
                                key={sub.key}
                                type="button"
                                onClick={() => {
                                    setActiveGeneralSubTab(sub.key)
                                    handleSwitchCatalogView(catalogs[sub.key] || [])
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    active
                                        ? 'bg-white text-[#00B5F1] shadow-xs border border-[#00B5F1]/40'
                                        : 'text-slate-600 hover:bg-white/80'
                                }`}
                            >
                                <ClinicIcon name={sub.icon || 'Dot'} size={14} weight={active ? 'fill' : 'regular'} />
                                <span>{sub.title}</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {loaiDanhMuc === 'khoa-phong' && (
                <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2 bg-[#F8FBFE]">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveKhoaPhongView('rooms')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeKhoaPhongView === 'rooms'
                                    ? 'bg-[#003553] text-white shadow-xs'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <ClinicIcon name="Buildings" size={14} weight="bold" />
                            <span>Buồng khám vật lý & Phòng chức năng (/rooms)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveKhoaPhongView('departments')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                activeKhoaPhongView === 'departments'
                                    ? 'bg-[#003553] text-white shadow-xs'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <ClinicIcon name="Folders" size={14} weight="bold" />
                            <span>Khoa / Chuyên khoa khám bệnh (/departments)</span>
                        </button>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold">
                        Lưu trữ quan hệ PostgreSQL thời gian thực
                    </span>
                </div>
            )}

            {loaiDanhMuc === 'dich-vu' && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-sky-50 via-[#E8F4FD] to-indigo-50/60 p-3 rounded-xl border border-[#00B5F1]/30">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-[#003553] text-[#00B5F1] flex items-center justify-center shrink-0">
                            <ClinicIcon name="Hospital" size={18} weight="duotone" />
                        </span>
                        <div>
                            <div className="text-xs font-extrabold text-[#003553]">
                                DANH MỤC DỊCH VỤ KỸ THUẬT & BẢNG GIÁ Y TẾ NIÊM YẾT
                            </div>
                            <div className="text-[11px] text-slate-500">
                                Quản lý Đơn vị tính (Lần/Test/Răng), Thuế suất VAT theo Luật Thuế GTGT, Thời gian thực hiện và Doanh thu tích lũy.
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleOpenPriceHistory}
                            className="px-3.5 py-1.5 rounded-lg bg-[#003553] hover:bg-[#002235] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <ClinicIcon name="ClockCounterClockwise" size={14} weight="bold" />
                            <span>Lịch sử điều chỉnh giá bất biến</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenExportModal}
                            className="px-3.5 py-1.5 rounded-lg bg-[#00B5F1] hover:bg-[#009cd1] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <DownloadSimple size={14} weight="bold" />
                            <span>Xuất Bảng giá Dịch vụ Chuẩn y tế (Excel/CSV)</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
