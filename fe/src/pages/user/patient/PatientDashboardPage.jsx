import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import PatientPageHeader from '../../../components/user/patient/PatientPageHeader'
import AppointmentCard from '../../../components/user/patient/AppointmentCard'
import { PatientError, PatientLoading } from '../../../components/user/patient/PatientPageState'
import {
    CalendarPlus,
    MagnifyingGlass,
    Receipt,
    Stethoscope,
    Users,
} from '../../../components/common/ClinicIcon'
import {
    fetchPatientPortalAsync,
    findPatientCodeAsync,
    addFamilyMemberAsync,
} from '../../../redux/actions/user/patientPortalAction'
import { AppToast } from '../../../components/common/AppNotification'
import { stripDemoTag } from '../../../utils/helpers/doctorNameHelper'

export default function PatientDashboardPage() {
    const dispatch = useDispatch()
    const authUser = useSelector((state) => state.app.auth.user)
    const { portalData, portalLoading, portalError } = useSelector((state) => state.user.user)

    const [lookupQuery, setLookupQuery] = useState('')
    const [showLostCodeLookup, setShowLostCodeLookup] = useState(false)
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

    const patientFirstName = stripDemoTag(authUser?.shortName || authUser?.fullName || 'bạn')
    const upcoming = portalData.appointments
        .filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status))
        .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))[0]

    const familyList = portalData.familyMembers || []
    const appointmentCount = portalData.appointmentsError ? 0 : portalData.appointments.length
    const recordCount = portalData.medicalHistoryError ? 0 : portalData.medicalHistory.length
    const rxCount = portalData.prescriptionError
        ? 0
        : (portalData.prescriptionMeta?.total_items ?? portalData.prescriptions.length)
    const labCount = portalData.labError
        ? 0
        : (portalData.labMeta?.total_items ?? portalData.labResults.length)
    const hasClinicalActivity = appointmentCount + recordCount + rxCount + labCount > 0

    const cards = [
        {
            label: 'Lịch hẹn',
            value: portalData.appointmentsError ? '—' : appointmentCount,
            to: '/benh-nhan/lich-hen',
        },
        {
            label: 'Bệnh án điện tử',
            value: portalData.medicalHistoryError ? '—' : recordCount,
            to: '/benh-nhan/benh-an',
        },
        {
            label: 'Đơn thuốc',
            value: portalData.prescriptionError ? '—' : rxCount,
            to: '/benh-nhan/don-thuoc',
        },
        {
            label: 'Kết quả CLS',
            value: portalData.labError ? '—' : labCount,
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
            AppToast.success(`Tìm thấy ${found.length} hồ sơ bệnh nhân khớp thông tin`)
        } else {
            AppToast.warning('Thông tin vừa nhập chưa khớp với hồ sơ của bạn.')
        }
    }

    const handleAddFamilyMember = async (e) => {
        e.preventDefault()
        if (!newMember.ho_ten.trim()) {
            AppToast.error('Vui lòng nhập họ tên người thân')
            return
        }
        if (familyMutation.loading) return
        const result = await dispatch(addFamilyMemberAsync(newMember))
        if (!addFamilyMemberAsync.fulfilled.match(result)) {
            AppToast.error(result.payload || 'Không thể thêm người thân')
            return
        }
        AppToast.success(`Đã thêm hồ sơ "${newMember.ho_ten}" vào Sổ sức khỏe gia đình`)
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
                title={`Xin chào, ${patientFirstName}`}
                description="Quản lý lịch hẹn khám, kết quả cận lâm sàng và sổ sức khỏe cho bản thân cùng gia đình."
                action={
                    hasClinicalActivity ? (
                        <Link to="/dat-lich" className="medpro-btn-primary min-h-10 px-4">
                            <CalendarPlus size={17} />
                            <span>Đặt lịch khám</span>
                        </Link>
                    ) : null
                }
            />

            {hasClinicalActivity ? (
                <>
                    <div className="medpro-card grid grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-clinic-border overflow-hidden tabular-nums">
                        {cards.map(({ label, value, to }) => (
                            <Link
                                key={label}
                                to={to}
                                className="p-4 bg-clinic-surface hover:bg-clinic-surface-tint transition-colors block"
                            >
                                <span className="text-xs font-medium text-clinic-text-secondary">{label}</span>
                                <strong className="mt-1 block font-display text-2xl font-bold text-clinic-navy">
                                    {value}
                                </strong>
                            </Link>
                        ))}
                    </div>

                    <section className="mt-6">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-display text-base font-bold text-clinic-navy">Lịch hẹn sắp tới</h2>
                            <Link to="/benh-nhan/lich-hen" className="text-xs font-semibold text-clinic-cta hover:underline">
                                Xem tất cả
                            </Link>
                        </div>
                        {upcoming ? (
                            <AppointmentCard appointment={upcoming} />
                        ) : (
                            <div className="medpro-card p-5 flex flex-wrap items-center justify-between gap-3 text-sm text-clinic-text-secondary">
                                <span>Bạn chưa có lịch khám nào đang chờ thực hiện.</span>
                                <Link to="/dat-lich" className="text-xs font-semibold text-clinic-cta hover:underline">
                                    Chọn giờ khám mới
                                </Link>
                            </div>
                        )}
                    </section>
                </>
            ) : (
                <section className="medpro-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-xl space-y-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-clinic-cta">
                            <Stethoscope size={15} weight="duotone" />
                            <span>Chăm sóc sức khỏe chủ động</span>
                        </span>
                        <h2 className="font-display text-lg sm:text-xl font-bold text-clinic-navy leading-snug">
                            Sổ sức khỏe điện tử của bạn đã sẵn sàng
                        </h2>
                        <p className="text-sm leading-relaxed text-clinic-text-secondary">
                            Đặt hẹn trước để chọn bác sĩ phù hợp mà không phải xếp hàng chờ tại quầy, hoặc kiểm tra triệu chứng để hệ thống định hướng chuyên khoa chính xác.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <Link to="/dat-lich" className="medpro-btn-primary min-h-10 px-4 text-sm">
                            <CalendarPlus size={17} />
                            <span>Đặt lịch khám</span>
                        </Link>
                        <Link to="/khao-sat-trieu-chung" className="medpro-btn-outline min-h-10 px-4 text-sm">
                            <span>Kiểm tra triệu chứng</span>
                        </Link>
                    </div>
                </section>
            )}

            <div className="mt-6 grid gap-5 xl:grid-cols-12 items-start">
                <section className="xl:col-span-7 medpro-card p-5">
                    <div className="flex items-center justify-between pb-3 border-b border-clinic-border">
                        <div className="flex items-center gap-2">
                            <Users size={18} className="text-clinic-cta" />
                            <h2 className="font-display text-sm font-bold text-clinic-navy tabular-nums">
                                Sổ sức khỏe người thân ({familyList.length})
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAddFamily(!showAddFamily)}
                            className="text-xs font-semibold text-clinic-cta hover:underline cursor-pointer"
                        >
                            {showAddFamily ? 'Đóng biểu mẫu' : '+ Thêm người thân'}
                        </button>
                    </div>

                    {showAddFamily && (
                        <form
                            onSubmit={handleAddFamilyMember}
                            className="mt-3.5 p-3.5 rounded-[8px] bg-clinic-bg space-y-3 text-xs"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                    <label className="medpro-label">Họ và tên *</label>
                                    <input
                                        type="text"
                                        aria-label="Họ và tên thành viên gia đình"
                                        placeholder="Nguyễn Minh Anh"
                                        value={newMember.ho_ten}
                                        onChange={(e) => setNewMember({ ...newMember, ho_ten: e.target.value })}
                                        className="medpro-input text-xs py-2"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Mối quan hệ</label>
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
                                </div>
                                <div>
                                    <label className="medpro-label">Ngày sinh</label>
                                    <input
                                        type="date"
                                        aria-label="Ngày sinh thành viên"
                                        value={newMember.ngay_sinh}
                                        onChange={(e) => setNewMember({ ...newMember, ngay_sinh: e.target.value })}
                                        className="medpro-input text-xs py-2 tabular-nums"
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Số điện thoại</label>
                                    <input
                                        type="text"
                                        aria-label="Số điện thoại liên hệ thành viên"
                                        placeholder="Tùy chọn"
                                        value={newMember.so_dien_thoai}
                                        onChange={(e) => setNewMember({ ...newMember, so_dien_thoai: e.target.value })}
                                        className="medpro-input text-xs py-2 tabular-nums"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={familyMutation.loading}
                                    className="medpro-btn-primary text-xs py-1.5 px-4"
                                >
                                    Lưu hồ sơ
                                </button>
                            </div>
                        </form>
                    )}

                    {familyList.length > 0 ? (
                        <div className="divide-y divide-clinic-border mt-1">
                            {familyList.map((m) => (
                                <div
                                    key={m.id}
                                    className="py-3 flex items-center justify-between gap-3 text-xs"
                                >
                                    <div className="min-w-0">
                                        <div className="font-semibold text-clinic-navy text-sm flex flex-wrap items-center gap-2">
                                            <span>{m.ho_ten}</span>
                                            <span className="medpro-badge-neutral">{m.quan_he}</span>
                                        </div>
                                        <div className="text-clinic-text-secondary mt-0.5 tabular-nums">
                                            Ngày sinh: {formatDate(m.ngay_sinh)}
                                        </div>
                                    </div>
                                    <Link
                                        to="/dat-lich"
                                        className="text-xs font-semibold text-clinic-cta hover:underline shrink-0"
                                    >
                                        Đặt lịch
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-clinic-text-secondary pt-3.5 leading-relaxed">
                            Lưu thông tin cha mẹ hoặc con nhỏ để đặt lịch khám nhanh và theo dõi đơn thuốc tập trung trên một tài khoản.
                        </p>
                    )}
                </section>

                <div className="xl:col-span-5 space-y-4">
                    <section className="medpro-card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Receipt size={18} className="text-clinic-cta" />
                                <h2 className="font-display text-sm font-bold text-clinic-navy">
                                    Viện phí &amp; Biên lai
                                </h2>
                            </div>
                            <Link
                                to="/benh-nhan/hoa-don"
                                className="text-xs font-semibold text-clinic-cta hover:underline"
                            >
                                Mở danh sách
                            </Link>
                        </div>
                        <p className="text-xs text-clinic-text-secondary leading-relaxed">
                            Đối chiếu chi tiết khoản thu khám chuyên khoa, cận lâm sàng và tải biên lai điện tử.
                        </p>
                    </section>

                    <section className="medpro-card p-5">
                        <button
                            type="button"
                            onClick={() => setShowLostCodeLookup((prev) => !prev)}
                            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                        >
                            <span className="flex items-center gap-2 text-xs font-semibold text-clinic-navy">
                                <MagnifyingGlass size={16} className="text-clinic-text-muted" />
                                <span>Tra cứu mã hồ sơ khám cũ tại quầy</span>
                            </span>
                            <span className="text-xs font-medium text-clinic-cta">
                                {showLostCodeLookup ? 'Thu gọn' : 'Mở tra cứu'}
                            </span>
                        </button>

                        {showLostCodeLookup && (
                            <div className="mt-3 pt-3 border-t border-clinic-border">
                                <form onSubmit={handleFindLostCode} className="flex gap-2">
                                    <input
                                        type="text"
                                        aria-label="Tra cứu mã hồ sơ bệnh nhân"
                                        placeholder="SĐT, CCCD hoặc họ tên"
                                        value={lookupQuery}
                                        onChange={(e) => setLookupQuery(e.target.value)}
                                        className="medpro-input flex-1 text-xs py-2"
                                    />
                                    <button
                                        type="submit"
                                        disabled={lookupLoading}
                                        className="medpro-btn-primary text-xs px-3.5 py-2 shrink-0"
                                    >
                                        Tra cứu
                                    </button>
                                </form>

                                {lookupError && (
                                    <p role="alert" className="mt-2 text-xs text-clinic-danger">
                                        {lookupError}
                                    </p>
                                )}
                                {lookupResults !== null && (
                                    <div className="mt-2">
                                        {lookupResults.length > 0 ? (
                                            <div className="divide-y divide-clinic-border border-t border-clinic-border mt-2">
                                                {lookupResults.map((r, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="py-2.5 flex items-center justify-between gap-3 text-xs tabular-nums"
                                                    >
                                                        <span className="font-semibold text-clinic-navy">{r.ho_ten}</span>
                                                        <span className="medpro-badge-success">{r.ma_ho_so}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-2.5 rounded-[6px] bg-clinic-danger-bg p-2.5 text-xs text-clinic-danger">
                                                Chưa tìm thấy hồ sơ khớp với &ldquo;{lookupQuery}&rdquo;.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {hasClinicalActivity && (
                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <Recent
                        title="Lần khám gần nhất"
                        empty="Chưa có dữ liệu lần khám trước"
                        item={portalData.medicalHistory[0]}
                        to="/benh-nhan/benh-an"
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
                        title="Kết quả cận lâm sàng mới nhất"
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
            )}
        </>
    )
}

function Recent({ title, empty, item, to, render }) {
    return (
        <section className="medpro-card p-5">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-clinic-navy">{title}</h2>
                <Link to={to} className="text-xs font-semibold text-clinic-cta hover:underline">
                    Chi tiết
                </Link>
            </div>
            {item ? (
                <div className="mt-3 grid gap-1 text-sm text-clinic-text-secondary">
                    {render(item)}
                </div>
            ) : (
                <p className="mt-3 text-sm text-clinic-text-muted">{empty}</p>
            )}
        </section>
    )
}

const formatDate = (value) =>
    value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${String(value).slice(0, 10)}T00:00:00`)) : 'Chưa ghi nhận'
