import {
    StatusBadge,
    EmptyState,
    MagnifyingGlass,
} from '../../common/ClinicIcon'

export default function CatalogTableView({
    filteredList,
    searchText,
    setSearchText,
    loaiDanhMuc,
    catalogRouteMap,
    activeCatalogKey,
    form,
    setForm,
}) {
    return (
        <div className="lg:col-span-6 medpro-card p-3.5 flex flex-col h-[calc(100vh-195px)]">
            <div className="medpro-section-title">
                <span>
                    DANH SÁCH BẢN GHI ({filteredList.length})
                    {catalogRouteMap[loaiDanhMuc]?.title ? ` — ${catalogRouteMap[loaiDanhMuc].title.toUpperCase()}` : ''}
                </span>
            </div>

            <div className="mb-3 relative">
                <MagnifyingGlass
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                />
                <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Tìm kiếm nhanh theo mã, tên, hoạt chất, khoa phòng..."
                    className="medpro-input !py-1.5 h-9 !pl-8 text-xs"
                />
            </div>

            <div className="flex-1 overflow-y-auto border border-clinic-border rounded-[6px]">
                <table className="medpro-table w-full [&_th]:!px-2 [&_td]:!px-2 text-xs">
                    <thead>
                        <tr>
                            <th className="w-9 text-center">STT</th>
                            <th className="whitespace-nowrap">Mã</th>
                            <th>Tên danh mục</th>
                            <th>Thông tin phụ</th>
                            <th className="w-[78px] whitespace-nowrap">TT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.map((item, idx) => {
                            const code =
                                item.ma || item.maTinh || item.maPhong || item.maICD || item.maThuoc || item.maDV
                            const name =
                                item.ten ||
                                item.noiDung ||
                                item.tenTinh ||
                                item.tenPhong ||
                                item.tenBenh ||
                                item.tenThuoc ||
                                item.tenDV
                            const extra =
                                activeCatalogKey === 'thuocVatTu'
                                    ? item.hoatChat ? `${item.hoatChat} (${item.nhomThuoc || 'Kê đơn'})` : item.nhomThuoc || ''
                                    : item.donGiaMacDinh
                                    ? `${Number(item.donGiaMacDinh).toLocaleString('vi-VN')} đ`
                                    : item.donGia
                                    ? `${Number(item.donGia).toLocaleString('vi-VN')} đ`
                                    : item.quanHuyen
                                    ? `${item.quanHuyen} - ${item.phuongXa}`
                                    : item.chuyenKhoa || item.chuongBenh || item.moTa || ''

                            return (
                                <tr
                                    key={item.id}
                                    onClick={() => setForm({ ...item })}
                                    className={`cursor-pointer transition-colors ${
                                        form.id === item.id ? '!bg-clinic-surface-alt font-semibold' : ''
                                    }`}
                                >
                                    <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                    <td className="font-mono font-bold text-clinic-cta whitespace-nowrap text-[11px]">{code}</td>
                                    <td className="font-semibold text-clinic-navy">{name}</td>
                                    <td className="text-xs text-clinic-text-secondary tabular-nums">{extra}</td>
                                    <td className="whitespace-nowrap">
                                        <StatusBadge status={item.trangThai !== false && item.is_active !== false ? 'Hiển thị' : 'Ẩn'} compact />
                                    </td>
                                </tr>
                            )
                        })}
                        {filteredList.length === 0 && (
                            <tr>
                                <td colSpan={5}>
                                    <EmptyState icon="Folders" title="Không tìm thấy bản ghi danh mục" />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
