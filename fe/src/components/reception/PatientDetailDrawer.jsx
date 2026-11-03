import { useState, useEffect } from 'react'
import { Drawer, Tag, Tabs, Descriptions, Button, Alert, Spin } from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import {
    UserOutlined,
    CalendarOutlined,
    HistoryOutlined,
    EditOutlined,
    PlusOutlined,
    WarningOutlined,
    MedicineBoxOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { APPOINTMENT_STATUS_LABELS, QUEUE_STATUS_LABELS } from '../../utils/constants/receptionConstants'
import {
    getPatientDetailAsync,
    fetchPatientPackagesAsync,
    fetchPatientHistorySummaryAsync,
    fetchFlowBoardAsync,
} from '../../redux/actions/reception/receptionAction'
import { clearSelectedPatientDetail } from '../../redux/slices/reception/receptionSlice'
import { receptionService } from '../../services/reception/receptionService'
import { unwrapApi } from '../../utils/helpers/apiHelper'

export default function PatientDetailDrawer({ patientId, open, onClose, onEditClick, onNewAppointmentClick }) {
    const dispatch = useDispatch()
    const {
        patients = [],
        selectedPatientDetail,
        patientDetailLoading,
        appointments = [],
        queueEntries = [],
        departments = [],
        doctors = [],
        services = [],
        patientPackages = [],
        patientHistorySummary,
    } = useSelector((state) => state.reception)

    const [patientSpecificAppointments, setPatientSpecificAppointments] = useState([])
    const [loadingAppointments, setLoadingAppointments] = useState(false)

    useEffect(() => {
        if (patientId && open) {
            dispatch(getPatientDetailAsync(patientId))
            dispatch(fetchPatientPackagesAsync(patientId))
            dispatch(fetchPatientHistorySummaryAsync(patientId))
            dispatch(fetchFlowBoardAsync())
        } else if (!open) {
            dispatch(clearSelectedPatientDetail())
            setPatientSpecificAppointments([])
        }
    }, [dispatch, patientId, open])

    // Kết hợp thông tin từ API chi tiết (5.2) và danh sách tìm kiếm (5.1)
    const patientInList = patients.find((p) => p.id === patientId)
    const patient = selectedPatientDetail || patientInList || {}

    // Gọi API tra cứu tất cả lịch hẹn của bệnh nhân này từ CSDL (không chỉ riêng ngày hôm nay)
    useEffect(() => {
        if (!open || !patientId) return
        const targetKw = patient.phone || patient.so_dien_thoai || patient.patientCode || patient.ma_dinh_danh_y_te
        if (!targetKw) return

        let isMounted = true
        setLoadingAppointments(true)
        receptionService.getAppointments({ search: targetKw, page_size: 50 })
            .then((res) => {
                if (!isMounted) return
                const data = unwrapApi(res)
                const list = data?.items || (Array.isArray(data) ? data : [])
                setPatientSpecificAppointments(list)
            })
            .catch(() => {
                if (isMounted) setPatientSpecificAppointments([])
            })
            .finally(() => {
                if (isMounted) setLoadingAppointments(false)
            })

        return () => {
            isMounted = false
        }
    }, [open, patientId, patient.phone, patient.so_dien_thoai, patient.patientCode, patient.ma_dinh_danh_y_te])

    if (!patientId) return null

    const patientAppointments = patientSpecificAppointments.length > 0
        ? patientSpecificAppointments
        : appointments.filter(
            (a) => (a.patientId && a.patientId === patientId) ||
                   (a.benh_nhan_id && a.benh_nhan_id === patientId) ||
                   (patient.phone && a.so_dien_thoai === patient.phone) ||
                   (patient.patientCode && a.patientCode === patient.patientCode)
        )

    const patientQueue = queueEntries.filter(
        (q) => (q.patientId && q.patientId === patientId) ||
               (q.benh_nhan_id && q.benh_nhan_id === patientId) ||
               (patient.phone && q.phone === patient.phone) ||
               (patient.patientCode && q.patientCode === patient.patientCode)
    )
    const clinicalHistory = patientHistorySummary?.lich_su_kham_gan_day || []
    const isBlocked = Boolean(patient.isBlockedBooking || patientHistorySummary?.is_blocked_booking)

    const patientCode = patient.patientCode || patient.ma_dinh_danh_y_te || `BN-${patientId}`
    const fullName = patient.fullName || patient.ho_ten || 'Người bệnh'
    const phone = patient.phone || patient.so_dien_thoai || 'Chưa có SĐT'
    const genderText = patient.gender === 'MALE' || patient.gioi_tinh === 'Nam' ? 'Nam' : (patient.gender === 'FEMALE' || patient.gioi_tinh === 'Nữ' ? 'Nữ' : 'Khác')
    const dobText = patient.dob || patient.ngay_sinh ? dayjs(patient.dob || patient.ngay_sinh).format('DD/MM/YYYY') : 'N/A'
    const bloodType = patient.bloodType || patient.nhom_mau || 'O+'
    const allergies = patient.allergies || patient.di_ung_thuoc || ''
    const medicalHistory = patient.medicalHistory || patient.tien_su_benh || ''
    const cccd = patient.identityCard || patient.cccd_so || ''
    const email = patient.email || ''
    const address = patient.address || patient.dia_chi || ''
    const creditScore = patient.creditScore ?? 100
    const noShowCount = patient.noShowCount ?? patientHistorySummary?.so_lan_no_show ?? 0
    const noShowRate = patientHistorySummary?.ti_le_no_show ?? 0

    return (
        <Drawer
            title={
                <div className="flex items-center justify-between pr-4">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Hồ sơ bệnh nhân: {patientCode}</span>
                        {patient.isDuplicateSuspect && (
                            <Tag color="red" icon={<WarningOutlined />}>
                                Nghi vấn trùng
                            </Tag>
                        )}
                        {isBlocked && (
                            <Tag color="error" className="font-bold">
                                Bị khóa đặt hẹn
                            </Tag>
                        )}
                    </div>
                </div>
            }
            open={open}
            onClose={onClose}
            width={780}
            extra={
                <div className="flex gap-2">
                    <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                            if (onEditClick) onEditClick(patient)
                        }}
                    >
                        Sửa hồ sơ
                    </Button>
                    <Button
                        size="small"
                        type="primary"
                        className="bg-sky-600"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            if (onNewAppointmentClick) onNewAppointmentClick(patientId)
                        }}
                    >
                        Đặt lịch mới
                    </Button>
                </div>
            }
        >
            <Spin spinning={patientDetailLoading}>
                <div className="space-y-4">
                    {/* Cảnh báo khóa tài khoản nếu No-show nhiều */}
                    {isBlocked && (
                        <Alert
                            message="Cảnh báo tiếp đón (Vi phạm No-show)"
                            description="Tài khoản bệnh nhân này đã bị hệ thống tạm khóa tính năng tự đặt lịch trực tuyến do vượt quá số lần vắng mặt không báo trước."
                            type="error"
                            showIcon
                        />
                    )}

                    {/* Overview Header Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-teal-50 to-emerald-50 border border-sky-100 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 leading-tight">{fullName}</h3>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
                                <span>Giới tính: <strong>{genderText}</strong></span>
                                <span>•</span>
                                <span>Ngày sinh: <strong>{dobText}</strong></span>
                                <span>•</span>
                                <span>SĐT: <strong className="font-mono">{phone}</strong></span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[11px] text-slate-400 block font-medium">Vắng mặt (No-show)</span>
                            <span className="text-base font-black text-rose-600">
                                {noShowCount} <span className="text-xs font-normal text-slate-400">({noShowRate}%)</span>
                            </span>
                        </div>
                    </div>

                    <Tabs
                        defaultActiveKey="info"
                        size="middle"
                        items={[
                            {
                                key: 'info',
                                label: (
                                    <span>
                                        <UserOutlined /> Hành chính
                                    </span>
                                ),
                                children: (
                                    <div className="space-y-4">
                                        <Descriptions bordered size="small" column={1} labelStyle={{ width: '160px', fontWeight: 600 }}>
                                            <Descriptions.Item label="Mã định danh BN">
                                                <span className="font-mono font-bold text-sky-700">{patientCode}</span>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Mã CCCD / Định danh">
                                                {cccd ? (
                                                    <span className="font-mono font-semibold">{cccd}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Chưa có thông tin</span>
                                                )}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Nhóm máu">
                                                <Tag color="magenta" className="font-bold">{bloodType}</Tag>
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Email">
                                                {email ? (
                                                    <span className="text-slate-700">{email}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Chưa cập nhật</span>
                                                )}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Địa chỉ thường trú">
                                                {address || <span className="text-slate-400 italic">Chưa cập nhật</span>}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Tiền sử dị ứng">
                                                {allergies ? (
                                                    <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                        {allergies}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-600">Không ghi nhận dị ứng</span>
                                                )}
                                            </Descriptions.Item>
                                            <Descriptions.Item label="Tiền sử bệnh lý">
                                                {medicalHistory || <span className="text-slate-400 italic">Không có ghi nhận đặc biệt</span>}
                                            </Descriptions.Item>
                                        </Descriptions>
                                    </div>
                                ),
                            },
                            {
                                key: 'clinical_history',
                                label: (
                                    <span>
                                        <HistoryOutlined /> Lịch sử khám gần đây ({clinicalHistory.length})
                                    </span>
                                ),
                                children: (
                                    <div className="space-y-2.5">
                                        {clinicalHistory.length === 0 ? (
                                            <div className="text-center py-6 text-slate-400 text-xs">
                                                Chưa có dữ liệu lịch sử khám bệnh trước đây
                                            </div>
                                        ) : (
                                            clinicalHistory.map((item, idx) => (
                                                <div
                                                    key={item.lich_kham_id || idx}
                                                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-slate-800 text-sm">
                                                            {item.chuyen_khoa || 'Khám chuyên khoa'}
                                                        </span>
                                                        <Tag color="cyan">
                                                            {item.trang_thai || 'Hoàn thành'}
                                                        </Tag>
                                                    </div>
                                                    <div className="text-slate-600 flex justify-between">
                                                        <span>Bác sĩ: <strong>{item.bac_si || 'N/A'}</strong></span>
                                                        <span className="text-slate-400">{item.ngay_kham}</span>
                                                    </div>
                                                    <div className="pt-1.5 border-t border-slate-200 text-slate-700">
                                                        <span className="text-slate-500 font-medium">Chẩn đoán: </span>
                                                        <strong className="text-sky-900">{item.chan_doan || 'Không có ghi chú chẩn đoán'}</strong>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'packages',
                                label: (
                                    <span>
                                        <MedicineBoxOutlined /> Gói khám ({patientPackages.length})
                                    </span>
                                ),
                                children: (
                                    <div className="space-y-2.5">
                                        {patientPackages.length === 0 ? (
                                            <div className="text-center py-6 text-slate-400 text-xs">
                                                Bệnh nhân chưa đăng ký gói khám sức khỏe nào
                                            </div>
                                        ) : (
                                            patientPackages.map((pkg, idx) => {
                                                const packageName = pkg.ten_goi || pkg.ten_goi_kham || 'Gói khám tiêu chuẩn'
                                                const expiryDate = pkg.han_su_dung || pkg.ngay_het_han || 'Vô thời hạn'
                                                const buyDate = pkg.ngay_mua || pkg.ngay_dang_ky || 'N/A'
                                                const remaining = pkg.so_dich_vu_con_lai ?? (pkg.tong_so_dich_vu ? pkg.tong_so_dich_vu - (pkg.so_dich_vu_da_dung || 0) : undefined)
                                                const total = pkg.so_dich_vu_tong || pkg.tong_so_dich_vu || 0
                                                const isExpired = pkg.trang_thai === 'HET_HAN' || pkg.trang_thai === 'het_han'

                                                return (
                                                    <div
                                                        key={pkg.id || pkg.goi_dich_vu_id || idx}
                                                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-slate-800 text-sm">
                                                                {packageName}
                                                            </span>
                                                            <Tag color={isExpired ? 'default' : 'success'}>
                                                                {isExpired ? 'Hết hạn' : 'Đang hiệu lực'}
                                                            </Tag>
                                                        </div>
                                                        <div className="text-slate-500 text-[11px] flex justify-between">
                                                            <span>Ngày mua: {buyDate}</span>
                                                            <span>Hạn dùng: <strong className={isExpired ? 'text-rose-500' : 'text-slate-700'}>{expiryDate}</strong></span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 font-medium">
                                                            <span className="text-slate-600">Số dịch vụ còn lại:</span>
                                                            <span className="font-bold text-sky-700">
                                                                {remaining !== undefined ? `${remaining} / ${total}` : `${total} dịch vụ`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'appointments',
                                label: (
                                    <span>
                                        <CalendarOutlined /> Lịch hẹn ({patientAppointments.length})
                                    </span>
                                ),
                                children: (
                                    <Spin spinning={loadingAppointments}>
                                        <div className="space-y-2.5">
                                            {patientAppointments.length === 0 ? (
                                                <div className="text-center py-6 text-slate-400 text-xs">Chưa có lịch hẹn nào</div>
                                            ) : (
                                                patientAppointments.map((app) => {
                                                    const dep = departments.find((d) => d.id === (app.departmentId || app.chuyen_khoa_id))
                                                    const doc = doctors.find((d) => d.id === (app.doctorId || app.bac_si_id))
                                                    const status = APPOINTMENT_STATUS_LABELS[app.status] || {
                                                        label: app.trang_thai_lich || app.trang_thai || app.status,
                                                        color: 'default',
                                                    }
                                                    return (
                                                        <div key={app.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-slate-800">
                                                                    {app.appointmentCode || app.ma_lich_kham || `APT-${app.id}`}
                                                                </span>
                                                                <Tag color={status.color}>{status.label}</Tag>
                                                            </div>
                                                            <div className="text-slate-600">
                                                                {app.appointmentDate || app.ngay_kham} ({app.timeSlot || app.gio_kham}) - {app.ten_chuyen_khoa || dep?.name || 'Chuyên khoa'}
                                                            </div>
                                                            <div className="text-slate-400 text-[11px]">Bác sĩ: {app.ten_bac_si || doc?.name}</div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </Spin>
                                ),
                            },
                            {
                                key: 'encounters',
                                label: (
                                    <span>
                                        <ClockCircleOutlined /> Tiếp nhận ({patientQueue.length})
                                    </span>
                                ),
                                children: (
                                    <div className="space-y-2.5">
                                        {patientQueue.length === 0 ? (
                                            <div className="text-center py-6 text-slate-400 text-xs">Chưa có lượt tiếp nhận nào</div>
                                        ) : (
                                            patientQueue.map((q) => {
                                                const srv = services.find((s) => s.id === q.serviceId)
                                                const st = QUEUE_STATUS_LABELS[q.status] || { label: q.status, color: 'default' }
                                                return (
                                                    <div key={q.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-extrabold text-sky-600">Số vé: {q.ticketNumber || q.so_thu_tu_kham}</span>
                                                            <Tag color={st.color}>{st.label}</Tag>
                                                        </div>
                                                        <div className="text-slate-600">
                                                            Phòng: {q.roomName || q.phong_kham || 'N/A'} - Giờ check-in: {q.checkInTime || q.gio_tiep_nhan || 'N/A'}
                                                        </div>
                                                        {srv && <div className="text-slate-400 text-[11px]">Dịch vụ: {srv.name}</div>}
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            </Spin>
        </Drawer>
    )
}
