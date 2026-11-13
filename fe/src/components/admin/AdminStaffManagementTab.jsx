import { useCallback, useEffect, useState } from 'react'
import { AppToast } from '../common/AppNotification'
import { adminService } from '../../services/admin/AdminService'
import { medicalCatalogService } from '../../services/user/MedicalCatalogService'

const EMPTY_FORM = {
    ma_nhan_vien: '',
    ho_ten: '',
    email: '',
    so_dien_thoai: '',
    chuc_danh: '',
    loai_nhan_vien: 'LE_TAN',
}

const STAFF_TYPES = [
    { value: 'LE_TAN', label: 'Lễ tân' },
    { value: 'THU_NGAN', label: 'Thu ngân' },
    { value: 'KY_THUAT_VIEN', label: 'Kỹ thuật viên' },
]
const EMPTY_DOCTOR_FORM = {
    ho_ten: '', email: '', so_dien_thoai: '', mat_khau: '', chuyen_khoa_id: '',
    hoc_vi: 'BS', chung_chi_hanh_nghe: '', ngay_cap: '', ngay_het_han: '',
    pham_vi_chuyen_mon: '', trang_thai_giay_phep: 'ACTIVE', nam_kinh_nghiem: 0,
}

const typeLabel = (value) => STAFF_TYPES.find((item) => item.value === value)?.label || value

export default function AdminStaffManagementTab() {
    const [staff, setStaff] = useState([])
    const [doctors, setDoctors] = useState([])
    const [form, setForm] = useState(EMPTY_FORM)
    const [editingId, setEditingId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [editingDoctor, setEditingDoctor] = useState(null)
    const [doctorLicense, setDoctorLicense] = useState({})
    const [specialties, setSpecialties] = useState([])
    const [showDoctorForm, setShowDoctorForm] = useState(false)
    const [doctorForm, setDoctorForm] = useState(EMPTY_DOCTOR_FORM)

    const loadStaff = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [staffResult, doctorResult, specialtyResult] = await Promise.all([
                adminService.getStaffAdmin(),
                adminService.getDoctorsAdmin(),
                medicalCatalogService.getSpecialties().catch(() => []),
            ])
            setStaff(Array.isArray(staffResult) ? staffResult : [])
            setDoctors(Array.isArray(doctorResult) ? doctorResult : [])
            setSpecialties(Array.isArray(specialtyResult) ? specialtyResult : [])
        } catch (loadError) {
            setError(loadError?.response?.data?.message || 'Không tải được danh sách nhân sự.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadStaff() }, [loadStaff])

    const startEdit = (employee) => {
        setEditingId(employee.id)
        setForm({
            ma_nhan_vien: employee.ma_nhan_vien || '',
            ho_ten: employee.ho_ten || '',
            email: employee.email || '',
            so_dien_thoai: employee.so_dien_thoai || '',
            chuc_danh: employee.chuc_danh || '',
            loai_nhan_vien: employee.loai_nhan_vien || 'LE_TAN',
        })
    }

    const resetForm = () => {
        setEditingId(null)
        setForm(EMPTY_FORM)
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setSaving(true)
        try {
            const payload = {
                ...form,
                email: form.email.trim() || null,
                so_dien_thoai: form.so_dien_thoai.trim() || null,
            }
            if (editingId) {
                const { ma_nhan_vien: _immutableCode, ...changes } = payload
                await adminService.updateStaffAdmin(editingId, changes)
                AppToast.success('Đã cập nhật hồ sơ nhân sự.')
            } else {
                await adminService.createStaffAdmin(payload)
                AppToast.success('Đã tạo hồ sơ nhân sự.')
            }
            resetForm()
            await loadStaff()
        } catch (saveError) {
            AppToast.error(saveError?.response?.data?.message || 'Không lưu được hồ sơ nhân sự.')
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (employee) => {
        try {
            await adminService.updateStaffAdmin(employee.id, { is_active: !employee.is_active })
            AppToast.success(employee.is_active ? 'Đã ngừng hoạt động hồ sơ nhân sự.' : 'Đã kích hoạt hồ sơ nhân sự.')
            await loadStaff()
        } catch (toggleError) {
            AppToast.error(toggleError?.response?.data?.message || 'Không cập nhật được trạng thái hồ sơ.')
        }
    }

    const accountAction = async (person, accountId, active) => {
        try {
            if (!accountId) {
                const password = window.prompt(`Tạo mật khẩu ban đầu cho ${person.ho_ten} (ít nhất 8 ký tự):`)
                if (password === null) return
                await adminService.createStaffAccountAdmin(person.id, password)
                AppToast.success('Đã tạo tài khoản đăng nhập.')
            } else if (active) {
                await adminService.updateAccountStatusAdmin(accountId, false)
                AppToast.success('Đã khóa tài khoản và thu hồi phiên hiện tại.')
            } else {
                await adminService.updateAccountStatusAdmin(accountId, true)
                AppToast.success('Đã mở khóa tài khoản.')
            }
            await loadStaff()
        } catch (actionError) {
            AppToast.error(actionError?.response?.data?.message || 'Không cập nhật được tài khoản.')
        }
    }

    const resetPassword = async (person, accountId) => {
        const password = window.prompt(`Nhập mật khẩu mới cho ${person.ho_ten} (ít nhất 8 ký tự):`)
        if (password === null) return
        try {
            await adminService.resetAccountPasswordAdmin(accountId, password)
            AppToast.success('Đã đổi mật khẩu và thu hồi phiên đăng nhập cũ.')
        } catch (actionError) {
            AppToast.error(actionError?.response?.data?.message || 'Không đặt lại được mật khẩu.')
        }
    }

    const saveDoctorLicense = async (event) => {
        event.preventDefault()
        try {
            const payload = {
                ...doctorLicense,
                ngay_cap: doctorLicense.ngay_cap || null,
                ngay_het_han: doctorLicense.ngay_het_han || null,
                pham_vi_chuyen_mon: String(doctorLicense.pham_vi_chuyen_mon || '')
                    .split(',')
                    .map((scope) => scope.trim())
                    .filter(Boolean),
            }
            await adminService.updateDoctorAdmin(editingDoctor.id, payload)
            AppToast.success('Đã cập nhật CCHN và hồ sơ chuyên môn bác sĩ.')
            setEditingDoctor(null)
            await loadStaff()
        } catch (saveError) {
            AppToast.error(saveError?.response?.data?.message || 'Không lưu được hồ sơ bác sĩ.')
        }
    }

    const createDoctor = async (event) => {
        event.preventDefault()
        try {
            const payload = {
                ...doctorForm,
                chuyen_khoa_id: Number(doctorForm.chuyen_khoa_id),
                ngay_cap: doctorForm.ngay_cap || null,
                ngay_het_han: doctorForm.ngay_het_han || null,
                nam_kinh_nghiem: Number(doctorForm.nam_kinh_nghiem || 0),
                pham_vi_chuyen_mon: String(doctorForm.pham_vi_chuyen_mon || '').split(',').map((scope) => scope.trim()).filter(Boolean),
            }
            await adminService.createDoctorAdmin(payload)
            AppToast.success('Đã tạo hồ sơ bác sĩ, CCHN và tài khoản trong hệ thống.')
            setDoctorForm(EMPTY_DOCTOR_FORM)
            setShowDoctorForm(false)
            await loadStaff()
        } catch (createError) {
            AppToast.error(createError?.response?.data?.message || 'Không tạo được hồ sơ bác sĩ.')
        }
    }

    return (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
            <section className="medpro-card p-3.5 xl:col-span-7">
                <div className="medpro-section-title mb-3">
                    <span>NHÂN VIÊN ({staff.length})</span>
                    <button type="button" onClick={loadStaff} className="text-xs font-bold text-sky-700">Làm mới</button>
                </div>
                {error && <div role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="medpro-table min-w-[900px]">
                        <thead><tr><th>Mã NV</th><th>Họ tên</th><th>Loại nhân sự</th><th>Tài khoản</th><th>Trạng thái hồ sơ</th><th>Thao tác</th></tr></thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="py-8 text-center text-slate-500">Đang tải hồ sơ nhân sự…</td></tr>
                            ) : staff.length === 0 ? (
                                <tr><td colSpan="6" className="py-8 text-center text-slate-500">Chưa có hồ sơ nhân sự thường.</td></tr>
                            ) : staff.map((employee) => (
                                <tr key={employee.id}>
                                    <td className="font-mono font-bold text-sky-700">{employee.ma_nhan_vien}</td>
                                    <td className="font-semibold">{employee.ho_ten}</td>
                                    <td>{typeLabel(employee.loai_nhan_vien)}</td>
                                    <td>{employee.account_id ? `${employee.account_role} · ${employee.account_active ? 'Hoạt động' : 'Đã khóa'}` : 'Chưa có'}</td>
                                    <td><span className={employee.is_active ? 'text-emerald-700' : 'text-slate-500'}>{employee.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td>
                                    <td>
                                        <div className="flex gap-2 whitespace-nowrap">
                                            <button type="button" onClick={() => startEdit(employee)} className="text-xs font-bold text-sky-700">Sửa</button>
                                            <button type="button" onClick={() => toggleActive(employee)} className="text-xs font-bold text-amber-700">{employee.is_active ? 'Ngừng' : 'Kích hoạt'}</button>
                                            <button type="button" onClick={() => accountAction(employee, employee.account_id, employee.account_active)} className="text-xs font-bold text-violet-700">{employee.account_id ? employee.account_active ? 'Khóa TK' : 'Mở TK' : 'Tạo TK'}</button>
                                            {employee.account_id && <button type="button" onClick={() => resetPassword(employee, employee.account_id)} className="text-xs font-bold text-slate-700">Đặt lại MK</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="medpro-card p-3.5 xl:col-span-7">
                <div className="medpro-section-title mb-3">
                    <span>BÁC SĨ &amp; CHỨNG CHỈ HÀNH NGHỀ ({doctors.length})</span>
                    <button type="button" onClick={() => setShowDoctorForm((visible) => !visible)} className="text-xs font-bold text-sky-700">{showDoctorForm ? 'Đóng form' : '+ Thêm bác sĩ'}</button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="medpro-table min-w-[900px]">
                        <thead><tr><th>Bác sĩ</th><th>Chuyên khoa</th><th>Số CCHN</th><th>Hiệu lực CCHN</th><th>Tài khoản</th><th>Thao tác</th></tr></thead>
                        <tbody>{loading ? <tr><td colSpan="6" className="py-6 text-center">Đang tải…</td></tr> : doctors.length === 0 ? <tr><td colSpan="6" className="py-6 text-center text-slate-500">Chưa có hồ sơ bác sĩ trong CSDL.</td></tr> : doctors.map((doctor) => (
                            <tr key={doctor.id}>
                                <td className="font-semibold">{doctor.ho_ten}<div className="text-xs text-slate-500">{doctor.hoc_vi}</div></td>
                                <td>{doctor.ten_chuyen_khoa || '—'}</td>
                                <td>{doctor.chung_chi_hanh_nghe}</td>
                                <td>{doctor.trang_thai_giay_phep}{doctor.ngay_het_han ? ` · đến ${doctor.ngay_het_han}` : ' · chưa khai ngày hết hạn'}</td>
                                <td>{doctor.account_id ? `${doctor.account_active ? 'Hoạt động' : 'Đã khóa'} (${doctor.account_role})` : 'Chưa có'}</td>
                                <td><div className="flex gap-2 whitespace-nowrap">
                                    <button type="button" onClick={() => { setEditingDoctor(doctor); setDoctorLicense({ chung_chi_hanh_nghe: doctor.chung_chi_hanh_nghe || '', ngay_cap: doctor.ngay_cap || '', ngay_het_han: doctor.ngay_het_han || '', trang_thai_giay_phep: doctor.trang_thai_giay_phep || 'ACTIVE', pham_vi_chuyen_mon: (doctor.pham_vi_chuyen_mon || []).join(', '), is_active: doctor.is_active }) }} className="text-xs font-bold text-sky-700">Sửa CCHN</button>
                                    {doctor.account_id && <button type="button" onClick={() => accountAction(doctor, doctor.account_id, doctor.account_active)} className="text-xs font-bold text-amber-700">{doctor.account_active ? 'Khóa TK' : 'Mở TK'}</button>}
                                    {doctor.account_id && <button type="button" onClick={() => resetPassword(doctor, doctor.account_id)} className="text-xs font-bold text-slate-700">Đặt lại MK</button>}
                                </div></td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
                {showDoctorForm && <form onSubmit={createDoctor} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2 font-bold text-[#003553]">Tạo hồ sơ bác sĩ, CCHN và tài khoản đăng nhập</div>
                    <label><span className="medpro-label">Họ tên *</span><input required minLength={2} className="medpro-input" value={doctorForm.ho_ten} onChange={(e) => setDoctorForm({ ...doctorForm, ho_ten: e.target.value })} /></label>
                    <label><span className="medpro-label">Email đăng nhập *</span><input required type="email" className="medpro-input" value={doctorForm.email} onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })} /></label>
                    <label><span className="medpro-label">Số điện thoại *</span><input required type="tel" pattern="[0-9]{10,11}" className="medpro-input" value={doctorForm.so_dien_thoai} onChange={(e) => setDoctorForm({ ...doctorForm, so_dien_thoai: e.target.value })} /></label>
                    <label><span className="medpro-label">Mật khẩu ban đầu *</span><input required type="password" minLength={8} maxLength={72} className="medpro-input" value={doctorForm.mat_khau} onChange={(e) => setDoctorForm({ ...doctorForm, mat_khau: e.target.value })} /></label>
                    <label><span className="medpro-label">Chuyên khoa *</span><select required className="medpro-input" value={doctorForm.chuyen_khoa_id} onChange={(e) => setDoctorForm({ ...doctorForm, chuyen_khoa_id: e.target.value })}><option value="">Chọn chuyên khoa</option>{specialties.map((item) => <option key={item.realId} value={item.realId}>{item.name}</option>)}</select></label>
                    <label><span className="medpro-label">Học vị</span><input className="medpro-input" value={doctorForm.hoc_vi} onChange={(e) => setDoctorForm({ ...doctorForm, hoc_vi: e.target.value })} /></label>
                    <label><span className="medpro-label">Số CCHN *</span><input required minLength={2} className="medpro-input" value={doctorForm.chung_chi_hanh_nghe} onChange={(e) => setDoctorForm({ ...doctorForm, chung_chi_hanh_nghe: e.target.value })} /></label>
                    <label><span className="medpro-label">Trạng thái CCHN</span><select className="medpro-input" value={doctorForm.trang_thai_giay_phep} onChange={(e) => setDoctorForm({ ...doctorForm, trang_thai_giay_phep: e.target.value })}><option value="ACTIVE">Đủ điều kiện hành nghề</option><option value="EXPIRING_SOON">Sắp hết hạn</option><option value="EXPIRED">Hết hạn</option><option value="SUSPENDED">Đình chỉ</option></select></label>
                    <label><span className="medpro-label">Ngày cấp CCHN</span><input type="date" className="medpro-input" value={doctorForm.ngay_cap} onChange={(e) => setDoctorForm({ ...doctorForm, ngay_cap: e.target.value })} /></label>
                    <label><span className="medpro-label">Ngày hết hạn CCHN</span><input type="date" className="medpro-input" value={doctorForm.ngay_het_han} onChange={(e) => setDoctorForm({ ...doctorForm, ngay_het_han: e.target.value })} /></label>
                    <label><span className="medpro-label">Số năm kinh nghiệm</span><input type="number" min="0" className="medpro-input" value={doctorForm.nam_kinh_nghiem} onChange={(e) => setDoctorForm({ ...doctorForm, nam_kinh_nghiem: e.target.value })} /></label>
                    <label className="md:col-span-2"><span className="medpro-label">Phạm vi chuyên môn (phân tách bằng dấu phẩy)</span><input className="medpro-input" value={doctorForm.pham_vi_chuyen_mon} onChange={(e) => setDoctorForm({ ...doctorForm, pham_vi_chuyen_mon: e.target.value })} /></label>
                    <div className="md:col-span-2 flex justify-end"><button type="submit" className="medpro-btn-primary text-xs">Tạo hồ sơ bác sĩ</button></div>
                </form>}
                {editingDoctor && <form onSubmit={saveDoctorLicense} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2 font-bold text-[#003553]">Cập nhật CCHN: {editingDoctor.ho_ten}</div>
                    <label><span className="medpro-label">Số CCHN</span><input required className="medpro-input" value={doctorLicense.chung_chi_hanh_nghe} onChange={(e) => setDoctorLicense({ ...doctorLicense, chung_chi_hanh_nghe: e.target.value })} /></label>
                    <label><span className="medpro-label">Trạng thái pháp lý</span><select className="medpro-input" value={doctorLicense.trang_thai_giay_phep} onChange={(e) => setDoctorLicense({ ...doctorLicense, trang_thai_giay_phep: e.target.value })}><option value="ACTIVE">Đủ điều kiện</option><option value="EXPIRING_SOON">Sắp hết hạn</option><option value="EXPIRED">Hết hạn</option><option value="SUSPENDED">Đình chỉ</option></select></label>
                    <label><span className="medpro-label">Ngày cấp</span><input type="date" className="medpro-input" value={doctorLicense.ngay_cap || ''} onChange={(e) => setDoctorLicense({ ...doctorLicense, ngay_cap: e.target.value || null })} /></label>
                    <label><span className="medpro-label">Ngày hết hạn</span><input type="date" className="medpro-input" value={doctorLicense.ngay_het_han || ''} onChange={(e) => setDoctorLicense({ ...doctorLicense, ngay_het_han: e.target.value || null })} /></label>
                    <label className="md:col-span-2"><span className="medpro-label">Phạm vi chuyên môn (phân tách bằng dấu phẩy)</span><input className="medpro-input" value={doctorLicense.pham_vi_chuyen_mon || ''} onChange={(e) => setDoctorLicense({ ...doctorLicense, pham_vi_chuyen_mon: e.target.value })} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={doctorLicense.is_active} onChange={(e) => setDoctorLicense({ ...doctorLicense, is_active: e.target.checked })} /> Được nhận lịch khám</label>
                    <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingDoctor(null)} className="medpro-btn-outline text-xs">Hủy</button><button className="medpro-btn-primary text-xs">Lưu CCHN</button></div>
                </form>}
            </section>

            <section className="medpro-card p-4 xl:col-span-5">
                <div className="mb-3 border-b border-slate-100 pb-3">
                    <h2 className="font-display text-sm font-extrabold text-[#003553]">{editingId ? 'CẬP NHẬT HỒ SƠ NHÂN SỰ' : 'THÊM HỒ SƠ NHÂN SỰ'}</h2>
                    <p className="mt-1 text-xs text-slate-500">Thông tin hồ sơ được lưu vào hệ thống. Tài khoản đăng nhập và phân quyền được cấu hình riêng.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <label className="block"><span className="medpro-label">Mã nhân viên *</span><input required minLength={2} maxLength={50} pattern="[A-Za-z0-9_-]+" className="medpro-input font-mono" value={form.ma_nhan_vien} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, ma_nhan_vien: e.target.value })} /></label>
                    <label className="block"><span className="medpro-label">Họ tên *</span><input required minLength={2} maxLength={150} className="medpro-input" value={form.ho_ten} onChange={(e) => setForm({ ...form, ho_ten: e.target.value })} /></label>
                    <label className="block"><span className="medpro-label">Loại nhân sự *</span><select className="medpro-input" value={form.loai_nhan_vien} onChange={(e) => setForm({ ...form, loai_nhan_vien: e.target.value })}>{STAFF_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                    <label className="block"><span className="medpro-label">Chức danh *</span><input required minLength={2} maxLength={50} className="medpro-input" value={form.chuc_danh} onChange={(e) => setForm({ ...form, chuc_danh: e.target.value })} /></label>
                    <label className="block"><span className="medpro-label">Email</span><input type="email" className="medpro-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                    <label className="block"><span className="medpro-label">Số điện thoại</span><input type="tel" inputMode="numeric" pattern="[0-9]{10,11}" className="medpro-input" value={form.so_dien_thoai} onChange={(e) => setForm({ ...form, so_dien_thoai: e.target.value })} placeholder="10–11 chữ số" /></label>
                    <div className="flex justify-end gap-2 pt-2">
                        {editingId && <button type="button" onClick={resetForm} className="medpro-btn-outline text-xs">Hủy sửa</button>}
                        <button type="submit" disabled={saving} className="medpro-btn-primary text-xs">{saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Thêm nhân sự'}</button>
                    </div>
                </form>
            </section>
        </div>
    )
}
