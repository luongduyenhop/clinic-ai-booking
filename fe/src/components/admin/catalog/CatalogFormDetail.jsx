import {
    Plus,
    FloppyDisk,
    Trash,
} from '../../common/ClinicIcon'

export default function CatalogFormDetail({
    form,
    setForm,
    handleNewItem,
    handleSaveItem,
    handleDeleteItem,
    activeCatalogKey,
    activeKhoaPhongView,
    loaiDanhMuc,
    activeGeneralSubTab,
}) {
    return (
        <div className="lg:col-span-6 medpro-card p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F4FD] pb-3">
                <div>
                    <h2 className="font-display font-extrabold text-base text-[#003553] uppercase">
                        CHI TIẾT BẢN GHI DANH MỤC
                    </h2>
                    <p className="text-xs text-slate-500">
                        Chỉnh sửa hoặc thêm mới dữ liệu chuẩn hóa dùng chung toàn phòng khám
                    </p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={handleNewItem} className="medpro-btn-outline text-xs">
                        <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                        <span>Làm mới / Tạo mới</span>
                    </button>
                    <button type="button" onClick={handleSaveItem} className="medpro-btn-primary text-xs">
                        <FloppyDisk size={15} weight="bold" />
                        <span>Lưu danh mục</span>
                    </button>
                    {form.id && (
                        <button type="button" onClick={handleDeleteItem} className="medpro-btn-danger text-xs">
                            <Trash size={14} weight="bold" />
                            <span>Xóa</span>
                        </button>
                    )}
                </div>
            </div>

            {activeCatalogKey === 'diaChi' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="medpro-label">Mã Tỉnh / Thành phố *</label>
                        <input
                            type="text"
                            value={form.maTinh || ''}
                            onChange={(e) => setForm({ ...form, maTinh: e.target.value })}
                            className="medpro-input font-mono font-bold text-[#00B5F1]"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Tên Tỉnh / Thành phố *</label>
                        <input
                            type="text"
                            value={form.tenTinh || ''}
                            onChange={(e) => setForm({ ...form, tenTinh: e.target.value })}
                            className="medpro-input font-semibold"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Quận / Huyện / Thị xã *</label>
                        <input
                            type="text"
                            value={form.quanHuyen || ''}
                            onChange={(e) => setForm({ ...form, quanHuyen: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Phường / Xã / Thị trấn *</label>
                        <input
                            type="text"
                            value={form.phuongXa || ''}
                            onChange={(e) => setForm({ ...form, phuongXa: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                </div>
            )}

            {activeCatalogKey === 'khoaPhong' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="medpro-label mb-0">Mã {activeKhoaPhongView === 'departments' ? 'chuyên khoa' : 'buồng khám'}</label>
                            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                Mã chuẩn hóa
                            </span>
                        </div>
                        <input
                            type="text"
                            value={form.maPhong || ''}
                            onChange={(e) => setForm({ ...form, maPhong: e.target.value })}
                            className="medpro-input font-mono font-bold text-[#003553]"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Tên {activeKhoaPhongView === 'departments' ? 'Khoa / Chuyên khoa' : 'Buồng khám'} *</label>
                        <input
                            type="text"
                            value={form.tenPhong || ''}
                            onChange={(e) => setForm({ ...form, tenPhong: e.target.value })}
                            className="medpro-input font-semibold"
                        />
                    </div>
                    {activeKhoaPhongView === 'departments' ? (
                        <div className="sm:col-span-2">
                            <label className="medpro-label">Mô tả phạm vi chuyên môn</label>
                            <textarea
                                rows={2}
                                value={form.moTa || ''}
                                onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                                className="medpro-input"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="medpro-label">Chuyên khoa phụ trách</label>
                            <input
                                type="text"
                                value={form.chuyenKhoa || ''}
                                onChange={(e) => setForm({ ...form, chuyenKhoa: e.target.value })}
                                className="medpro-input"
                            />
                        </div>
                    )}
                    <div>
                        <label className="medpro-label">Vị trí tầng</label>
                        <input
                            type="text"
                            value={form.tang || ''}
                            onChange={(e) => setForm({ ...form, tang: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                    {activeKhoaPhongView !== 'departments' && (
                        <div className="sm:col-span-2">
                            <label className="medpro-label">Thiết bị y tế chính trong phòng</label>
                            <input
                                type="text"
                                value={form.thiet_bi_chinh || ''}
                                onChange={(e) => setForm({ ...form, thiet_bi_chinh: e.target.value })}
                                className="medpro-input font-semibold text-[#003553]"
                                placeholder="Ví dụ: Máy đo điện tim 12 cần, máy siêu âm màu 4D"
                            />
                        </div>
                    )}
                </div>
            )}

            {activeCatalogKey === 'danhMucBenh' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="medpro-label">Mã bệnh Quốc tế ICD-10 *</label>
                        <input
                            type="text"
                            value={form.maICD || ''}
                            onChange={(e) => setForm({ ...form, maICD: e.target.value })}
                            className="medpro-input font-mono font-bold text-[#00B5F1]"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Tên bệnh / Chẩn đoán y khoa *</label>
                        <input
                            type="text"
                            value={form.tenBenh || ''}
                            onChange={(e) => setForm({ ...form, tenBenh: e.target.value })}
                            className="medpro-input font-semibold"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="medpro-label">Chương bệnh (Theo phân loại WHO / BYT)</label>
                        <input
                            type="text"
                            value={form.chuongBenh || ''}
                            onChange={(e) => setForm({ ...form, chuongBenh: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            id="truyenNhiemCheckbox"
                            checked={Boolean(form.truyenNhiem)}
                            onChange={(e) => setForm({ ...form, truyenNhiem: e.target.checked })}
                            className="rounded text-[#00B5F1] focus:ring-[#00B5F1]"
                        />
                        <label htmlFor="truyenNhiemCheckbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                            Bệnh truyền nhiễm bắt buộc báo cáo dịch tễ
                        </label>
                    </div>
                </div>
            )}

            {activeCatalogKey === 'thuocVatTu' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="medpro-label">Mã thuốc / Dược phẩm *</label>
                        <input
                            type="text"
                            value={form.maThuoc || ''}
                            onChange={(e) => setForm({ ...form, maThuoc: e.target.value })}
                            className="medpro-input font-mono font-bold text-[#00B5F1]"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Tên thuốc & Biệt dược *</label>
                        <input
                            type="text"
                            value={form.tenThuoc || ''}
                            onChange={(e) => setForm({ ...form, tenThuoc: e.target.value })}
                            className="medpro-input font-semibold"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Hoạt chất & Hàm lượng *</label>
                        <input
                            type="text"
                            value={form.hoatChat || ''}
                            onChange={(e) => setForm({ ...form, hoatChat: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Đơn vị tính (DVT)</label>
                        <select
                            value={form.dvt || 'Viên'}
                            onChange={(e) => setForm({ ...form, dvt: e.target.value })}
                            className="medpro-input"
                        >
                            <option value="Viên">Viên</option>
                            <option value="Vỉ">Vỉ</option>
                            <option value="Hộp">Hộp</option>
                            <option value="Lọ">Lọ</option>
                            <option value="Ống">Ống</option>
                            <option value="Gói">Gói</option>
                            <option value="Chai">Chai</option>
                        </select>
                    </div>
                    <div>
                        <label className="medpro-label">Đường dùng thuốc</label>
                        <input
                            type="text"
                            value={form.duongDung || 'Uống'}
                            onChange={(e) => setForm({ ...form, duongDung: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Phân nhóm dược lý</label>
                        <input
                            type="text"
                            value={form.nhomThuoc || 'Thuốc kê đơn'}
                            onChange={(e) => setForm({ ...form, nhomThuoc: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                </div>
            )}

            {activeCatalogKey === 'dichVu' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="medpro-label mb-0">Mã dịch vụ kỹ thuật *</label>
                            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                Mã chuẩn hóa
                            </span>
                        </div>
                        <input
                            type="text"
                            value={form.maDV || ''}
                            onChange={(e) => setForm({ ...form, maDV: e.target.value })}
                            className="medpro-input font-mono font-bold text-[#003553]"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Nhóm dịch vụ</label>
                        <input
                            type="text"
                            value={form.nhomDV || ''}
                            onChange={(e) => setForm({ ...form, nhomDV: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="medpro-label">Tên dịch vụ khám / Cận lâm sàng *</label>
                        <input
                            type="text"
                            value={form.tenDV || ''}
                            onChange={(e) => setForm({ ...form, tenDV: e.target.value })}
                            className="medpro-input font-semibold"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Đơn vị tính (DVT) chuẩn y tế</label>
                        <select
                            value={form.dvt || 'Lần'}
                            onChange={(e) => setForm({ ...form, dvt: e.target.value })}
                            className="medpro-input"
                        >
                            <option value="Lần">Lần</option>
                            <option value="Gói">Gói</option>
                            <option value="Test">Test</option>
                            <option value="Răng">Răng</option>
                            <option value="Phim">Phim</option>
                            <option value="Mẫu">Mẫu</option>
                            <option value="Ca">Ca</option>
                        </select>
                    </div>
                    <div>
                        <label className="medpro-label">Đơn giá niêm yết (VNĐ)</label>
                        <input
                            type="number"
                            value={form.donGia || 0}
                            onChange={(e) => setForm({ ...form, donGia: Number(e.target.value) })}
                            className="medpro-input tabular-nums font-bold text-[#003553]"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Thuế suất VAT (%)</label>
                        <select
                            value={form.vat_percent !== undefined ? form.vat_percent : 0}
                            onChange={(e) => setForm({ ...form, vat_percent: Number(e.target.value) })}
                            className="medpro-input"
                        >
                            <option value={0}>0% (Dịch vụ KCB miễn thuế GTGT)</option>
                            <option value={5}>5%</option>
                            <option value={8}>8%</option>
                            <option value={10}>10%</option>
                        </select>
                    </div>
                    <div>
                        <label className="medpro-label">Thời gian thực hiện (Phút)</label>
                        <input
                            type="number"
                            value={form.thoi_gian_thuc_hien || 15}
                            onChange={(e) => setForm({ ...form, thoi_gian_thuc_hien: Number(e.target.value) })}
                            className="medpro-input tabular-nums"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="medpro-label">Phòng thực hiện mặc định</label>
                        <input
                            type="text"
                            value={form.phongTH || ''}
                            onChange={(e) => setForm({ ...form, phongTH: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                </div>
            )}

            {loaiDanhMuc === 'chung' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="medpro-label">Mã ký hiệu / Mã gõ tắt *</label>
                        <input
                            type="text"
                            value={form.ma || ''}
                            onChange={(e) => setForm({ ...form, ma: e.target.value })}
                            className="medpro-input font-mono font-bold text-[#00B5F1]"
                        />
                    </div>
                    <div>
                        <label className="medpro-label">Thứ tự sắp xếp</label>
                        <input
                            type="number"
                            value={form.thuTu || 1}
                            onChange={(e) => setForm({ ...form, thuTu: Number(e.target.value) })}
                            className="medpro-input tabular-nums"
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="medpro-label">Tên / Nội dung diễn giải *</label>
                        <input
                            type="text"
                            value={form.ten || form.noiDung || ''}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    ten: e.target.value,
                                    noiDung: e.target.value,
                                })
                            }
                            className="medpro-input font-semibold"
                        />
                    </div>
                    {activeGeneralSubTab === 'khoanThu' && (
                        <div className="sm:col-span-2">
                            <label className="medpro-label">Đơn giá mặc định (VNĐ)</label>
                            <input
                                type="number"
                                value={form.donGiaMacDinh || 0}
                                onChange={(e) => setForm({ ...form, donGiaMacDinh: Number(e.target.value) })}
                                className="medpro-input tabular-nums font-bold"
                            />
                        </div>
                    )}
                    <div className="sm:col-span-2">
                        <label className="medpro-label">Mô tả / Ghi chú áp dụng</label>
                        <textarea
                            rows={3}
                            value={form.moTa || ''}
                            onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                            className="medpro-input"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
