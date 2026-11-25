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
                {Object.keys(catalogRouteMap || {}).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
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
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-bold whitespace-nowrap transition-colors ${
                                        active
                                            ? 'bg-clinic-navy text-clinic-surface'
                                            : 'text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    <ClinicIcon name={meta.icon || 'Folders'} size={14} weight={active ? 'fill' : 'duotone'} />
                                    <span>{meta.title}</span>
                                </Link>
                            )
                        })}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                    >
                        <UploadSimple size={14} weight="bold" className="text-clinic-cta" />
                        <span>Nạp dữ liệu (Import)</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleExportCatalog}
                        className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                    >
                        <DownloadSimple size={14} weight="bold" className="text-clinic-cta" />
                        <span>Xuất Excel</span>
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={handleImportFile} />
                </div>
            </div>

            {loaiDanhMuc === 'chung' && (
                <div className="medpro-card p-2 flex flex-wrap items-center gap-1.5 bg-clinic-surface-tint">
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
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors cursor-pointer ${
                                    active
                                        ? 'bg-clinic-surface text-clinic-cta border border-clinic-cta'
                                        : 'text-clinic-text-secondary hover:bg-clinic-surface hover:text-clinic-navy border border-transparent'
                                }`}
                            >
                                <ClinicIcon name={sub.icon || 'Dot'} size={14} weight={active ? 'fill' : 'regular'} />
                                <span>{sub.label || sub.title}</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {loaiDanhMuc === 'khoa-phong' && (
                <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2 bg-clinic-surface-tint">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setActiveKhoaPhongView('rooms')}
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                activeKhoaPhongView === 'rooms'
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'bg-clinic-surface text-clinic-text-secondary border border-clinic-border hover:border-clinic-cta hover:text-clinic-navy'
                            }`}
                        >
                            <ClinicIcon name="Buildings" size={14} weight="bold" />
                            <span>Buồng khám vật lý &amp; Phòng chức năng</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveKhoaPhongView('departments')}
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                activeKhoaPhongView === 'departments'
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'bg-clinic-surface text-clinic-text-secondary border border-clinic-border hover:border-clinic-cta hover:text-clinic-navy'
                            }`}
                        >
                            <ClinicIcon name="Folders" size={14} weight="bold" />
                            <span>Khoa / Chuyên khoa khám bệnh</span>
                        </button>
                    </div>
                    <span className="text-xs text-clinic-text-secondary font-medium">
                        Đồng bộ cơ sở dữ liệu phòng khám theo thời gian thực
                    </span>
                </div>
            )}

            {loaiDanhMuc === 'dich-vu' && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-clinic-surface-tint p-3 rounded-[6px] border border-clinic-info-border">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-[6px] bg-clinic-navy text-clinic-surface flex items-center justify-center shrink-0">
                            <ClinicIcon name="Hospital" size={17} weight="duotone" />
                        </span>
                        <div>
                            <div className="text-xs font-extrabold text-clinic-navy uppercase">
                                Danh mục dịch vụ kỹ thuật &amp; Bảng giá y tế niêm yết
                            </div>
                            <div className="text-[11px] text-clinic-text-secondary">
                                Quản lý đơn vị tính (Lần/Test/Răng), thuế suất VAT, thời gian thực hiện và doanh thu tích lũy.
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleOpenPriceHistory}
                            className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                        >
                            <ClinicIcon name="ClockCounterClockwise" size={14} weight="bold" className="text-clinic-cta" />
                            <span>Lịch sử điều chỉnh giá</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenExportModal}
                            className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                        >
                            <DownloadSimple size={14} weight="bold" />
                            <span>Xem bảng giá &amp; Xuất Excel</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
