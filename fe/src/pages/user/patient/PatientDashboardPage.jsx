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
    MagnifyingGlass,
    Microscope,
    Pill,
    QrCode,
    Users,
} from '../../../components/common/ClinicIcon'
import {
    fetchPatientPortalAsync,
    findPatientCodeAsync,
    addFamilyMemberAsync,
} from '../../../redux/actions/user/patientPortalAction'
import { AppToast } from '../../../components/common/AppNotification'

export default function PatientDashboardPage() {
    const dispatch = useDispatch()
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)

    const [lookupQuery, setLookupQuery] = useState('')
    const {
        items: lookupResults,
        loading: lookupLoading,
        error: lookupError,
    } = useSelector((state) => state.user.user.patientLookup)
    const familyMutation = useSelector((state) => state.user.user.familyMutation)
    const [showAddFamily, setShowAddFamily] = useState(false)
    const [newMember, setNewMember] = useState({
        ho_ten: '',
        moi_quan_he: 'Con cái',
        ngay_sinh: '2015-05-10',
        gioi_tinh: 'Nam',
        so_dien_thoai: '',
    })

    if (portalLoading) return <PatientLoading />
    if (portalError) {
        return (
            <PatientError
                message={portalError}
                onRetry={() => dispatch(fetchPatientPortalAsync())}
            />
        )
    }

    const upcoming = portalData.appointments
        .filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status))
        .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))[0]

    const familyList = portalData.familyMembers || []

    const cards = [
        {
            label: 'Lịch hẹn',
            value: portalData.appointments.length,
            icon: CalendarCheck,
            to: '/benh-nhan/lich-hen',
        },
        {
            label: 'Lần khám',
            value: portalData.medicalHistory.length,
            icon: ClipboardText,
            to: '/benh-nhan/lich-su-kham',
        },
        {
            label: 'Đơn thuốc',
            value: portalData.prescriptionError
                ? '—'
                : (portalData.prescriptionMeta?.total_items ?? portalData.prescriptions.length),
            icon: Pill,
            to: '/benh-nhan/don-thuoc',
        },
        {
            label: 'Kết quả CLS',
            value: portalData.labError
                ? '—'
                : (portalData.labMeta?.total_items ?? portalData.labResults.length),
            icon: Microscope,
            to: '/benh-nhan/ket-qua-can-lam-sang',
        },
    ]

    const handleFindLostCode = async (e) => {
        e.preventDefault()
        if (!lookupQuery.trim()) return
        if (lookupLoading) return
        const result = await dispatch(findPatientCodeAsync(lookupQuery))
        if (!findPatientCodeAsync.fulfilled.match(result)) {
            AppToast.error(result.payload || 'Không thể tra cứu')
            return
        }
        const found = result.payload
        if (found.length) {
            AppToast.success(`Tìm thấy ${found.length} hồ sơ bệnh nhân khớp thông tin!`)
        } else {
            AppToast.warning('Thông tin vừa nhập chưa khớp với hồ sơ của bạn.')
        }
    }

    const handleAddFamilyMember = async (e) => {
        e.preventDefault()
        if (!newMember.ho_ten.trim()) {
            AppToast.error('Vui lòng nhập họ tên người thân!')
            return
        }
        if (familyMutation.loading) return
        const result = await dispatch(addFamilyMemberAsync(newMember))
        if (!addFamilyMemberAsync.fulfilled.match(result)) {
            AppToast.error(result.payload || 'Không thể thêm người thân')
            return
        }
        AppToast.success(`Đã thêm hồ sơ "${newMember.ho_ten}" vào Sổ sức khỏe gia đình!`)
        setNewMember({
            ho_ten: '',
            moi_quan_he: 'Con cái',
            ngay_sinh: '2015-05-10',
            gioi_tinh: 'Nam',
            so_dien_thoai: '',
        })
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

            <div className="medpro-card grid grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-clinic-border overflow-hidden tabular-nums">
                {cards.map(({ label, value, icon: Icon, to }) => (
                    <Link
                        key={label}
                        to={to}
                        className="flex items-center gap-3.5 p-4 bg-clinic-surface hover:bg-clinic-surface-tint transition-colors"
                    >
                        <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-clinic-surface-alt text-clinic-cta shrink-0">
                            <Icon size={20} weight="duotone" />
                        </span>
                        <span>
                            <strong className="block font-display text-2xl font-extrabold text-clinic-navy">
                                {value}
                            </strong>
                            <span className="text-xs font-medium text-clinic-text-secondary">{label}</span>
                        </span>
                    </Link>
                ))}
            </div>

            <section className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-clinic-navy">Lịch hẹn sắp tới</h2>
                    <Link to="/benh-nhan/lich-hen" className="text-xs font-bold text-clinic-cta hover:underline">
                        Xem tất cả
                    </Link>
                </div>
                {upcoming ? (
                    <AppointmentCard appointment={upcoming} />
                ) : (
                    <div className="medpro-card p-6 text-center text-sm text-clinic-text-secondary">
                        Hiện chưa có lịch khám nào đang chờ thực hiện.
                    </div>
                )}
            </section>

            <div className="medpro-card mt-5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[8px] bg-clinic-surface-alt text-clinic-cta flex items-center justify-center shrink-0">
                        <QrCode size={20} weight="bold" />
                    </div>
                    <div>
                        <h3 className="font-display font-bold text-sm text-clinic-navy">
                            Tra cứu viện phí &amp; biên lai thanh toán
                        </h3>
                        <p className="text-xs text-clinic-text-secondary mt-0.5">
                            Xem chi tiết các khoản thu khám lâm sàng, xét nghiệm và trạng thái xác nhận từ bộ phận thu ngân.
                        </p>
                    </div>
                </div>
                <Link
                    to="/benh-nhan/hoa-don"
                    className="medpro-btn-outline text-xs px-3.5 py-2 shrink-0"
                >
                    <QrCode size={15} weight="bold" />
                    <span>Tra cứu hóa đơn</span>
                </Link>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <section className="medpro-card p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Users size={20} className="text-clinic-cta" />
                                <h2 className="font-display font-bold text-clinic-navy tabular-nums">
                                    Hồ sơ Người thân ({familyList.length})
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddFamily(!showAddFamily)}
                                className="text-xs font-bold text-clinic-cta hover:underline cursor-pointer"
                            >
                                {showAddFamily ? 'Đóng biểu mẫu' : '+ Thêm thành viên'}
                            </button>
                        </div>

                        {showAddFamily && (
                            <form
                                onSubmit={handleAddFamilyMember}
                                className="mb-4 p-3.5 rounded-[8px] bg-clinic-bg space-y-2.5 text-xs"
                            >
                                <div className="font-bold text-clinic-navy">
                                    Thêm thành viên vào Sổ sức khỏe gia đình
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        aria-label="Họ và tên thành viên gia đình"
                                        placeholder="Nhập họ và tên thành viên *"
                                        value={newMember.ho_ten}
                                        onChange={(e) => setNewMember({ ...newMember, ho_ten: e.target.value })}
                                        className="medpro-input text-xs py-2"
                                        required
                                    />
                                    <select
                                        aria-label="Quan hệ với chủ tài khoản"
                                        value={newMember.moi_quan_he}
                                        onChange={(e) => setNewMember({ ...newMember, moi_quan_he: e.target.value })}
                                        className="medpro-input text-xs py-2"
                                    >
                                        <option value="Con cái">Con cái</option>
                                        <option value="Bố / Mẹ">Bố / Mẹ</option>
                                        <option value="Vợ / Chồng">Vợ / Chồng</option>
                                        <option value="Anh / Chị / Em">Anh / Chị / Em</option>
                                    </select>
                                    <input
                                        type="date"
                                        aria-label="Ngày sinh thành viên"
                                        value={newMember.ngay_sinh}
                                        onChange={(e) => setNewMember({ ...newMember, ngay_sinh: e.target.value })}
                                        className="medpro-input text-xs py-2 tabular-nums"
                                    />
                                    <input
                                        type="text"
                                        aria-label="Số điện thoại liên hệ thành viên"
                                        placeholder="Số điện thoại liên hệ"
                                        value={newMember.so_dien_thoai}
                                        onChange={(e) => setNewMember({ ...newMember, so_dien_thoai: e.target.value })}
                                        className="medpro-input text-xs py-2 tabular-nums"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={familyMutation.loading}
                                        className="medpro-btn-primary text-xs py-1.5 px-4"
                                    >
                                        Lưu thành viên
                                    </button>
                                </div>
                            </form>
                        )}

                        {familyList.length > 0 ? (
                            <div className="divide-y divide-clinic-border border-t border-clinic-border">
                                {familyList.map((m) => (
                                    <div
                                        key={m.id}
                                        className="py-3 flex items-center justify-between gap-3 text-xs"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-bold text-clinic-navy text-sm flex flex-wrap items-center">
                                                <span>{m.ho_ten}</span>
                                                <span className="medpro-badge-info ml-2">{m.quan_he}</span>
                                            </div>
                                            <div className="text-clinic-text-secondary mt-0.5 tabular-nums">
                                                Ngày sinh: {m.ngay_sinh}
                                            </div>
                                        </div>
                                        <Link
                                            to="/dat-lich"
                                            className="text-xs font-bold text-clinic-cta hover:underline shrink-0"
                                        >
                                            Đặt lịch khám
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-clinic-text-muted pt-2">
                                Chưa có thành viên nào được lưu trong sổ gia đình.
                            </p>
                        )}
                    </div>
                </section>

                <section className="medpro-card p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <MagnifyingGlass size={20} className="text-clinic-cta" />
                            <h2 className="font-display font-bold text-clinic-navy">
                                Tìm lại Mã Hồ Sơ Bệnh Nhân bị quên
                            </h2>
                        </div>
                        <p className="text-xs text-clinic-text-secondary mb-3">
                            Nhập đầy đủ số điện thoại, CCCD hoặc họ tên trên hồ sơ của bạn để xem mã bệnh nhân.
                        </p>

                        <form onSubmit={handleFindLostCode} className="flex gap-2 mb-3">
                            <input
                                type="text"
                                aria-label="Tra cứu mã hồ sơ bệnh nhân"
                                placeholder="Số điện thoại, CCCD hoặc họ tên đầy đủ"
                                value={lookupQuery}
                                onChange={(e) => setLookupQuery(e.target.value)}
                                className="medpro-input flex-1 text-xs"
                            />
                            <button
                                type="submit"
                                disabled={lookupLoading}
                                className="medpro-btn-primary text-xs px-4 py-2 shrink-0"
                            >
                                Tìm mã BN
                            </button>
                        </form>

                        {lookupError && (
                            <p role="alert" className="text-sm text-clinic-danger">
                                {lookupError}
                            </p>
                        )}
                        {lookupResults !== null && (
                            <div className="mt-2">
                                {lookupResults.length > 0 ? (
                                    <div className="divide-y divide-clinic-border border-t border-clinic-border mt-3">
                                        {lookupResults.map((r, idx) => (
                                            <div
                                                key={idx}
                                                className="py-3 flex items-center justify-between gap-3 text-xs"
                                            >
                                                <div className="font-bold text-clinic-navy">{r.ho_ten}</div>
                                                <span className="medpro-badge-success font-mono tabular-nums">
                                                    {r.ma_ho_so}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-3 rounded-[6px] bg-clinic-danger-bg p-3 text-xs text-clinic-danger">
                                        Không tìm thấy hồ sơ bệnh nhân nào khớp với từ khóa &ldquo;{lookupQuery}&rdquo;.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <Recent
                    title="Lần khám gần nhất"
                    empty="Chưa có dữ liệu lần khám trước"
                    item={portalData.medicalHistory[0]}
                    to="/benh-nhan/lich-su-kham"
                    render={(item) => (
                        <>
                            <strong className="text-clinic-navy">{item.diagnosis}</strong>
                            <span className="tabular-nums">
                                {item.doctor} · {formatDate(item.date)}
                            </span>
                        </>
                    )}
                />
                <Recent
                    title="Kết quả mới nhất"
                    empty="Chưa có dữ liệu xét nghiệm mới"
                    item={portalData.labResults[0]}
                    to="/benh-nhan/ket-qua-can-lam-sang"
                    render={(item) => (
                        <>
                            <strong className="text-clinic-navy">{item.name}</strong>
                            <span>{item.summary}</span>
                        </>
                    )}
                />
            </div>
        </>
    )
}

function Recent({ title, empty, item, to, render }) {
    return (
        <section className="medpro-card p-5">
            <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-clinic-navy">{title}</h2>
                <Link to={to} className="text-xs font-bold text-clinic-cta hover:underline">
                    Chi tiết
                </Link>
            </div>
            {item ? (
                <div className="mt-4 grid gap-1 text-sm text-clinic-text-secondary">
                    {render(item)}
                </div>
            ) : (
                <p className="mt-4 text-sm text-clinic-text-muted">{empty}</p>
            )}
        </section>
    )
}

const formatDate = (value) =>
    value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${String(value).slice(0, 10)}T00:00:00`)) : 'Chưa ghi nhận'
