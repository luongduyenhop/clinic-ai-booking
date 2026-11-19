import { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import DoctorLeaveManagementTab from '../../components/admin/DoctorLeaveManagementTab'
import DoctorScheduleManagementTab from '../../components/admin/DoctorScheduleManagementTab'
import AdminStaffManagementTab from '../../components/admin/AdminStaffManagementTab'
import { AppToast } from '../../components/common/AppNotification'
import { adminService } from '../../services/admin/AdminService'
import { PERMISSION_MODULES_23, getPermissionModuleLabel } from '../../utils/helpers/clinicConfigHelpers'
import {
    ShieldCheck,
    UserGear,
    FloppyDisk,
    CheckCircle,
    Broom,
    CalendarCheck,
    CalendarPlus,
} from '../../components/common/ClinicIcon'

export default function RolePermissionPage() {
    const location = useLocation()
    const searchParams = new URLSearchParams(location.search)
    const isLeaveMode = searchParams.get('tab') === 'nghi-phep' || location.pathname.includes('nghi-phep')
    const isScheduleMode = searchParams.get('tab') === 'phan-lich' || location.pathname.includes('phan-lich') || location.pathname.includes('lich-lam-viec')
    const isStaffMode = !isLeaveMode && !isScheduleMode && (location.pathname.includes('nhan-vien') || searchParams.get('tab') === 'nhan-vien')

    const [roles, setRoles] = useState([])
    const [rbacLoading, setRbacLoading] = useState(false)
    const [rbacError, setRbacError] = useState('')
    const permissionModules = PERMISSION_MODULES_23

    const [selectedRole, setSelectedRole] = useState({})

    const roleFromDb = (role) => ({
        id: role.ma_vai_tro,
        maVaiTro: role.ma_vai_tro,
        tenVaiTro: role.ten_vai_tro,
        moTa: role.mo_ta,
        permissions: permissionModules.map((module, index) => {
            const codes = new Set(role.permission_codes || [])
            return {
                stt: index + 1,
                xem: codes.has(`${module.maPhanHe}.view`),
                them: codes.has(`${module.maPhanHe}.create`),
                sua: codes.has(`${module.maPhanHe}.update`),
                xoa: codes.has(`${module.maPhanHe}.delete`),
                inXuat: codes.has(`${module.maPhanHe}.export`),
            }
        }),
    })

    const loadRoles = async () => {
        setRbacLoading(true)
        setRbacError('')
        try {
            const data = await adminService.getRBACRolesAdmin()
            const mapped = data.map(roleFromDb)
            setRoles(mapped)
            setSelectedRole((current) => mapped.find((role) => role.id === current.id) || mapped[0] || {})
        } catch (error) {
            setRbacError(error?.response?.data?.message || 'Không tải được ma trận phân quyền từ backend.')
        } finally {
            setRbacLoading(false)
        }
    }

    useEffect(() => { loadRoles() }, [])

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
        try {
            const actionNames = { xem: 'view', them: 'create', sua: 'update', xoa: 'delete', inXuat: 'export' }
            const permission_codes = (selectedRole.permissions || []).flatMap((permission, index) =>
                Object.entries(actionNames).filter(([key]) => permission[key]).map(([, action]) => `${permissionModules[index].maPhanHe}.${action}`)
            )
            const updated = await adminService.updateRBACRolePermissionsAdmin(selectedRole.maVaiTro, permission_codes)
            const mapped = roles.map((role) => role.id === selectedRole.id ? roleFromDb(updated) : role)
            setRoles(mapped)
            setSelectedRole(roleFromDb(updated))
            AppToast.success(`Đã lưu ma trận quyền ${selectedRole.tenVaiTro} vào PostgreSQL.`)
        } catch (error) {
            AppToast.error(error?.response?.data?.message || 'Không lưu được ma trận quyền.')
        }
    }

    return (
        <div className="space-y-3.5">
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
                    <Link
                        to="/admin/phan-quyen"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors ${
                            !isStaffMode && !isLeaveMode && !isScheduleMode
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <ShieldCheck size={14} weight={!isStaffMode && !isLeaveMode && !isScheduleMode ? 'fill' : 'duotone'} />
                        <span>1. Ma trận Phân quyền (23 Module)</span>
                    </Link>
                    <Link
                        to="/admin/nhan-vien"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors ${
                            isStaffMode
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <UserGear size={14} weight={isStaffMode ? 'fill' : 'duotone'} />
                        <span>2. Nhân sự &amp; Chứng chỉ CCHN</span>
                    </Link>
                    <Link
                        to="/admin/nhan-vien?tab=phan-lich"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors ${
                            isScheduleMode
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <CalendarPlus size={14} weight={isScheduleMode ? 'fill' : 'duotone'} />
                        <span>3. Phân lịch trực &amp; Ca khám</span>
                    </Link>
                    <Link
                        to="/admin/nhan-vien?tab=nghi-phep"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors ${
                            isLeaveMode
                                ? 'bg-clinic-navy text-clinic-surface'
                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                        }`}
                    >
                        <CalendarCheck size={14} weight={isLeaveMode ? 'fill' : 'duotone'} />
                        <span>4. Duyệt Nghỉ phép &amp; Điều phối</span>
                    </Link>
                </div>
                <span className="text-xs text-clinic-text-secondary">
                    {isScheduleMode
                        ? 'Phân ca làm việc bác sĩ theo tuần, công suất slot và buồng khám'
                        : isLeaveMode
                        ? 'Phê duyệt đơn nghỉ phép, tự động khóa lịch trực và điều chuyển lịch khám'
                        : 'Quản trị vai trò, quyền hạn truy cập và kiểm soát điều kiện hành nghề'}
                </span>
            </div>

            {isStaffMode ? (
                <AdminStaffManagementTab />
            ) : isScheduleMode ? (
                <DoctorScheduleManagementTab />
            ) : isLeaveMode ? (
                <DoctorLeaveManagementTab />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-4 medpro-card p-3.5 space-y-3">
                        <div className="medpro-section-title">
                            <span>DANH SÁCH VAI TRÒ ({roles.length})</span>
                            <button type="button" onClick={loadRoles} className="text-xs font-bold text-clinic-cta hover:underline cursor-pointer">
                                Làm mới
                            </button>
                        </div>

                        {rbacError && (
                            <div role="alert" className="rounded-[6px] bg-clinic-danger-bg border border-clinic-danger-border p-3 text-xs font-medium text-clinic-danger">
                                {rbacError}
                            </div>
                        )}
                        {rbacLoading && <div className="text-xs text-clinic-text-muted">Đang tải vai trò từ hệ thống...</div>}

                        <div className="space-y-2">
                            {roles.map((r) => (
                                <div
                                    key={r.id}
                                    onClick={() => setSelectedRole({ ...r })}
                                    className={`p-3 rounded-[6px] border cursor-pointer transition-colors ${
                                        selectedRole.id === r.id
                                            ? 'bg-clinic-surface-alt border-clinic-cta'
                                            : 'bg-clinic-surface border-clinic-border hover:border-clinic-cta'
                                    }`}
                                >
                                    <div className="font-display font-bold text-xs text-clinic-navy">{r.tenVaiTro}</div>
                                    <div className="text-[11px] text-clinic-text-secondary mt-0.5">{r.moTa}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-8 medpro-card p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-clinic-border">
                            <div>
                                <h2 className="font-display font-extrabold text-sm text-clinic-navy uppercase">
                                    Ma trận phân quyền: {selectedRole.tenVaiTro}
                                </h2>
                                <p className="text-xs text-clinic-text-secondary">{selectedRole.moTa}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleCheckAll(true)}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    <CheckCircle size={14} weight="duotone" className="text-clinic-cta" />
                                    <span>Chọn tất cả</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCheckAll(false)}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    <Broom size={14} weight="duotone" className="text-clinic-text-muted" />
                                    <span>Bỏ chọn tất cả</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveRolePermissions}
                                    disabled={!selectedRole.id || selectedRole.maVaiTro === 'admin' || rbacLoading}
                                    className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                                >
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu phân quyền vai trò</span>
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto max-h-[calc(100vh-230px)] border border-clinic-border rounded-[6px]">
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
                                            <tr key={modName.maPhanHe || idx}>
                                                <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                                <td className="font-semibold text-clinic-navy">{getPermissionModuleLabel(modName, idx)}</td>
                                                {['xem', 'them', 'sua', 'xoa', 'inXuat'].map((field) => (
                                                    <td key={field} className="text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(perm[field])}
                                                            onChange={() => handleTogglePermission(idx + 1, field)}
                                                            className="w-4 h-4 cursor-pointer"
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
            )}
        </div>
    )
}
