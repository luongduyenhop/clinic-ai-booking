import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Select, DatePicker, Button, Alert, Progress, Tabs, Table, Empty, Input, Tooltip } from 'antd'
import {
    UserOutlined,
    SwapOutlined,
    MedicineBoxOutlined,
    ReloadOutlined,
    CalendarOutlined,
    ApartmentOutlined,
    LeftOutlined,
    RightOutlined,
    TableOutlined,
    UnorderedListOutlined,
    SearchOutlined,
    SlidersOutlined,
} from '../../components/common/ClinicIcon'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import {
    fetchReceptionDataAsync,
    fetchShiftDashboardAsync,
    fetchRosterAsync,
    fetchRosterTemplateAsync,
    fetchRoomsAsync,
    fetchDoctorAbsencesAsync,
} from '../../redux/actions/reception/receptionAction'
import { isIncidentResolved } from '../../redux/slices/reception/receptionSlice'

const DAY_OF_WEEK_NAMES = {
    2: 'Thứ Hai',
    3: 'Thứ Ba',
    4: 'Thứ Tư',
    5: 'Thứ Năm',
    6: 'Thứ Sáu',
    7: 'Thứ Bảy',
    8: 'Chủ Nhật',
}

const VI_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật']

const getMondayIso = (dateInput) => {
    const d = dayjs(dateInput)
    if (!d.isValid()) return dayjs().format('YYYY-MM-DD')
    const offset = d.day() === 0 ? -6 : 1 - d.day()
    return d.add(offset, 'day').format('YYYY-MM-DD')
}

const getDoctorInitials = (name) => {
    if (!name) return 'BS'
    const parts = String(name).trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
}

const getShortRoomCode = (shift) => {
    if (shift?.ma_phong) return shift.ma_phong
    const text = shift?.phong_kham || ''
    const match = text.match(/\(([^)]+)\)/)
    if (match?.[1]) return match[1]
    return text ? text.slice(0, 12) : 'Chưa gán'
}

const ROOM_TYPE_LABELS = {
    kham_benh: { label: 'Khám lâm sàng', badge: 'medpro-badge-info' },
    xet_nghiem: { label: 'Xét nghiệm', badge: 'medpro-badge-warning' },
    chan_doan_hinh_anh: { label: 'Chẩn đoán hình ảnh', badge: 'medpro-badge-success' },
}

export default function ClinicSchedulePage() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const {
        roster = [],
        rosterTemplate = [],
        rooms = [],
        doctorAbsences = [],
        resolvedIncidentKeys = [],
        departments = [],
        roomStatus = [],
        loading = false,
    } = useSelector((state) => state.reception)

    const [activeTab, setActiveTab] = useState('daily_roster')

    const [selectedShift, setSelectedShift] = useState(() => (dayjs().hour() < 12 ? 'sang' : 'chieu'))
    const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'))
    const [selectedDep, setSelectedDep] = useState('')

    const [templateViewMode, setTemplateViewMode] = useState('WEEK_MATRIX')
    const [templateWeekMonday, setTemplateWeekMonday] = useState(() => getMondayIso(dayjs()))
    const [templateDate, setTemplateDate] = useState('')
    const [templateShift, setTemplateShift] = useState('all')
    const [templateDep, setTemplateDep] = useState('')
    const [templateSearch, setTemplateSearch] = useState('')
    const [showSlotDetails, setShowSlotDetails] = useState(true)

    const [selectedRoomDep, setSelectedRoomDep] = useState('')

    const templateWeekSunday = useMemo(
        () => dayjs(templateWeekMonday).add(6, 'day').format('YYYY-MM-DD'),
        [templateWeekMonday]
    )

    const loadTemplateData = useCallback(() => {
        const caParam = templateShift === 'all' ? undefined : templateShift
        const depParam = templateDep ? Number(templateDep) : undefined
        if (templateViewMode === 'LIST_VIEW' && templateDate) {
            dispatch(
                fetchRosterTemplateAsync({
                    queryDate: templateDate,
                    caKham: caParam,
                    chuyenKhoaId: depParam,
                })
            )
            return
        }
        dispatch(
            fetchRosterTemplateAsync({
                tuNgay: templateWeekMonday,
                denNgay: templateWeekSunday,
                caKham: caParam,
                chuyenKhoaId: depParam,
            })
        )
    }, [dispatch, templateViewMode, templateDate, templateWeekMonday, templateWeekSunday, templateShift, templateDep])

    useEffect(() => {
        dispatch(fetchReceptionDataAsync())
    }, [dispatch])

    useEffect(() => {
        const caParam = selectedShift === 'all' ? undefined : selectedShift
        dispatch(
            fetchRosterAsync({
                queryDate: selectedDate,
                caKham: caParam,
                chuyenKhoaId: selectedDep || undefined,
            })
        )
        dispatch(
            fetchDoctorAbsencesAsync({
                queryDate: selectedDate,
                caKham: caParam,
            })
        )
        dispatch(
            fetchShiftDashboardAsync({
                queryDate: selectedDate,
                caKham: caParam,
            })
        )
    }, [dispatch, selectedDate, selectedShift, selectedDep])

    useEffect(() => {
        if (activeTab === 'template') {
            loadTemplateData()
        }
    }, [activeTab, loadTemplateData])

    useEffect(() => {
        if (activeTab === 'physical_rooms') {
            dispatch(
                fetchRoomsAsync({
                    chuyenKhoaId: selectedRoomDep ? Number(selectedRoomDep) : undefined,
                })
            )
        }
    }, [dispatch, activeTab, selectedRoomDep])

    const handleRefresh = () => {
        const caParam = selectedShift === 'all' ? undefined : selectedShift
        dispatch(fetchReceptionDataAsync())
        dispatch(fetchRosterAsync({ queryDate: selectedDate, caKham: caParam, chuyenKhoaId: selectedDep || undefined }))
        dispatch(fetchDoctorAbsencesAsync({ queryDate: selectedDate, caKham: caParam }))
        dispatch(fetchShiftDashboardAsync({ queryDate: selectedDate, caKham: caParam }))
        if (activeTab === 'template') {
            loadTemplateData()
        }
        if (activeTab === 'physical_rooms') {
            dispatch(fetchRoomsAsync({ chuyenKhoaId: selectedRoomDep ? Number(selectedRoomDep) : undefined }))
        }
    }

    const todayIso = dayjs().format('YYYY-MM-DD')

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = dayjs(templateWeekMonday).add(i, 'day')
            const isoDate = d.format('YYYY-MM-DD')
            return {
                dayIndex: i,
                label: VI_WEEKDAYS[i],
                displayDate: d.format('DD/MM'),
                isoDate,
                isToday: isoDate === todayIso,
                isSelected: Boolean(templateDate) && isoDate === templateDate,
                isWeekend: i === 5 || i === 6,
            }
        })
    }, [templateWeekMonday, todayIso, templateDate])

    const { matrixDoctors, shiftsBySlotMap, slotActiveDoctorCounts } = useMemo(() => {
        const docsMap = new Map()
        const slotMap = new Map()
        const slotCounts = new Map()
        const searchLower = templateSearch.trim().toLowerCase()

        ;(rosterTemplate || []).forEach((item) => {
            const docKey = item.bac_si_id ?? item.ten_bac_si
            if (!docKey) return
            const docName = item.ten_bac_si || 'Chưa rõ tên'
            const specName = item.ten_chuyen_khoa || 'Đa khoa'

            if (searchLower && !docName.toLowerCase().includes(searchLower) && !specName.toLowerCase().includes(searchLower)) {
                return
            }

            if (!docsMap.has(docKey)) {
                docsMap.set(docKey, {
                    key: docKey,
                    ho_ten: docName,
                    chuyen_khoa: specName,
                })
            }

            const dateStr = item.ngay_lam_viec
            const caStr = item.ca_lam_viec
            if (dateStr && caStr) {
                const slotKey = `${docKey}_${dateStr}_${caStr}`
                if (!slotMap.has(slotKey)) {
                    slotMap.set(slotKey, item)
                }
                if (item.is_active !== false) {
                    const colKey = `${dateStr}_${caStr}`
                    if (!slotCounts.has(colKey)) slotCounts.set(colKey, new Set())
                    slotCounts.get(colKey).add(docKey)
                }
            }
        })

        const sortedDoctors = Array.from(docsMap.values()).sort((a, b) => {
            const specCmp = a.chuyen_khoa.localeCompare(b.chuyen_khoa, 'vi')
            if (specCmp !== 0) return specCmp
            return a.ho_ten.localeCompare(b.ho_ten, 'vi')
        })

        return {
            matrixDoctors: sortedDoctors,
            shiftsBySlotMap: slotMap,
            slotActiveDoctorCounts: slotCounts,
        }
    }, [rosterTemplate, templateSearch])

    const filteredTemplateList = useMemo(() => {
        const searchLower = templateSearch.trim().toLowerCase()
        if (!searchLower) return rosterTemplate || []
        return (rosterTemplate || []).filter((item) => {
            const name = (item.ten_bac_si || '').toLowerCase()
            const spec = (item.ten_chuyen_khoa || '').toLowerCase()
            return name.includes(searchLower) || spec.includes(searchLower)
        })
    }, [rosterTemplate, templateSearch])

    const departmentOptions = (departments || []).map((d) => ({
        value: d.id,
        label: d.name || d.ten_chuyen_khoa,
    }))

    const templateColumns = [
        {
            title: 'Ngày làm việc',
            dataIndex: 'ngay_lam_viec',
            key: 'ngay_lam_viec',
            width: 170,
            render: (ngay, record) => (
                <div className="flex flex-col gap-1 tabular-nums">
                    <span className="font-bold text-clinic-navy">
                        {ngay ? dayjs(ngay).format('DD/MM/YYYY') : '—'}
                    </span>
                    <span className="medpro-badge-info w-fit text-[11px] font-bold">
                        {DAY_OF_WEEK_NAMES[record.thu_trong_tuan] || `Thứ ${record.thu_trong_tuan}`}
                    </span>
                </div>
            ),
        },
        {
            title: 'Bác sĩ & Chuyên khoa',
            dataIndex: 'ten_bac_si',
            key: 'ten_bac_si',
            render: (name, record) => (
                <div>
                    <strong className="text-clinic-navy block">{name || 'N/A'}</strong>
                    <span className="text-xs text-clinic-text-secondary">{record.ten_chuyen_khoa || 'Đa khoa'}</span>
                </div>
            ),
        },
        {
            title: 'Buồng khám',
            dataIndex: 'phong_kham',
            key: 'phong_kham',
            render: (room) => <span className="font-medium text-clinic-text">{room || 'Chưa gán'}</span>,
        },
        {
            title: 'Ca trực',
            dataIndex: 'ca_lam_viec',
            key: 'ca_lam_viec',
            width: 160,
            render: (shift, record) => (
                <div>
                    <span className={shift === 'sang' ? 'medpro-badge-warning' : 'medpro-badge-info'}>
                        {shift === 'sang' ? 'Ca sáng' : shift === 'chieu' ? 'Ca chiều' : shift}
                    </span>
                    {record.gio_bat_dau && record.gio_ket_thuc && (
                        <div className="text-[11px] text-clinic-text-secondary mt-0.5 tabular-nums">
                            {record.gio_bat_dau} - {record.gio_ket_thuc}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Hạn mức ca',
            dataIndex: 'gioi_han_ca_kham',
            key: 'gioi_han_ca_kham',
            width: 160,
            render: (limit, record) => (
                <div className="text-xs tabular-nums">
                    <div className="font-bold text-clinic-navy">{limit ?? 0} lượt</div>
                    {(record.han_muc_dat_truoc != null || record.han_muc_vang_lai != null) && (
                        <div className="text-[11px] text-clinic-text-secondary">
                            Onl: {record.han_muc_dat_truoc ?? 0} · Quầy: {record.han_muc_vang_lai ?? 0}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            key: 'is_active',
            width: 150,
            render: (active, record) => (
                <div>
                    <span className={active !== false ? 'medpro-badge-success' : 'medpro-badge-danger'}>
                        {active !== false ? 'Đang làm việc' : 'Đã khóa'}
                    </span>
                    {active === false && record.ghi_chu_nghi && (
                        <div className="text-[10.5px] text-clinic-danger mt-0.5 line-clamp-2" title={record.ghi_chu_nghi}>
                            {record.ghi_chu_nghi}
                        </div>
                    )}
                </div>
            ),
        },
    ]

    const roomColumns = [
        {
            title: 'Mã phòng',
            dataIndex: 'ma_phong',
            key: 'ma_phong',
            width: 110,
            render: (code) => <span className="font-mono font-bold text-clinic-cta tabular-nums">{code}</span>,
        },
        {
            title: 'Tên buồng khám vật lý',
            dataIndex: 'ten_phong',
            key: 'ten_phong',
            render: (name) => <strong className="text-clinic-navy">{name}</strong>,
        },
        {
            title: 'Vị trí tầng',
            dataIndex: 'tang',
            key: 'tang',
            width: 120,
            render: (floor) => <span className="medpro-badge-neutral">{floor || 'Tầng 1'}</span>,
        },
        {
            title: 'Chuyên khoa',
            dataIndex: 'ten_chuyen_khoa',
            key: 'ten_chuyen_khoa',
            render: (spec) => spec ? <span className="text-clinic-text">{spec}</span> : <span className="text-clinic-text-muted">Dùng chung / Cận lâm sàng</span>,
        },
        {
            title: 'Loại buồng',
            dataIndex: 'loai_phong',
            key: 'loai_phong',
            width: 180,
            render: (type) => {
                const conf = ROOM_TYPE_LABELS[type] || { label: type || 'Khác', badge: 'medpro-badge-neutral' }
                return <span className={conf.badge}>{conf.label}</span>
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            key: 'is_active',
            width: 130,
            render: (active) => (
                <span className={active !== false ? 'medpro-badge-success' : 'medpro-badge-danger'}>
                    {active !== false ? 'Đang hoạt động' : 'Tạm dừng'}
                </span>
            ),
        },
    ]

    return (
        <div className="space-y-5">
            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-extrabold text-clinic-navy">Quản lý Lịch trực &amp; Nguồn lực phòng khám</h2>
                        <span className="text-xs text-clinic-text-secondary">
                            Điều phối ca trực bác sĩ thực tế, khuôn mẫu lịch định kỳ tuần và giám sát công suất buồng khám vật lý
                        </span>
                    </div>
                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={loading}
                        onClick={handleRefresh}
                        title="Làm mới"
                        aria-label="Làm mới"
                        className="medpro-btn-outline !w-8 !h-8 !p-0 flex items-center justify-center"
                    />
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="middle"
                    items={[
                        {
                            key: 'daily_roster',
                            label: (
                                <span className="font-semibold tabular-nums">
                                    <UserOutlined /> Lịch trực thực tế &amp; Sức chứa ca ({roster.length})
                                </span>
                            ),
                        },
                        {
                            key: 'template',
                            label: (
                                <span className="font-semibold">
                                    <CalendarOutlined /> Bảng lịch làm việc bác sĩ
                                </span>
                            ),
                        },
                        {
                            key: 'physical_rooms',
                            label: (
                                <span className="font-semibold tabular-nums">
                                    <ApartmentOutlined /> Danh mục buồng khám vật lý ({rooms.length})
                                </span>
                            ),
                        },
                    ]}
                />
            </div>

            {activeTab === 'daily_roster' && (
                <div className="space-y-5">
                    <div className="medpro-card p-3 flex flex-wrap items-center gap-3 text-xs">
                        <div>
                            <span className="text-clinic-text-secondary mr-2">Ngày khám:</span>
                            <DatePicker
                                format="DD/MM/YYYY"
                                value={dayjs(selectedDate)}
                                onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                            />
                        </div>
                        <div>
                            <span className="text-clinic-text-secondary mr-2">Ca trực:</span>
                            <Select
                                className="w-52"
                                value={selectedShift}
                                onChange={setSelectedShift}
                                options={[
                                    { value: 'all', label: 'Tất cả các ca' },
                                    { value: 'sang', label: 'Ca sáng' },
                                    { value: 'chieu', label: 'Ca chiều' },
                                ]}
                            />
                        </div>
                        <div>
                            <span className="text-clinic-text-secondary mr-2">Chuyên khoa:</span>
                            <Select
                                className="w-60"
                                placeholder="Tất cả chuyên khoa"
                                value={selectedDep || undefined}
                                onChange={(val) => setSelectedDep(val || '')}
                                allowClear
                                options={departmentOptions}
                            />
                        </div>
                    </div>                    {(() => {
                        const activeAbsences = doctorAbsences.filter((inc) => !isIncidentResolved(inc, resolvedIncidentKeys))
                        if (activeAbsences.length === 0) return null
                        return (
                            <div className="space-y-3">
                                {activeAbsences.map((inc) => (
                                    <Alert
                                        key={inc.nghi_phep_id || inc.bac_si_id}
                                        message={`Bác sĩ ${inc.ten_bac_si} nghỉ đột xuất (Khoa ${inc.ten_chuyen_khoa || 'Chuyên khoa'})`}
                                        description={`Có ${inc.so_benh_nhan_bi_anh_huong || 0} bệnh nhân trong ca trực cần được điều chuyển sang bác sĩ khác cùng chuyên khoa.`}
                                        type="error"
                                        showIcon
                                        action={
                                            <Button
                                                size="small"
                                                danger
                                                icon={<SwapOutlined />}
                                                onClick={() => navigate('/reception/tasks')}
                                            >
                                                Điều chuyển bệnh nhân
                                            </Button>
                                        }
                                    />
                                ))}
                            </div>
                        )
                    })()}



                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-clinic-navy flex items-center gap-2 tabular-nums">
                                <UserOutlined className="text-clinic-cta" />
                                Danh sách Bác sĩ trực ca ({roster.length} bác sĩ)
                            </h3>
                        </div>

                        {roster.length === 0 ? (
                            <div className="bg-clinic-surface p-8 rounded-[6px] border border-clinic-border text-center">
                                <Empty description="Không có lịch phân ca trực nào phù hợp với bộ lọc ngày và ca khám đã chọn" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {roster.map((doc, idx) => {
                                    const isAbsent = doctorAbsences.some((a) => a.bac_si_id === (doc.bac_si_id || doc.id))
                                    const roomName = doc.ten_phong || doc.ma_phong || 'Chưa xếp phòng'
                                    const specialtyName = doc.chuyen_khoa || 'Chuyên khoa'
                                    const shiftName = doc.ca_lam_viec === 'sang'
                                        ? 'Ca sáng'
                                        : doc.ca_lam_viec === 'chieu'
                                            ? 'Ca chiều'
                                            : doc.ca_lam_viec || 'Cả ngày'

                                    const capacity = doc.gioi_han_ca_kham || 30
                                    const currentCount = doc.so_luot_da_nhan || 0
                                    const isFull = currentCount >= capacity
                                    const percentUsed = Math.min(100, Math.round((currentCount / capacity) * 100))

                                    return (
                                        <div
                                            key={doc.lich_lam_viec_id || doc.bac_si_id || idx}
                                            className={`p-4 rounded-[6px] border transition space-y-3 ${isAbsent
                                                ? 'bg-clinic-danger-bg border-clinic-danger-border'
                                                : isFull
                                                    ? 'bg-clinic-warning-bg border-clinic-warning-border'
                                                    : 'bg-clinic-surface border-clinic-border hover:border-clinic-cta'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-bold text-clinic-navy text-sm">{doc.ten_bac_si}</h4>
                                                    <span className="text-[11px] text-clinic-text-secondary">{specialtyName}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span
                                                        className={`text-[10px] font-bold ${
                                                            isAbsent
                                                                ? 'medpro-badge-danger'
                                                                : doc.is_active === false
                                                                  ? 'medpro-badge-neutral'
                                                                  : 'medpro-badge-success'
                                                        }`}
                                                    >
                                                        {isAbsent ? 'Nghỉ đột xuất' : doc.is_active === false ? 'Hủy ca' : 'Đang trực'}
                                                    </span>
                                                    {isFull && (
                                                        <span className="medpro-badge-danger text-[10px] font-bold">
                                                            Đầy ca
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-xs text-clinic-text-secondary space-y-1.5 pt-1 border-t border-clinic-border tabular-nums">
                                                <div className="flex justify-between">
                                                    <span className="text-clinic-text-muted">Phòng trực:</span>
                                                    <span className="font-semibold text-clinic-navy text-right max-w-[170px] truncate" title={roomName}>
                                                        {roomName}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-clinic-text-muted">Ca trực:</span>
                                                    <span className="font-medium text-clinic-text">{shiftName}</span>
                                                </div>
                                                <div className="space-y-1 pt-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-clinic-text-muted">Sức chứa ca:</span>
                                                        <span className={`font-bold ${isFull ? 'text-clinic-danger' : 'text-clinic-cta'}`}>
                                                            {currentCount} / {capacity} lượt
                                                        </span>
                                                    </div>
                                                    <Progress
                                                        percent={percentUsed}
                                                        size="small"
                                                        status={isFull ? 'exception' : (percentUsed >= 80 ? 'active' : 'normal')}
                                                        strokeColor={isFull ? 'var(--color-clinic-danger-solid)' : (percentUsed >= 80 ? 'var(--color-clinic-warning)' : 'var(--color-clinic-cta)')}
                                                        showInfo={false}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="medpro-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-clinic-navy flex items-center gap-2 tabular-nums">
                                    <MedicineBoxOutlined className="text-clinic-success" />
                                    Giám sát phụ tải buồng khám thời gian thực ({roomStatus.length} phòng)
                                </h3>
                                <span className="text-xs text-clinic-text-secondary">
                                    Cập nhật bác sĩ ngồi buồng, bệnh nhân đang khám và cảnh báo quá tải hàng chờ (≥ 5 người)
                                </span>
                            </div>
                        </div>

                        {roomStatus.length === 0 ? (
                            <div className="p-6 text-center text-clinic-text-muted text-xs">
                                Chưa có dữ liệu trạng thái buồng khám cho ca trực này
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                {roomStatus.map((room) => {
                                    const isOverloaded = room.canh_bao_qua_tai || (room.so_benh_nhan_cho >= 5)
                                    const waitingCount = room.so_benh_nhan_cho || 0

                                    return (
                                        <div
                                            key={room.phong_kham_id || room.id}
                                            className={`p-3.5 rounded-[6px] border space-y-2.5 transition ${isOverloaded
                                                ? 'bg-clinic-warning-bg border-clinic-warning-border'
                                                : 'bg-clinic-surface border-clinic-border hover:border-clinic-border-strong'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <div>
                                                    <div className="font-bold text-clinic-navy text-xs">
                                                        {room.ten_phong}
                                                    </div>
                                                    <div className="text-clinic-text-muted text-[10px]">
                                                        {room.chuyen_khoa || 'Chuyên khoa'} · {room.tang || 'Tầng 1'}
                                                    </div>
                                                </div>
                                                <span
                                                    className={`text-[10px] font-semibold ${
                                                        isOverloaded
                                                            ? 'medpro-badge-danger'
                                                            : room.ten_bac_si
                                                              ? 'medpro-badge-info'
                                                              : 'medpro-badge-neutral'
                                                    }`}
                                                >
                                                    {isOverloaded ? 'Quá tải' : room.ten_bac_si ? 'Đang khám' : 'Chưa phân ca'}
                                                </span>
                                            </div>

                                            <div className="space-y-1 bg-clinic-bg p-2 rounded-[4px] border border-clinic-border text-[11px]">
                                                <div className="flex justify-between text-clinic-text-secondary">
                                                    <span className="text-clinic-text-muted">Bác sĩ:</span>
                                                    <span className="font-medium text-clinic-navy truncate max-w-[130px]" title={room.ten_bac_si || 'Chưa gán'}>
                                                        {room.ten_bac_si || 'Chưa gán'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-clinic-text-secondary">
                                                    <span className="text-clinic-text-muted">Đang khám:</span>
                                                    <span className="font-medium text-clinic-success truncate max-w-[130px]" title={room.benh_nhan_dang_kham || 'Buồng trống'}>
                                                        {room.benh_nhan_dang_kham || 'Buồng trống'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-clinic-border tabular-nums">
                                                <span className="text-clinic-text-secondary">Đang chờ:</span>
                                                <span className={`font-bold px-1.5 py-0.5 rounded-[4px] text-[11px] ${waitingCount >= 5 ? 'bg-clinic-danger-bg text-clinic-danger' : 'bg-clinic-bg-muted text-clinic-navy'}`}>
                                                    {waitingCount} người
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'template' && (
                <div className="space-y-4">
                    <div className="bg-clinic-surface rounded-[6px] border border-clinic-border p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-extrabold text-clinic-navy flex items-center gap-2">
                                    <CalendarOutlined className="text-clinic-cta" />
                                    Bảng lịch làm việc của Bác sĩ theo tuần
                                </h3>
                                <span className="text-xs text-clinic-text-secondary">
                                    Theo dõi trực quan ca sáng/chiều từng ngày trong tuần, chuyên khoa và buồng khám phụ trách
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1 bg-clinic-bg-muted border border-clinic-border p-1 rounded-[6px]">
                                    <button
                                        type="button"
                                        onClick={() => setTemplateViewMode('WEEK_MATRIX')}
                                        className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                            templateViewMode === 'WEEK_MATRIX'
                                                ? 'bg-clinic-navy text-clinic-surface'
                                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        <TableOutlined />
                                        <span>Ma trận Tuần</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTemplateViewMode('LIST_VIEW')}
                                        className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                            templateViewMode === 'LIST_VIEW'
                                                ? 'bg-clinic-navy text-clinic-surface'
                                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        <UnorderedListOutlined />
                                        <span>Danh sách ca</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5 tabular-nums">
                                    <Button
                                        size="small"
                                        icon={<LeftOutlined />}
                                        onClick={() => {
                                            setTemplateDate('')
                                            setTemplateWeekMonday((prev) => dayjs(prev).subtract(7, 'day').format('YYYY-MM-DD'))
                                        }}
                                        title="Tuần trước"
                                    />
                                    <Button
                                        size="small"
                                        className="font-bold text-clinic-navy"
                                        onClick={() => {
                                            setTemplateDate('')
                                            setTemplateWeekMonday(getMondayIso(dayjs()))
                                        }}
                                    >
                                        Tuần này
                                    </Button>
                                    <Button
                                        size="small"
                                        icon={<RightOutlined />}
                                        onClick={() => {
                                            setTemplateDate('')
                                            setTemplateWeekMonday((prev) => dayjs(prev).add(7, 'day').format('YYYY-MM-DD'))
                                        }}
                                        title="Tuần sau"
                                    />
                                    <div className="text-xs font-bold text-clinic-navy px-2.5 py-1 bg-clinic-bg rounded-[6px] border border-clinic-border">
                                        {dayjs(templateWeekMonday).format('DD/MM/YYYY')} → {dayjs(templateWeekSunday).format('DD/MM/YYYY')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-clinic-border flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                <Input
                                    allowClear
                                    size="small"
                                    prefix={<SearchOutlined className="text-clinic-text-muted" />}
                                    placeholder="Tìm tên bác sĩ..."
                                    value={templateSearch}
                                    onChange={(e) => setTemplateSearch(e.target.value)}
                                    className="!w-48 !h-8"
                                />
                                <DatePicker
                                    size="small"
                                    format="DD/MM/YYYY"
                                    allowClear
                                    placeholder="Đi tới ngày..."
                                    value={templateDate ? dayjs(templateDate) : null}
                                    onChange={(d) => {
                                        if (d) {
                                            setTemplateDate(d.format('YYYY-MM-DD'))
                                            setTemplateWeekMonday(getMondayIso(d))
                                        } else {
                                            setTemplateDate('')
                                        }
                                    }}
                                    className="!h-8"
                                />
                                <Select
                                    size="small"
                                    className="w-52 !h-8"
                                    placeholder="Tất cả chuyên khoa"
                                    value={templateDep || undefined}
                                    onChange={(val) => setTemplateDep(val || '')}
                                    allowClear
                                    options={departmentOptions}
                                />
                                <Select
                                    size="small"
                                    className="w-44 !h-8"
                                    value={templateShift}
                                    onChange={setTemplateShift}
                                    options={[
                                        { value: 'all', label: 'Tất cả các ca' },
                                        { value: 'sang', label: 'Ca sáng' },
                                        { value: 'chieu', label: 'Ca chiều' },
                                    ]}
                                />
                            </div>

                            {templateViewMode === 'WEEK_MATRIX' && (
                                <button
                                    type="button"
                                    onClick={() => setShowSlotDetails((prev) => !prev)}
                                    className={`h-8 px-2.5 rounded-[6px] border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                        showSlotDetails
                                            ? 'bg-clinic-navy text-clinic-surface border-clinic-navy'
                                            : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border hover:bg-clinic-bg-muted'
                                    }`}
                                    title="Bật/Tắt hiển thị số slot Onl / Quầy trên từng ô lịch"
                                >
                                    <SlidersOutlined />
                                    <span>{showSlotDetails ? 'Ẩn Slot Onl/Q' : 'Hiện Slot Onl/Q'}</span>
                                </button>
                            )}
                        </div>

                        {templateViewMode === 'WEEK_MATRIX' && (
                            <div className="pt-2 border-t border-clinic-border flex flex-wrap items-center gap-3 text-[11px] font-semibold text-clinic-text-secondary select-none">
                                <span className="font-bold text-clinic-navy text-xs">Chú giải:</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-[4px] bg-clinic-warning-bg border border-clinic-warning-border inline-block" />
                                    <span>Ca Sáng</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-[4px] bg-clinic-surface-alt border border-clinic-info-border inline-block" />
                                    <span>Ca Chiều</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-[4px] border border-dashed border-clinic-border-strong bg-clinic-surface inline-block" />
                                    <span>Chưa xếp ca</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-[4px] bg-clinic-bg-muted border border-clinic-border inline-block" />
                                    <span>Nghỉ phép / Đã khóa ca</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-[4px] bg-clinic-bg-muted border border-clinic-border-strong inline-block" />
                                    <span>Cuối tuần (T7, CN)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {templateViewMode === 'WEEK_MATRIX' ? (
                        <div className="bg-clinic-surface rounded-[6px] border border-clinic-border overflow-hidden">
                            <div className="max-h-[640px] overflow-auto relative">
                                <table className="w-full text-left border-collapse min-w-[1050px]">
                                    <thead>
                                        <tr className="border-b border-clinic-border h-[48px]">
                                            <th
                                                rowSpan={2}
                                                className="sticky top-0 left-0 bg-clinic-bg z-40 p-2.5 text-xs font-black text-clinic-navy border-r border-clinic-border w-[235px] min-w-[235px] max-w-[235px] tabular-nums"
                                            >
                                                Bác sĩ &amp; Chuyên khoa ({matrixDoctors.length})
                                            </th>
                                            {weekDays.map((day) => (
                                                <th
                                                    key={day.isoDate}
                                                    colSpan={2}
                                                    className={`sticky top-0 z-30 h-[48px] px-2 py-1 text-center text-xs font-bold border-l border-clinic-border tabular-nums ${
                                                        day.isSelected
                                                            ? 'bg-clinic-surface-alt text-clinic-navy'
                                                            : day.isWeekend
                                                            ? 'bg-clinic-bg-muted text-clinic-navy border-l-2 border-clinic-border-strong font-extrabold'
                                                            : day.isToday
                                                            ? 'bg-clinic-surface-alt text-clinic-navy'
                                                            : 'bg-clinic-bg text-clinic-text'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                                                        <span>{day.label}</span>
                                                        {day.isWeekend && (
                                                            <span className="px-1 py-0.5 rounded-[4px] bg-clinic-navy text-clinic-surface text-[10px] font-bold">
                                                                Cuối tuần
                                                            </span>
                                                        )}
                                                        {day.isToday && (
                                                            <span className="px-1 py-0.5 rounded-[4px] bg-clinic-cta text-clinic-surface text-[10px] font-bold">
                                                                Hôm nay
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] font-normal text-clinic-text-secondary mt-0.5">({day.displayDate})</div>
                                                </th>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-clinic-border">
                                            {weekDays.map((day) => (
                                                <Fragment key={day.isoDate}>
                                                    <th
                                                        className={`sticky top-[48px] z-30 p-1 text-center text-[11px] font-bold border-l border-clinic-border ${
                                                            day.isWeekend ? 'bg-clinic-bg-muted text-clinic-navy' : 'bg-clinic-bg text-clinic-text-secondary'
                                                        }`}
                                                    >
                                                        S
                                                    </th>
                                                    <th
                                                        className={`sticky top-[48px] z-30 p-1 text-center text-[11px] font-bold border-l border-clinic-border ${
                                                            day.isWeekend ? 'bg-clinic-bg-muted text-clinic-navy' : 'bg-clinic-bg text-clinic-text-secondary'
                                                        }`}
                                                    >
                                                        C
                                                    </th>
                                                </Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-clinic-border">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={15} className="p-12 text-center text-clinic-text-muted text-xs">
                                                    Đang tải ma trận lịch làm việc tuần...
                                                </td>
                                            </tr>
                                        ) : matrixDoctors.length === 0 ? (
                                            <tr>
                                                <td colSpan={15} className="p-10 text-center">
                                                    <Empty description="Không tìm thấy lịch làm việc bác sĩ nào trong tuần / điều kiện lọc đã chọn" />
                                                </td>
                                            </tr>
                                        ) : (
                                            matrixDoctors.map((doc) => (
                                                <tr key={doc.key} className="hover:bg-clinic-surface-tint transition">
                                                    <td className="sticky left-0 bg-clinic-surface z-20 p-2.5 border-r border-clinic-border align-middle w-[235px] min-w-[235px] max-w-[235px]">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-[6px] bg-clinic-navy text-clinic-surface font-black text-xs flex items-center justify-center shrink-0">
                                                                {getDoctorInitials(doc.ho_ten)}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-extrabold text-clinic-navy text-xs leading-snug break-words">
                                                                    {doc.ho_ten}
                                                                </div>
                                                                <div className="text-[11px] font-medium text-clinic-text-secondary truncate mt-0.5">
                                                                    {doc.chuyen_khoa}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {weekDays.map((day) => {
                                                        const shiftSang = shiftsBySlotMap.get(`${doc.key}_${day.isoDate}_sang`)
                                                        const shiftChieu = shiftsBySlotMap.get(`${doc.key}_${day.isoDate}_chieu`)

                                                        const renderMatrixCell = (shift, caType) => {
                                                            const cellBg = day.isSelected
                                                                ? 'bg-clinic-surface-tint'
                                                                : day.isWeekend
                                                                ? 'bg-clinic-bg-muted'
                                                                : day.isToday
                                                                ? 'bg-clinic-surface-tint/60'
                                                                : ''
                                                            if (!shift) {
                                                                return (
                                                                    <td className={`p-1 border-l border-clinic-border align-middle text-center ${cellBg}`}>
                                                                        <div className="h-[46px] rounded-[4px] border border-dashed border-clinic-border bg-clinic-surface flex items-center justify-center text-clinic-text-subtle text-xs">
                                                                            —
                                                                        </div>
                                                                    </td>
                                                                )
                                                            }

                                                            const isLocked = shift.is_active === false
                                                            const shortCode = getShortRoomCode(shift)
                                                            const timeStr = shift.gio_bat_dau && shift.gio_ket_thuc
                                                                ? `${shift.gio_bat_dau} - ${shift.gio_ket_thuc}`
                                                                : caType === 'sang'
                                                                ? '07:30 - 11:30'
                                                                : '13:30 - 17:00'

                                                            const tooltipText = (
                                                                <div className="text-xs space-y-0.5 tabular-nums">
                                                                    <div className="font-bold">{doc.ho_ten}</div>
                                                                    <div>{shift.phong_kham || shortCode}</div>
                                                                    <div>
                                                                        {caType === 'sang' ? 'Ca sáng' : 'Ca chiều'} ({timeStr}) · {dayjs(day.isoDate).format('DD/MM/YYYY')}
                                                                    </div>
                                                                    <div>
                                                                        Hạn mức: {shift.gioi_han_ca_kham ?? 0} lượt (Onl: {shift.han_muc_dat_truoc ?? 0} · Quầy: {shift.han_muc_vang_lai ?? 0})
                                                                    </div>
                                                                    {isLocked && shift.ghi_chu_nghi && (
                                                                        <div className="text-clinic-danger">Lý do khóa: {shift.ghi_chu_nghi}</div>
                                                                    )}
                                                                </div>
                                                            )

                                                            return (
                                                                <td className={`p-1 border-l border-clinic-border align-middle text-center ${cellBg}`}>
                                                                    <Tooltip title={tooltipText}>
                                                                        <div
                                                                            className={`h-[46px] rounded-[4px] border p-1 flex flex-col items-center justify-center transition tabular-nums ${
                                                                                isLocked
                                                                                    ? 'border-clinic-border-strong bg-clinic-bg-muted text-clinic-text-muted'
                                                                                    : caType === 'sang'
                                                                                    ? 'border-clinic-warning-border bg-clinic-warning-bg text-clinic-warning'
                                                                                    : 'border-clinic-info-border bg-clinic-surface-alt text-clinic-navy'
                                                                            }`}
                                                                        >
                                                                            <span className="font-black text-xs tracking-tight truncate max-w-[82px]">
                                                                                {isLocked ? 'Nghỉ/Khóa' : shortCode}
                                                                            </span>
                                                                            {showSlotDetails && !isLocked && (
                                                                                <span className="text-[10px] font-semibold opacity-90 tracking-tighter mt-0.5">
                                                                                    {shift.han_muc_dat_truoc ?? 0} Onl · {shift.han_muc_vang_lai ?? 0} Q
                                                                                </span>
                                                                            )}
                                                                            {isLocked && (
                                                                                <span className="text-[9px] opacity-80 truncate max-w-[82px]">
                                                                                    {shortCode}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </Tooltip>
                                                                </td>
                                                            )
                                                        }

                                                        return (
                                                            <Fragment key={day.isoDate}>
                                                                {renderMatrixCell(shiftSang, 'sang')}
                                                                {renderMatrixCell(shiftChieu, 'chieu')}
                                                            </Fragment>
                                                        )
                                                    })}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {matrixDoctors.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-clinic-border bg-clinic-bg tabular-nums">
                                                <td className="sticky left-0 bg-clinic-bg z-20 p-2.5 border-r border-clinic-border text-xs font-extrabold text-clinic-navy">
                                                    Tổng BS trực / ca
                                                </td>
                                                {weekDays.map((day) => {
                                                    const sangCount = slotActiveDoctorCounts.get(`${day.isoDate}_sang`)?.size || 0
                                                    const chieuCount = slotActiveDoctorCounts.get(`${day.isoDate}_chieu`)?.size || 0
                                                    return (
                                                        <Fragment key={day.isoDate}>
                                                            <td className="p-1.5 border-l border-clinic-border text-center text-[11px] font-extrabold text-clinic-warning bg-clinic-warning-bg">
                                                                {sangCount} BS
                                                            </td>
                                                            <td className="p-1.5 border-l border-clinic-border text-center text-[11px] font-extrabold text-clinic-cta bg-clinic-surface-alt">
                                                                {chieuCount} BS
                                                            </td>
                                                        </Fragment>
                                                    )
                                                })}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-clinic-surface rounded-[6px] border border-clinic-border p-4">
                            <Table
                                columns={templateColumns}
                                dataSource={filteredTemplateList}
                                rowKey="id"
                                loading={loading}
                                pagination={{
                                    pageSize: 15,
                                    showSizeChanger: true,
                                    showTotal: (total) => `Tổng ${total} ca làm việc`,
                                }}
                                size="middle"
                                locale={{ emptyText: 'Không tìm thấy lịch làm việc nào phù hợp điều kiện lọc' }}
                            />
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'physical_rooms' && (
                <div className="medpro-card p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-border pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-clinic-navy flex items-center gap-2">
                                <ApartmentOutlined className="text-clinic-success" />
                                Danh mục buồng phòng vật lý &amp; phân bổ chuyên khoa
                            </h3>
                            <span className="text-xs text-clinic-text-secondary">
                                Toàn bộ cơ sở vật chất phòng ốc gồm phòng khám, xét nghiệm và chẩn đoán hình ảnh
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-clinic-text-secondary">Lọc chuyên khoa:</span>
                            <Select
                                className="w-60"
                                placeholder="Tất cả chuyên khoa"
                                value={selectedRoomDep || undefined}
                                onChange={(val) => setSelectedRoomDep(val || '')}
                                allowClear
                                options={departmentOptions}
                            />
                        </div>
                    </div>

                    <Table
                        columns={roomColumns}
                        dataSource={rooms}
                        rowKey="id"
                        pagination={false}
                        size="middle"
                        locale={{ emptyText: 'Không tìm thấy buồng khám nào' }}
                    />
                </div>
            )}
        </div>
    )
}
