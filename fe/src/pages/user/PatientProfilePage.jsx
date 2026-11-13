import { useEffect, useState } from 'react'
import { patientPortalService } from '../../services/user/PatientPortalService'
import { AppToast } from '../../components/common/AppNotification'

const emptyMember = { ho_ten: '', quan_he: 'CON', ngay_sinh: '', gioi_tinh: 'Nam', so_dien_thoai: '' }
const personalFields = [
  ['ho_ten', 'Họ và tên'], ['so_dien_thoai', 'Số điện thoại', 'tel'],
  ['ngay_sinh', 'Ngày sinh', 'date'], ['gioi_tinh', 'Giới tính'],
  ['dia_chi', 'Địa chỉ'], ['cccd_so', 'CCCD'], ['nhom_mau', 'Nhóm máu'],
  ['tien_su_benh', 'Tiền sử bệnh'], ['di_ung_thuoc', 'Dị ứng thuốc'],
]
const errorText = error => error.response?.data?.message || error.message || 'Có lỗi từ máy chủ'
export default function PatientProfilePage() {
  const [profile, setProfile] = useState(null)
  const [family, setFamily] = useState([])
  const [member, setMember] = useState(emptyMember)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try {
      const [personal, relatives] = await Promise.all([patientPortalService.getProfile(), patientPortalService.getFamilyMembers()])
      setProfile(personal.data.data)
      setFamily(relatives.data.data || [])
    } catch (e) { setError(errorText(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const saveProfile = async event => {
    event.preventDefault(); setSaving(true)
    try {
      const payload = Object.fromEntries(personalFields.map(([field]) => [
        field,
        typeof profile[field] === 'string' ? profile[field].trim() || null : profile[field] || null
      ]))
      const res = await patientPortalService.updateProfile(payload)
      setProfile(res.data.data); AppToast.success('Đã cập nhật hồ sơ trên hệ thống')
    } catch (e) { AppToast.error(errorText(e)) }
    finally { setSaving(false) }
  }
  const addMember = async event => {
    event.preventDefault(); setSaving(true)
    try {
      await patientPortalService.addFamilyMember(member)
      const res = await patientPortalService.getFamilyMembers()
      setFamily(res.data.data || []); setMember(emptyMember); AppToast.success('Đã lưu người thân vào hệ thống')
    } catch (e) { AppToast.error(errorText(e)) }
    finally { setSaving(false) }
  }
  const removeMember = async id => {
    if (!window.confirm('Xóa hồ sơ người thân này?')) return
    setSaving(true)
    try {
      await patientPortalService.deleteFamilyMember(id)
      setFamily(current => current.filter(item => item.id !== id))
      AppToast.success('Đã xóa hồ sơ người thân')
    } catch (e) { AppToast.error(errorText(e)) }
    finally { setSaving(false) }
  }
  if (loading) return <main className="public-container py-10">Đang tải hồ sơ bệnh nhân...</main>
  if (error) return <main className="public-container py-10 text-rose-600" role="alert">{error} <button type="button" onClick={load} className="underline">Thử lại</button></main>
  return <main className="public-container py-8 space-y-6">
    <h1 className="font-display text-2xl font-extrabold text-[#003553]">Hồ sơ sức khỏe của tôi</h1>
    <section className="medpro-card p-6">
      <p className="text-sm text-slate-500 mb-4">Mã định danh y tế: <strong>{profile?.ma_dinh_danh_y_te}</strong></p>
      <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
        {personalFields.map(([key, label, type]) => <label key={key} className="text-sm font-semibold text-slate-700">{label}
          <input className="medpro-input mt-1" type={type || 'text'} value={profile?.[key] || ''} onChange={e => setProfile(s => ({ ...s, [key]: e.target.value }))} />
        </label>)}
        <label className="text-sm font-semibold text-slate-700">Email tài khoản (chỉ đọc)
          <input className="medpro-input mt-1 bg-slate-50 text-slate-500 cursor-not-allowed" type="email" value={profile?.email || ''} readOnly disabled />
        </label>
        <p className="sm:col-span-2 text-xs text-slate-500">Email tài khoản được dùng để xác thực hệ thống, không thể chỉnh sửa.</p>
        <button disabled={saving} className="medpro-btn-primary sm:col-span-2" type="submit">{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
      </form>
    </section>
    <section className="medpro-card p-6 space-y-4">
      <h2 className="font-display text-xl font-bold text-[#003553]">Hồ sơ người thân ({family.length})</h2>
      {family.length === 0 && <p className="text-sm text-slate-500">Chưa có hồ sơ người thân.</p>}
      {family.map(person => <div key={person.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-3">
        <span className="text-sm"><strong>{person.ho_ten}</strong> · {person.quan_he} · {person.ngay_sinh}</span>
        <button type="button" disabled={saving} className="text-sm text-rose-600 underline" onClick={() => removeMember(person.id)}>Xóa</button>
      </div>)}
      <form onSubmit={addMember} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Họ tên người thân<input required minLength={2} className="medpro-input mt-1" value={member.ho_ten} onChange={e => setMember(s => ({...s, ho_ten: e.target.value}))}/></label>
        <label className="text-sm">Quan hệ<select className="medpro-input mt-1" value={member.quan_he} onChange={e => setMember(s => ({...s, quan_he: e.target.value}))}><option value="CON">Con</option><option value="CHA_ME">Cha/mẹ</option><option value="VO_CHONG">Vợ/chồng</option><option value="NGUOI_THAN">Người thân</option></select></label>
        <label className="text-sm">Ngày sinh<input type="date" required className="medpro-input mt-1" value={member.ngay_sinh} onChange={e => setMember(s => ({...s, ngay_sinh: e.target.value}))}/></label>
        <label className="text-sm">Giới tính<select className="medpro-input mt-1" value={member.gioi_tinh} onChange={e => setMember(s => ({...s, gioi_tinh: e.target.value}))}><option>Nam</option><option>Nữ</option><option>Khác</option></select></label>
        <button type="submit" disabled={saving} className="medpro-btn-primary sm:col-span-2">{saving ? 'Đang lưu...' : 'Thêm người thân'}</button>
      </form>
    </section>
  </main>
}
