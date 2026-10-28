import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { PERMISSION_MODULES_23, getMasterOptions, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import {
    StatusBadge,
    ShieldCheck,
    UserGear,
    FloppyDisk,
    CheckCircle,
    Broom,
    Plus,
    Trash,
    Camera,
    UploadSimple,
    Warning,
    XCircle,
} from '../../components/common/ClinicIcon'

const getNextStaffCode = (list) => {
    let max = 0
    ;(list || []).forEach((s) => {
        const m = String(s.maNV || s.id || '').match(/(\d+)/)
        if (m) {
            const num = parseInt(m[1], 10)
            if (num > max) max = num
        }
    })
    return "NV" + String(max + 1).padStart(3, '0')
}

export default function RolePermissionPage() {
    const location = useLocation()
    const dispatch = useDispatch()
    const isStaffMode = location.pathname.includes('nhan-vien')

    const { clinicData } = useSelector((state) => state.app.admin)
    const roles = clinicData?.roles || []
    const staffList = clinicData?.staffList || []
    const khoaPhongList = clinicData?.catalogs?.khoaPhong || []
    const permissionModules = clinicData?.permissionModules || PERMISSION_MODULES_23

    const masterOptions = getMasterOptions(clinicData)
    const defaults = getFormDefaults(clinicData)
    const licenseStatuses = masterOptions.licenseStatuses || [
        { code: 'ACTIVE', label: 'ACTIVE (Đủ điều kiện hành nghề)' },
        { code: 'EXPIRING_SOON', label: 'EXPIRING_SOON (Sắp hết hạn < 60 ngày)' },
        { code: 'EXPIRED', label: 'EXPIRED (Hết hạn - Chặn phân công)' },
        { code: 'SUSPENDED', label: 'SUSPENDED (Đình chỉ - Chặn phân công)' },
    ]
    const staffRoleOptions = masterOptions.staffRoleOptions || [
        'Admin / Phụ trách chuyên môn',
        'Bác sĩ khám bệnh',
        'Bác sĩ Cận lâm sàng',
        'Lễ tân - Tiếp đón',
        'Thu ngân - Viện phí',
    ]

    const [selectedRole, setSelectedRole] = useState(() => roles[0] || {})
    const [newRoleName, setNewRoleName] = useState('')
    const [newRoleDesc, setNewRoleDesc] = useState('')

    const [staffForm, setStaffForm] = useState(
        () =>
            staffList[0] || {
                id: '',
                maNV: getNextStaffCode(staffList),
                hoTen: '',
                taiKhoan: '',
                dienThoai: '',
                vaiTro: staffRoleOptions[1],
                khoaPhong: khoaPhongList[0]?.tenPhong || defaults.defaultClinicRoom,
                chuyenKhoa: defaults.defaultSpecialty,
                soCCHN: '',
                ngayCapCCHN: '2022-01-01',
                ngayHetHanCCHN: '2029-01-01',
                trangThaiCCHN: 'ACTIVE',
                trangThai: true,
            }
    )

    const handleTogglePermission = (stt, field) => {
        const updatedPermissions = (selectedRole.permissions || []).map((p) =>
            p.stt === stt ? { ...p, [field]: !p[field] } : p
        )
        setSelectedRole({ ...selectedRole, permissions: updatedPermissions })
    }

    const handleCheckAll = (checked) => {
        const updatedPermissions = (selectedRole.permissions || []).map((p) => ({
            ...p,
            xem: checked,
            them: checked,
            sua: checked,
            xoa: checked,
            inXuat: checked,
        }))
        setSelectedRole({ ...selectedRole, permissions: updatedPermissions })
    }

    const handleSaveRolePermissions = async () => {
        const updatedRoles = roles.map((r) => (r.id === selectedRole.id ? selectedRole : r))
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'roles',
                items: updatedRoles,
                auditEntry: {
                    hanhDong: 'UPDATE_ROLE_PERMISSIONS',
                    doiTuong: `Vai trò: ${selectedRole.tenVaiTro}`,
                    mucDich: 'Cập nhật ma trận 23 quyền hạn người dùng',
                },
            })
        )
        AppToast.success(`Đã lưu ma trận phân quyền cho vai trò "${selectedRole.tenVaiTro}"!`)
    }

    const handleCreateRole = async () => {
        if (!newRoleName.trim()) {
            AppToast.warning('Vui lòng nhập Tên vai trò mới!')
            return
        }
        const newRole = {
            id: `ROLE-${Date.now().toString().slice(-4)}`,
            tenVaiTro: newRoleName,
            moTa: newRoleDesc || 'Vai trò tùy chỉnh phòng khám',
            permissions: Array.from({ length: permissionModules.length }, (_, idx) => ({
                stt: idx + 1,
                xem: true,
                them: false,
                sua: false,
                xoa: false,
                inXuat: false,
            })),
        }
        const updatedRoles = [...roles, newRole]
        await dispatch(updateClinicCollectionAsync({ collectionKey: 'roles', items: updatedRoles }))
        setSelectedRole(newRole)
        setNewRoleName('')
        setNewRoleDesc('')
        AppToast.success(`Đã tạo vai trò mới: ${newRole.tenVaiTro}`)
    }

    const handleSaveStaff = async () => {
        if (!staffForm.hoTen?.trim()) {
            AppToast.error('Vui lòng nhập Họ tên nhân sự / Bác sĩ!')
            return
        }
        const exists = staffList.some((s) => s.id === staffForm.id && staffForm.id)
        const nextMa = exists ? staffForm.maNV : (staffForm.maNV || getNextStaffCode(staffList))
        const formWithCode = { ...staffForm, maNV: nextMa }
        const updated = exists
            ? staffList.map((s) => (s.id === staffForm.id ? { ...s, ...staffForm } : s))
            : [...staffList, { ...formWithCode, id: nextMa }]

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'staffList',
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_STAFF_CREDENTIAL' : 'CREATE_STAFF_CREDENTIAL',
                    doiTuong: `${formWithCode.hoTen} (${nextMa}) - CCHN: ${formWithCode.soCCHN} (${formWithCode.trangThaiCCHN})`,
                    mucDich: 'Quản lý nhân sự & Chứng chỉ hành nghề (INT-05)',
                },
            })
        )
        AppToast.success(exists ? 'Đã cập nhật hồ sơ nhân sự & CCHN!' : 'Đã thêm nhân sự mới thành công!')
    }

    return (
        <div className="space-y-3.5">
            {/* Top Mode Switcher */}
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link
                        to="/admin/phan-quyen"
                        className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                            !isStaffMode
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/15'
                        }`}
                    >
                        <ShieldCheck size={15} weight={!isStaffMode ? 'fill' : 'duotone'} />
                        <span>1. Phân quyền Vai trò (Ma trận 23 Quyền hạn)</span>
                    </Link>
                    <Link
                        to="/admin/nhan-vien"
                        className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                            isStaffMode
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/15'
                        }`}
                    >
                        <UserGear size={15} weight={isStaffMode ? 'fill' : 'duotone'} />
                        <span>2. Quản lý Nhân sự &amp; Chứng chỉ hành nghề (INT-05)</span>
                    </Link>
                </div>
                <span className="text-xs text-slate-500">
                    Phân hệ Video 09 &amp; INT-05: Phân quyền vai trò &amp; Kiểm soát điều kiện hành nghề Bác sĩ
                </span>
            </div>

            {!isStaffMode ? (
                /* ── VIEW 1: MA TRẬN 23 QUYỀN HẠN THEO VAI TRÒ (VIDEO 09) ── */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-4 medpro-card p-3.5 space-y-4">
                        <div className="medpro-section-title">
                            <span>DANH SÁCH VAI TRÒ ({roles.length})</span>
                        </div>

                        <div className="space-y-2">
                            {roles.map((r) => (
                                <div
                                    key={r.id}
                                    onClick={() => setSelectedRole({ ...r })}
                                    className={`p-3 rounded-xl border cursor-pointer transition ${
                                        selectedRole.id === r.id
                                            ? 'bg-[#E8F4FD] border-[#00B5F1] shadow-2xs'
                                            : 'bg-white border-slate-200 hover:border-[#00B5F1]/50'
                                    }`}
                                >
                                    <div className="font-display font-bold text-xs text-[#003553]">{r.tenVaiTro}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">{r.moTa}</div>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 rounded-xl bg-[#F8FBFE] border border-[#CBE9FA] space-y-2.5">
                            <div className="text-xs font-bold text-[#003553] uppercase">THÊM VAI TRÒ MỚI</div>
                            <input
                                type="text"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                placeholder="Tên vai trò (VD: Điều dưỡng trưởng)..."
                                className="medpro-input"
                            />
                            <input
                                type="text"
                                value={newRoleDesc}
                                onChange={(e) => setNewRoleDesc(e.target.value)}
                                placeholder="Mô tả phạm vi quyền hạn..."
                                className="medpro-input"
                            />
                            <button type="button" onClick={handleCreateRole} className="medpro-btn-primary w-full text-xs">
                                <Plus size={14} weight="bold" />
                                <span>Tạo vai trò mới</span>
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-8 medpro-card p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8F4FD]">
                            <div>
                                <h2 className="font-display font-extrabold text-base text-[#003553] uppercase">
                                    MA TRẬN PHÂN QUYỀN: {selectedRole.tenVaiTro}
                                </h2>
                                <p className="text-xs text-slate-500">{selectedRole.moTa}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleCheckAll(true)}
                                    className="medpro-btn-outline text-xs"
                                >
                                    <CheckCircle size={15} weight="duotone" className="text-[#00B5F1]" />
                                    <span>Chọn tất cả</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCheckAll(false)}
                                    className="medpro-btn-outline text-xs"
                                >
                                    <Broom size={15} weight="duotone" className="text-slate-500" />
                                    <span>Bỏ chọn tất cả</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveRolePermissions}
                                    className="medpro-btn-primary text-xs"
                                >
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu phân quyền vai trò</span>
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto max-h-[calc(100vh-230px)] border border-[#E5EEF5] rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Tên phân hệ / Quyền hạn nghiệp vụ (23 Module)</th>
                                        <th className="text-center">Xem</th>
                                        <th className="text-center">Thêm</th>
                                        <th className="text-center">Sửa</th>
                                        <th className="text-center">Xóa</th>
                                        <th className="text-center">In / Xuất</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissionModules.map((modName, idx) => {
                                        const perm = (selectedRole.permissions || [])[idx] || {
                                            stt: idx + 1,
                                            xem: false,
                                            them: false,
                                            sua: false,
                                            xoa: false,
                                            inXuat: false,
                                        }
                                        return (
                                            <tr key={idx}>
                                                <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                                <td className="font-semibold text-[#12263F]">{modName}</td>
                                                {['xem', 'them', 'sua', 'xoa', 'inXuat'].map((field) => (
                                                    <td key={field} className="text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(perm[field])}
                                                            onChange={() => handleTogglePermission(idx + 1, field)}
                                                            className="w-4 h-4 accent-[#00B5F1] cursor-pointer"
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── VIEW 2: QUẢN LÝ NHÂN VIÊN & CHỨNG CHỈ HÀNH NGHỀ (INT-05) ── */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-5 medpro-card p-3.5 flex flex-col">
                        <div className="medpro-section-title">
                            <span>DANH SÁCH NHÂN SỰ &amp; BÁC SĨ ({staffList.length})</span>
                        </div>
                        <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>Mã NV</th>
                                        <th>Họ tên</th>
                                        <th>Số CCHN</th>
                                        <th>Trạng thái CCHN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffList.map((s) => (
                                        <tr
                                            key={s.id}
                                            onClick={() => setStaffForm({ ...s })}
                                            className={`cursor-pointer ${
                                                staffForm.id === s.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                            }`}
                                        >
                                            <td className="font-mono font-bold text-[#00B5F1]">{s.maNV}</td>
                                            <td className="font-semibold text-[#12263F]">{s.hoTen}</td>
                                            <td className="font-mono text-xs">{s.soCCHN}</td>
                                            <td>
                                                <StatusBadge status={s.trangThaiCCHN} compact />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-7 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F4FD] pb-3">
                            <div>
                                <h2 className="font-display font-extrabold text-base text-[#003553] uppercase">
                                    HỒ SƠ NHÂN SỰ &amp; CHỨNG CHỈ HÀNH NGHỀ Y TẾ (INT-05)
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Theo Luật KCB 15/2023/QH15 &amp; NĐ 96/2023/NĐ-CP: Hệ thống tự động chặn phân công nếu CCHN hết hạn
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextMa = getNextStaffCode(staffList)
                                        setStaffForm({
                                            id: '',
                                            maNV: nextMa,
                                            hoTen: '',
                                            taiKhoan: '',
                                            dienThoai: '',
                                            vaiTro: staffRoleOptions[1],
                                            khoaPhong: khoaPhongList[0]?.tenPhong || defaults.defaultClinicRoom,
                                            chuyenKhoa: defaults.defaultSpecialty,
                                            soCCHN: '',
                                            ngayCapCCHN: '2022-01-01',
                                            ngayHetHanCCHN: '2029-01-01',
                                            trangThaiCCHN: 'ACTIVE',
                                            trangThai: true,
                                        })
                                    }}
                                    className="medpro-btn-outline text-xs"
                                >
                                    <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                                    <span>Thêm nhân sự</span>
                                </button>
                                <button type="button" onClick={handleSaveStaff} className="medpro-btn-primary text-xs">
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu hồ sơ &amp; CCHN</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã nhân viên</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={staffForm.maNV || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                                    title="Mã nhân viên do hệ thống tự sinh theo chuẩn NVxxx, không thể chỉnh sửa"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Họ tên &amp; Học hàm/Học vị *</label>
                                <input
                                    type="text"
                                    value={staffForm.hoTen || ''}
                                    onChange={(e) => setStaffForm({ ...staffForm, hoTen: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Tài khoản đăng nhập</label>
                                <input
                                    type="text"
                                    value={staffForm.taiKhoan || ''}
                                    onChange={(e) => setStaffForm({ ...staffForm, taiKhoan: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Số điện thoại</label>
                                <input
                                    type="text"
                                    value={staffForm.dienThoai || ''}
                                    onChange={(e) => setStaffForm({ ...staffForm, dienThoai: e.target.value })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Vai trò phân quyền</label>
                                <select
                                    value={staffForm.vaiTro || staffRoleOptions[1]}
                                    onChange={(e) => setStaffForm({ ...staffForm, vaiTro: e.target.value })}
                                    className="medpro-input font-semibold"
                                >
                                    {staffRoleOptions.map((ro) => (
                                        <option key={ro} value={ro}>
                                            {ro}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Số Chứng chỉ hành nghề (CCHN)</label>
                                <input
                                    type="text"
                                    value={staffForm.soCCHN || ''}
                                    onChange={(e) => setStaffForm({ ...staffForm, soCCHN: e.target.value })}
                                    className="medpro-input font-mono font-bold text-[#00B5F1]"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Ngày hết hạn CCHN</label>
                                <input
                                    type="date"
                                    value={staffForm.ngayHetHanCCHN || ''}
                                    onChange={(e) => setStaffForm({ ...staffForm, ngayHetHanCCHN: e.target.value })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Trạng thái pháp lý CCHN (INT-05)</label>
                                <select
                                    value={staffForm.trangThaiCCHN || 'ACTIVE'}
                                    onChange={(e) => setStaffForm({ ...staffForm, trangThaiCCHN: e.target.value })}
                                    className="medpro-input font-bold"
                                >
                                    {licenseStatuses.map((ls) => (
                                        <option key={ls.code} value={ls.code}>
                                            {ls.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-3">
                                <label className="medpro-label">Phạm vi hoạt động chuyên môn được cấp phép</label>
                                <input
                                    type="text"
                                    value={staffForm.chuyenKhoa || ''}
                                    onChange={(e) => setStaffForm({ ...staffForm, chuyenKhoa: e.target.value })}
                                    className="medpro-input font-semibold text-[#003553]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
