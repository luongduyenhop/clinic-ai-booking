import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
    User,
    Users,
    Plus,
    PencilSimple,
    Trash,
    ShieldCheck,
    PhoneCall,
    WarningCircle,
    Heartbeat,
    IdentificationCard
} from '../../components/common/ClinicIcon'

export default function PatientProfilePage() {
    const [activeTab, setActiveTab] = useState('self') // 'self' | 'family'

    // Hồ sơ chính của bệnh nhân
    const [selfProfile, setSelfProfile] = useState({
        maDinhDanh: 'BN-2026-0819',
        hoTen: 'Nguyễn Văn An',
        soDienThoai: '0912345678',
        email: 'nguyenvanan@gmail.com',
        ngaySinh: '1990-05-15',
        gioiTinh: 'Nam',
        cccd: '001090012345',
        nhomMau: 'O+',
        diUng: 'Dị ứng nhẹ với phấn hoa và Penicillin',
        tienSuBenh: 'Tiền sử Tăng huyết áp nhẹ điều trị ngoại trú',
        nguoiLienHe: 'Trần Thị Thu (Vợ)',
        sdtNguoiLienHe: '0988776655'
    })

    // Danh sách hồ sơ người thân
    const [familyMembers, setFamilyMembers] = useState([
        {
            id: 1,
            hoTen: 'Nguyễn Minh Khang',
            moiQuanHe: 'Con',
            ngaySinh: '2021-09-12',
            gioiTinh: 'Nam',
            soDienThoai: '0912345678',
            diUng: 'Không có dị ứng',
            tienSu: 'Viêm phế quản co thắt 1 lần'
        },
        {
            id: 2,
            hoTen: 'Nguyễn Văn Hùng',
            moiQuanHe: 'Bố',
            ngaySinh: '1958-03-20',
            gioiTinh: 'Nam',
            soDienThoai: '0903456789',
            diUng: 'Dị ứng Aspirin',
            tienSu: 'Đái tháo đường type 2, Tăng huyết áp độ 2'
        }
    ])

    // Modal state for adding relative
    const [showAddModal, setShowAddModal] = useState(false)
    const [newRelative, setNewRelative] = useState({
        hoTen: '',
        moiQuanHe: 'Con',
        ngaySinh: '',
        gioiTinh: 'Nam',
        soDienThoai: '',
        diUng: '',
        tienSu: ''
    })

    const handleSaveSelfProfile = (e) => {
        e.preventDefault()
        toast.success('Cập nhật hồ sơ sức khỏe cá nhân thành công!')
    }

    const handleAddRelative = (e) => {
        e.preventDefault()
        if (!newRelative.hoTen.trim()) {
            toast.warning('Vui lòng nhập họ và tên người thân!')
            return
        }
        setFamilyMembers(prev => [
            ...prev,
            { id: Date.now(), ...newRelative }
        ])
        setShowAddModal(false)
        setNewRelative({
            hoTen: '',
            moiQuanHe: 'Con',
            ngaySinh: '',
            gioiTinh: 'Nam',
            soDienThoai: '',
            diUng: '',
            tienSu: ''
        })
        toast.success('Đã thêm hồ sơ người thân thành công!')
    }

    const handleDeleteRelative = (id) => {
        setFamilyMembers(prev => prev.filter(m => m.id !== id))
        toast.info('Đã xóa hồ sơ người thân.')
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div>
                <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                    <Link to="/" className="hover:text-[#00B5F1]">Trang chủ</Link>
                    <span>/</span>
                    <span className="text-[#003553]">Hồ sơ sức khỏe & Gia đình</span>
                </nav>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#003553] tracking-tight">
                            HỒ SƠ SỨC KHỎE CỦA TÔI
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">
                            Quản lý hồ sơ định danh y tế và hồ sơ người thân để đặt lịch khám nhanh chóng
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-[#E8F4FD] text-[#00B5F1] px-3.5 py-1.5 rounded-full border border-[#B8E5FA] text-xs font-bold">
                        <ShieldCheck size={16} weight="duotone" />
                        <span>Mã y tế: {selfProfile.maDinhDanh}</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('self')}
                    className={`py-3 px-6 font-bold text-sm border-b-2 transition cursor-pointer flex items-center gap-2 ${
                        activeTab === 'self'
                            ? 'border-[#00B5F1] text-[#00B5F1]'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <User size={18} weight={activeTab === 'self' ? 'fill' : 'regular'} />
                    <span>Hồ Sơ Của Bản Thân</span>
                </button>
                <button
                    onClick={() => setActiveTab('family')}
                    className={`py-3 px-6 font-bold text-sm border-b-2 transition cursor-pointer flex items-center gap-2 ${
                        activeTab === 'family'
                            ? 'border-[#00B5F1] text-[#00B5F1]'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Users size={18} weight={activeTab === 'family' ? 'fill' : 'regular'} />
                    <span>Hồ Sơ Người Thân Trong Gia Đình ({familyMembers.length})</span>
                </button>
            </div>

            {/* Tab 1: Hồ Sơ Cá Nhân */}
            {activeTab === 'self' && (
                <form onSubmit={handleSaveSelfProfile} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Họ và tên (*):</label>
                            <input
                                type="text"
                                value={selfProfile.hoTen}
                                onChange={(e) => setSelfProfile({ ...selfProfile, hoTen: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Số điện thoại (*):</label>
                            <input
                                type="tel"
                                value={selfProfile.soDienThoai}
                                onChange={(e) => setSelfProfile({ ...selfProfile, soDienThoai: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Ngày sinh:</label>
                            <input
                                type="date"
                                value={selfProfile.ngaySinh}
                                onChange={(e) => setSelfProfile({ ...selfProfile, ngaySinh: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Giới tính:</label>
                            <select
                                value={selfProfile.gioiTinh}
                                onChange={(e) => setSelfProfile({ ...selfProfile, gioiTinh: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            >
                                <option value="Nam">Nam</option>
                                <option value="Nữ">Nữ</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Số CCCD / Định danh:</label>
                            <input
                                type="text"
                                value={selfProfile.cccd}
                                onChange={(e) => setSelfProfile({ ...selfProfile, cccd: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Nhóm máu:</label>
                            <input
                                type="text"
                                value={selfProfile.nhomMau}
                                onChange={(e) => setSelfProfile({ ...selfProfile, nhomMau: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-amber-700 flex items-center gap-1 mb-1">
                                <WarningCircle size={15} weight="bold" />
                                <span>Tiền sử dị ứng thuốc & thực phẩm:</span>
                            </label>
                            <input
                                type="text"
                                value={selfProfile.diUng}
                                onChange={(e) => setSelfProfile({ ...selfProfile, diUng: e.target.value })}
                                className="w-full border border-amber-200 bg-amber-50/50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 block mb-1">Tiền sử bệnh lý bản thân:</label>
                            <textarea
                                rows={2}
                                value={selfProfile.tienSuBenh}
                                onChange={(e) => setSelfProfile({ ...selfProfile, tienSuBenh: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Người liên hệ khẩn cấp:</label>
                            <input
                                type="text"
                                value={selfProfile.nguoiLienHe}
                                onChange={(e) => setSelfProfile({ ...selfProfile, nguoiLienHe: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">SĐT người liên hệ khẩn cấp:</label>
                            <input
                                type="tel"
                                value={selfProfile.sdtNguoiLienHe}
                                onChange={(e) => setSelfProfile({ ...selfProfile, sdtNguoiLienHe: e.target.value })}
                                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            className="medpro-btn-primary !py-2.5 !px-6 font-bold text-sm cursor-pointer"
                        >
                            Lưu Thay Đổi Hồ Sơ
                        </button>
                    </div>
                </form>
            )}

            {/* Tab 2: Hồ Sơ Người Thân */}
            {activeTab === 'family' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-500">
                            Thêm con cái, bố mẹ hoặc người thân để đặt lịch khám bệnh hộ chỉ với một chạm.
                        </p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="medpro-btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                            <Plus size={16} weight="bold" />
                            <span>Thêm Người Thân</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {familyMembers.map((member) => (
                            <div key={member.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 relative">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#E8F4FD] text-[#00B5F1] flex items-center justify-center font-bold text-sm">
                                            {member.hoTen.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-sm text-[#003553]">{member.hoTen}</h3>
                                            <span className="text-[11px] font-bold text-[#00B5F1] bg-[#E8F4FD] px-2 py-0.5 rounded-md">
                                                Mối quan hệ: {member.moiQuanHe}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteRelative(member.id)}
                                        className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                                        title="Xóa hồ sơ"
                                    >
                                        <Trash size={16} />
                                    </button>
                                </div>

                                <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                                    <p><strong>Ngày sinh:</strong> {member.ngaySinh || 'Chưa cập nhật'} ({member.gioiTinh})</p>
                                    <p><strong>Số điện thoại:</strong> {member.soDienThoai}</p>
                                    {member.diUng && <p className="text-amber-700"><strong>Dị ứng:</strong> {member.diUng}</p>}
                                    {member.tienSu && <p><strong>Tiền sử:</strong> {member.tienSu}</p>}
                                </div>

                                <div className="pt-2">
                                    <Link
                                        to={`/dat-lich`}
                                        className="inline-block text-xs font-bold text-[#00B5F1] hover:underline"
                                    >
                                        👉 Đặt lịch khám cho {member.hoTen}
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Thêm Người Thân */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-extrabold text-[#003553] text-base">Thêm Hồ Sơ Người Thân</h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleAddRelative} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Mối quan hệ (*):</label>
                                <select
                                    value={newRelative.moiQuanHe}
                                    onChange={(e) => setNewRelative({ ...newRelative, moiQuanHe: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                >
                                    <option value="Con">Con nhỏ / Con cái</option>
                                    <option value="Bố/Mẹ">Bố / Mẹ</option>
                                    <option value="Vợ/Chồng">Vợ / Chồng</option>
                                    <option value="Khác">Người thân khác</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Họ và tên (*):</label>
                                <input
                                    type="text"
                                    required
                                    value={newRelative.hoTen}
                                    onChange={(e) => setNewRelative({ ...newRelative, hoTen: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="font-bold text-slate-600 block mb-1">Ngày sinh:</label>
                                    <input
                                        type="date"
                                        value={newRelative.ngaySinh}
                                        onChange={(e) => setNewRelative({ ...newRelative, ngaySinh: e.target.value })}
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-600 block mb-1">Giới tính:</label>
                                    <select
                                        value={newRelative.gioiTinh}
                                        onChange={(e) => setNewRelative({ ...newRelative, gioiTinh: e.target.value })}
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                    >
                                        <option value="Nam">Nam</option>
                                        <option value="Nữ">Nữ</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Số điện thoại liên hệ:</label>
                                <input
                                    type="tel"
                                    value={newRelative.soDienThoai}
                                    onChange={(e) => setNewRelative({ ...newRelative, soDienThoai: e.target.value })}
                                    placeholder="Dùng SĐT của bạn hoặc của người thân"
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Dị ứng thuốc/thức ăn:</label>
                                <input
                                    type="text"
                                    value={newRelative.diUng}
                                    onChange={(e) => setNewRelative({ ...newRelative, diUng: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#00B5F1]"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="medpro-btn-primary !py-2 !px-5 font-bold"
                                >
                                    Lưu Hồ Sơ
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
