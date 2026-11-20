import { useEffect, useState } from 'react'
import { patientPortalService } from '../../services/user/PatientPortalService'
import { AppToast } from '../../components/common/AppNotification'
import PatientPageHeader from '../../components/user/patient/PatientPageHeader'
import { PatientError, PatientLoading } from '../../components/user/patient/PatientPageState'
import { toFriendlyErrorMessage } from '../../utils/helpers/clientErrorHelper'

const emptyMember = {
    ho_ten: '',
    quan_he: 'CON',
    ngay_sinh: '',
    gioi_tinh: 'Nam',
    so_dien_thoai: '',
}

const personalFields = [
    ['ho_ten', 'Họ và tên'],
    ['ngay_sinh', 'Ngày sinh', 'date'],
    ['gioi_tinh', 'Giới tính'],
    ['dia_chi', 'Địa chỉ'],
    ['cccd_so', 'CCCD'],
    ['nhom_mau', 'Nhóm máu'],
    ['tien_su_benh', 'Tiền sử bệnh'],
    ['di_ung_thuoc', 'Dị ứng thuốc'],
]

const errorText = (error) =>
    toFriendlyErrorMessage(error, 'Chưa tải được thông tin hồ sơ. Bạn vui lòng thử lại sau.')

export default function PatientProfilePage() {
    const [profile, setProfile] = useState(null)
    const [family, setFamily] = useState([])
    const [member, setMember] = useState(emptyMember)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const [personal, relatives] = await Promise.all([
                patientPortalService.getProfile(),
                patientPortalService.getFamilyMembers(),
            ])
            setProfile(personal.data.data)
            setFamily(relatives.data.data || [])
        } catch (e) {
            setError(errorText(e))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const saveProfile = async (event) => {
        event.preventDefault()
        setSaving(true)
        try {
            const payload = Object.fromEntries(
                personalFields.map(([field]) => [field, profile[field] || null])
            )
            const res = await patientPortalService.updateProfile(payload)
            setProfile(res.data.data)
            AppToast.success('Đã cập nhật hồ sơ trên hệ thống')
        } catch (e) {
            AppToast.error(errorText(e))
        } finally {
            setSaving(false)
        }
    }

    const addMember = async (event) => {
        event.preventDefault()
        setSaving(true)
        try {
            await patientPortalService.addFamilyMember(member)
            const res = await patientPortalService.getFamilyMembers()
            setFamily(res.data.data || [])
            setMember(emptyMember)
            AppToast.success('Đã lưu người thân vào hệ thống')
        } catch (e) {
            AppToast.error(errorText(e))
        } finally {
            setSaving(false)
        }
    }

    const removeMember = async (id) => {
        if (!window.confirm('Xóa hồ sơ người thân này?')) return
        setSaving(true)
        try {
            await patientPortalService.deleteFamilyMember(id)
            setFamily((current) => current.filter((item) => item.id !== id))
            AppToast.success('Đã xóa hồ sơ người thân')
        } catch (e) {
            AppToast.error(errorText(e))
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <PatientLoading />
    if (error) return <PatientError message={error} onRetry={load} />

    return (
        <div className="space-y-6">
            <PatientPageHeader
                title="Hồ sơ sức khỏe của tôi"
                description="Quản lý thông tin hành chính cá nhân và danh sách thành viên trong gia đình."
            />

            <section className="medpro-card p-6">
                <p className="text-sm text-clinic-text-secondary mb-4 tabular-nums">
                    Mã định danh y tế:{' '}
                    <strong className="font-mono text-clinic-navy">{profile?.ma_dinh_danh_y_te}</strong>
                </p>
                <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
                    {personalFields.map(([key, label, type]) => (
                        <label key={key} className="text-sm font-semibold text-clinic-navy">
                            {label}
                            <input
                                className="medpro-input mt-1 tabular-nums"
                                type={type || 'text'}
                                value={profile?.[key] || ''}
                                onChange={(e) => setProfile((s) => ({ ...s, [key]: e.target.value }))}
                            />
                        </label>
                    ))}
                    <p className="sm:col-span-2 text-sm text-clinic-text-secondary tabular-nums">
                        Số điện thoại: {profile?.so_dien_thoai || 'Chưa cập nhật'} · Email:{' '}
                        {profile?.email || 'Chưa cập nhật'}
                    </p>
                    <button disabled={saving} className="medpro-btn-primary sm:col-span-2" type="submit">
                        {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
                    </button>
                </form>
            </section>

            <section className="medpro-card p-6 space-y-4">
                <h2 className="font-display text-xl font-bold text-clinic-navy tabular-nums">
                    Thành viên trong sổ gia đình ({family.length})
                </h2>
                {family.length === 0 && (
                    <p className="text-sm text-clinic-text-secondary">
                        Chưa có thành viên nào được khai báo.
                    </p>
                )}
                {family.length > 0 && (
                    <div className="divide-y divide-clinic-border">
                        {family.map((person) => (
                            <div
                                key={person.id}
                                className="flex items-center justify-between gap-2 py-3"
                            >
                                <span className="text-sm text-clinic-text tabular-nums">
                                    <strong className="text-clinic-navy">{person.ho_ten}</strong> ·{' '}
                                    {person.quan_he} · {person.ngay_sinh}
                                </span>
                                <button
                                    type="button"
                                    disabled={saving}
                                    className="text-sm font-semibold text-clinic-danger hover:underline cursor-pointer"
                                    onClick={() => removeMember(person.id)}
                                >
                                    Xóa
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <form onSubmit={addMember} className="grid gap-3 pt-2 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-clinic-navy">
                        Tên thành viên gia đình
                        <input
                            required
                            minLength={2}
                            className="medpro-input mt-1"
                            value={member.ho_ten}
                            onChange={(e) => setMember((s) => ({ ...s, ho_ten: e.target.value }))}
                        />
                    </label>
                    <label htmlFor="family-relation-select" className="text-sm font-semibold text-clinic-navy">
                        Quan hệ
                        <select
                            id="family-relation-select"
                            aria-label="Quan hệ thành viên"
                            className="medpro-input mt-1"
                            value={member.quan_he}
                            onChange={(e) => setMember((s) => ({ ...s, quan_he: e.target.value }))}
                        >
                            <option value="CON">Con</option>
                            <option value="CHA_ME">Cha/mẹ</option>
                            <option value="VO_CHONG">Vợ/chồng</option>
                            <option value="NGUOI_THAN">Người thân</option>
                        </select>
                    </label>
                    <label className="text-sm font-semibold text-clinic-navy">
                        Ngày sinh
                        <input
                            type="date"
                            required
                            className="medpro-input mt-1 tabular-nums"
                            value={member.ngay_sinh}
                            onChange={(e) => setMember((s) => ({ ...s, ngay_sinh: e.target.value }))}
                        />
                    </label>
                    <label htmlFor="family-gender-select" className="text-sm font-semibold text-clinic-navy">
                        Giới tính
                        <select
                            id="family-gender-select"
                            aria-label="Giới tính thành viên"
                            className="medpro-input mt-1"
                            value={member.gioi_tinh}
                            onChange={(e) => setMember((s) => ({ ...s, gioi_tinh: e.target.value }))}
                        >
                            <option>Nam</option>
                            <option>Nữ</option>
                            <option>Khác</option>
                        </select>
                    </label>
                    <button type="submit" disabled={saving} className="medpro-btn-primary sm:col-span-2">
                        {saving ? 'Đang lưu...' : 'Thêm thành viên'}
                    </button>
                </form>
            </section>
        </div>
    )
}
