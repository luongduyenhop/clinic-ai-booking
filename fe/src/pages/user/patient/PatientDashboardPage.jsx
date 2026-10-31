import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import AppointmentCard from '../../../components/user/patient/AppointmentCard'
import { PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import {
    CalendarCheck,
    CalendarPlus,
    ClipboardText,
    Microscope,
    Pill,
    Users,
    MagnifyingGlass,
} from '../../../components/common/ClinicIcon'
import { fetchPatientPortalAsync } from '../../../redux/actions/user/patientPortalAction'
import { patientPortalService } from '../../../services/user/PatientPortalService'
import { AppToast } from '../../../components/common/AppNotification'
import VietQrModal from '../../../components/common/VietQrModal'
import { QrCode } from '@phosphor-icons/react'

export default function PatientDashboardPage() {
    const dispatch = useDispatch()
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)

    const [lookupQuery, setLookupQuery] = useState('')
    const [isQrModalOpen, setIsQrModalOpen] = useState(false)
    const [lookupResults, setLookupResults] = useState(null)
    const [showAddFamily, setShowAddFamily] = useState(false)
    const [newMember, setNewMember] = useState({
        ho_ten: '',
        moi_quan_he: 'Con cái',
        ngay_sinh: '2015-05-10',
        gioi_tinh: 'Nam',
        so_dien_thoai: '',
    })

    if (portalLoading) return <PatientLoading />
    if (portalError) return <PatientError message={portalError} onRetry={() => dispatch(fetchPatientPortalAsync())} />

    const upcoming = portalData.appointments
        .filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status))
        .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))[0]

    const familyList = portalData.familyMembers || []

    const cards = [
        { label: 'Lịch hẹn', value: portalData.appointments.length, icon: CalendarCheck, to: '/benh-nhan/lich-hen' },
        { label: 'Lần khám', value: portalData.medicalHistory.length, icon: ClipboardText, to: '/benh-nhan/lich-su-kham' },
        { label: 'Đơn thuốc', value: portalData.prescriptions.length, icon: Pill, to: '/benh-nhan/don-thuoc' },
        { label: 'Kết quả CLS', value: portalData.labResults.length, icon: Microscope, to: '/benh-nhan/ket-qua-can-lam-sang' },
    ]

    const handleFindLostCode = async (e) => {
        e.preventDefault()
        if (!lookupQuery.trim()) return
        const found = await patientPortalService.findLostPatientCode(lookupQuery)
        setLookupResults(found)
        if (found.length) {
            AppToast.success(`Tìm thấy ${found.length} hồ sơ bệnh nhân khớp thông tin!`)
        } else {
            AppToast.warning('Không tìm thấy mã hồ sơ nào khớp với SĐT / CCCD vừa nhập.')
        }
    }

    const handleAddFamilyMember = async (e) => {
        e.preventDefault()
        if (!newMember.ho_ten.trim()) {
            AppToast.error('Vui lòng nhập họ tên người thân!')
            return
        }
        await patientPortalService.addFamilyMember(newMember)
        AppToast.success(`Đã thêm hồ sơ người thân "${newMember.ho_ten}" vào Sổ sức khỏe gia đình!`)
        setNewMember({ ho_ten: '', moi_quan_he: 'Con cái', ngay_sinh: '2015-05-10', gioi_tinh: 'Nam', so_dien_thoai: '' })
        setShowAddFamily(false)
        dispatch(fetchPatientPortalAsync())
    }

    return (
        <>
            <PatientPageHeader
                title="Tổng quan sức khỏe & Hồ sơ gia đình"
                description="Theo dõi lịch khám, tra cứu mã bệnh nhân và quản lý sổ sức khỏe người thân của bạn."
                action={
                    <Link to="/dat-lich" className="medpro-btn-primary min-h-11">
                        <CalendarPlus size={18} />
                        Tạo lịch hẹn
                    </Link>
                }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ label, value, icon: Icon, to }) => (
                    <Link
                        key={label}
                        to={to}
                        className="medpro-card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-[#8DDBF7]"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F4FD] text-[#00B5F1]">
                            <Icon size={22} weight="duotone" />
                        </span>
                        <span>
                            <strong className="block font-display text-2xl text-[#003553]">{value}</strong>
                            <span className="text-xs text-slate-500">{label}</span>
                        </span>
                    </Link>
                ))}
            </div>

            {/* Thanh toán Viện phí Trực tuyến (VietQR - Lát cắt D) */}
            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-teal-50 to-indigo-50 border border-sky-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-[#003553] text-teal-300 flex items-center justify-center shrink-0 shadow-xs">
                        <QrCode size={22} weight="bold" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-display font-extrabold text-sm text-[#003553]">
                                THANH TOÁN VIỆN PHÍ &amp; ĐƠN THUỐC TRỰC TUYẾN (VIETQR)
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">
                                NAPAS 247
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                            Quét mã QR qua app ngân hàng bất kỳ để thanh toán viện phí thuận tiện, không cần chờ xếp hàng tại quầy.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="medpro-btn-primary text-xs px-4 py-2 shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                    <QrCode size={15} weight="bold" />
                    <span>Thanh toán VietQR (NAPAS 247)</span>
                </button>
            </div>

            <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-[#003553]">Lịch hẹn sắp tới</h2>
                    <Link to="/benh-nhan/lich-hen" className="text-xs font-bold text-[#008EC2] hover:underline">
                        Xem tất cả
                    </Link>
                </div>
                {upcoming ? (
                    <AppointmentCard appointment={upcoming} />
                ) : (
                    <div className="medpro-card p-6 text-center text-sm text-slate-500">
                        Bạn chưa có lịch hẹn sắp tới.
                    </div>
                )}
            </section>

            {/* Tích hợp từ TheDuckHospital: Hồ sơ Người thân (ho_so_nguoi_than) & Tìm Mã Bệnh Nhân Bị Mất */}
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
                {/* Cột 1: Sổ sức khỏe gia đình / Hồ sơ người thân */}
                <section className="medpro-card p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Users size={20} className="text-[#008EC2]" />
                                <h2 className="font-display font-bold text-[#003553]">
                                    Hồ sơ Người thân ({familyList.length})
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddFamily(!showAddFamily)}
                                className="text-xs font-bold text-[#008EC2] hover:underline cursor-pointer"
                            >
                                {showAddFamily ? 'Đóng form' : '+ Thêm hồ sơ người thân'}
                            </button>
                        </div>

                        {showAddFamily && (
                            <form
                                onSubmit={handleAddFamilyMember}
                                className="mb-4 p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2.5 text-xs"
                            >
                                <div className="font-bold text-[#003553]">Thêm thành viên vào Sổ sức khỏe gia đình</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Họ và tên người thân *"
                                        value={newMember.ho_ten}
                                        onChange={(e) => setNewMember({ ...newMember, ho_ten: e.target.value })}
                                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                                        required
                                    />
                                    <select
                                        value={newMember.moi_quan_he}
                                        onChange={(e) => setNewMember({ ...newMember, moi_quan_he: e.target.value })}
                                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                                    >
                                        <option value="Con cái">Con cái</option>
                                        <option value="Bố / Mẹ">Bố / Mẹ</option>
                                        <option value="Vợ / Chồng">Vợ / Chồng</option>
                                        <option value="Anh / Chị / Em">Anh / Chị / Em</option>
                                    </select>
                                    <input
                                        type="date"
                                        value={newMember.ngay_sinh}
                                        onChange={(e) => setNewMember({ ...newMember, ngay_sinh: e.target.value })}
                                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Số điện thoại liên hệ"
                                        value={newMember.so_dien_thoai}
                                        onChange={(e) => setNewMember({ ...newMember, so_dien_thoai: e.target.value })}
                                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button type="submit" className="medpro-btn-primary text-xs py-1.5 px-4">
                                        Lưu hồ sơ người thân
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="space-y-2.5">
                            {familyList.map((m) => (
                                <div
                                    key={m.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                                >
                                    <div>
                                        <div className="font-bold text-[#003553] text-sm">
                                            {m.ho_ten}{' '}
                                            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">
                                                {m.moi_quan_he}
                                            </span>
                                        </div>
                                        <div className="text-slate-500 mt-0.5">
                                            Mã BN: <strong className="font-mono text-slate-700">{m.ma_ho_so}</strong> ·
                                            Ngày sinh: {m.ngay_sinh}
                                        </div>
                                    </div>
                                    <Link
                                        to="/dat-lich"
                                        className="px-3 py-1.5 rounded-lg bg-[#E8F4FD] text-[#008EC2] font-bold hover:bg-sky-200 transition"
                                    >
                                        Đặt khám hộ
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Cột 2: Tra cứu lại Mã hồ sơ bệnh nhân bị quên (Kế thừa từ TheDuckHospital FindPatientIdPage) */}
                <section className="medpro-card p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <MagnifyingGlass size={20} className="text-[#008EC2]" />
                            <h2 className="font-display font-bold text-[#003553]">
                                Tìm lại Mã Hồ Sơ Bệnh Nhân bị quên
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            Nhập Số điện thoại, CCCD hoặc Họ tên để tra cứu nhanh Mã định danh Bệnh nhân (BN-xxxxx) phục
                            vụ đặt khám và tra cứu kết quả.
                        </p>

                        <form onSubmit={handleFindLostCode} className="flex gap-2 mb-3">
                            <input
                                type="text"
                                placeholder="Nhập SĐT (VD: 0901234567) hoặc CCCD / Họ tên..."
                                value={lookupQuery}
                                onChange={(e) => setLookupQuery(e.target.value)}
                                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#008EC2]"
                            />
                            <button type="submit" className="medpro-btn-primary text-xs px-4 py-2 shrink-0">
                                Tìm mã BN
                            </button>
                        </form>

                        {lookupResults !== null && (
                            <div className="space-y-2 mt-2">
                                {lookupResults.length > 0 ? (
                                    lookupResults.map((r, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-900">{r.ho_ten}</div>
                                                <div className="text-slate-500">
                                                    SĐT: {r.so_dien_thoai} · Ngày sinh: {r.ngay_sinh}
                                                </div>
                                            </div>
                                            <span className="px-3 py-1 rounded-lg bg-emerald-700 text-white font-mono font-bold">
                                                {r.ma_ho_so}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl">
                                        Không tìm thấy hồ sơ bệnh nhân nào khớp với từ khóa &ldquo;{lookupQuery}&rdquo;.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <Recent
                    title="Lần khám gần nhất"
                    empty="Chưa có lịch sử khám"
                    item={portalData.medicalHistory[0]}
                    to="/benh-nhan/lich-su-kham"
                    render={(item) => (
                        <>
                            <strong>{item.diagnosis}</strong>
                            <span>
                                {item.doctor} · {formatDate(item.date)}
                            </span>
                        </>
                    )}
                />
                <Recent
                    title="Kết quả mới nhất"
                    empty="Chưa có kết quả cận lâm sàng"
                    item={portalData.labResults[0]}
                    to="/benh-nhan/ket-qua-can-lam-sang"
                    render={(item) => (
                        <>
                            <strong>{item.name}</strong>
                            <span>{item.summary}</span>
                        </>
                    )}
                />
            </div>

            {/* Modal VietQR thanh toán viện phí (Lát cắt D) */}
            <VietQrModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                invoice={{
                    id: 9102,
                    ma_hoa_don: 'HD20261025-001',
                    thuc_thu: 385000,
                    ma_benh_nhan: 'BN-8821',
                    ten_benh_nhan: 'Nguyễn Văn Bệnh Nhân',
                }}
            />
        </>
    )
}

function Recent({ title, empty, item, to, render }) {
    return (
        <section className="medpro-card p-5">
            <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-[#003553]">{title}</h2>
                <Link to={to} className="text-xs font-bold text-[#008EC2]">
                    Chi tiết
                </Link>
            </div>
            {item ? (
                <div className="mt-4 grid gap-1 text-sm text-slate-600">{render(item)}</div>
            ) : (
                <p className="mt-4 text-sm text-slate-400">{empty}</p>
            )}
        </section>
    )
}

const formatDate = (value) => new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))
