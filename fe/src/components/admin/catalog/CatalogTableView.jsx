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
                    DANH SÁCH BẢN GHI ({filteredList.length}) — {catalogRouteMap[loaiDanhMuc]?.title?.toUpperCase()}
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
                    placeholder="Tìm kiếm nhanh theo mã, tên, hoạt chất, khoa phòng..."
                    className="medpro-input !pl-8"
                />
            </div>

            <div className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl">
                <table className="medpro-table">
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Mã / Ký hiệu</th>
                            <th>Tên / Nội dung danh mục</th>
                            <th>Thông tin phụ</th>
                            <th>TT</th>
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
                                    className={`cursor-pointer ${
                                        form.id === item.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                    }`}
                                >
                                    <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                    <td className="font-mono font-bold text-[#00B5F1]">{code}</td>
                                    <td className="font-semibold text-[#12263F]">{name}</td>
                                    <td className="text-xs text-slate-600">{extra}</td>
                                    <td>
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
