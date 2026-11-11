import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Tag, Select, DatePicker, Button, Alert, Progress, Tabs, Table, Empty, Input, Tooltip } from 'antd'
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
} from '@ant-design/icons'
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
    kham_benh: { label: 'Khám lâm sàng', color: 'blue' },
    xet_nghiem: { label: 'Xét nghiệm', color: 'purple' },
    chan_doan_hinh_anh: { label: 'Chẩn đoán hình ảnh', color: 'cyan' },
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
                <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-800">
                        {ngay ? dayjs(ngay).format('DD/MM/YYYY') : '—'}
                    </span>
                    <Tag color="geekblue" className="w-fit text-[11px] font-bold">
                        {DAY_OF_WEEK_NAMES[record.thu_trong_tuan] || `Thứ ${record.thu_trong_tuan}`}
                    </Tag>
                </div>
            ),
        },
        {
            title: 'Bác sĩ & Chuyên khoa',
            dataIndex: 'ten_bac_si',
            key: 'ten_bac_si',
            render: (name, record) => (
                <div>
                    <strong className="text-slate-900 block">{name || 'N/A'}</strong>
                    <span className="text-xs text-slate-500">{record.ten_chuyen_khoa || 'Đa khoa'}</span>
                </div>
            ),
        },
        {
            title: 'Buồng khám',
            dataIndex: 'phong_kham',
            key: 'phong_kham',
            render: (room) => <span className="font-medium text-slate-700">{room || 'Chưa gán'}</span>,
        },
        {
            title: 'Ca trực',
            dataIndex: 'ca_lam_viec',
            key: 'ca_lam_viec',
            width: 160,
            render: (shift, record) => (
                <div>
                    <Tag color={shift === 'sang' ? 'orange' : 'purple'}>
                        {shift === 'sang' ? 'Ca sáng' : shift === 'chieu' ? 'Ca chiều' : shift}
                    </Tag>
                    {record.gio_bat_dau && record.gio_ket_thuc && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
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
                <div className="text-xs">
                    <div className="font-bold text-[#003553]">{limit ?? 0} lượt</div>
                    {(record.han_muc_dat_truoc != null || record.han_muc_vang_lai != null) && (
                        <div className="text-[11px] text-slate-400">
                            Onl: {record.han_muc_dat_truoc ?? 0} • Quầy: {record.han_muc_vang_lai ?? 0}
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
                    <Tag color={active !== false ? 'success' : 'error'}>
                        {active !== false ? 'Đang làm việc' : 'Đã khóa'}
                    </Tag>
                    {active === false && record.ghi_chu_nghi && (
                        <div className="text-[10.5px] text-rose-500 mt-0.5 line-clamp-2" title={record.ghi_chu_nghi}>
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
            render: (code) => <span className="font-mono font-bold text-sky-700">{code}</span>,
        },
        {
            title: 'Tên buồng khám vật lý',
            dataIndex: 'ten_phong',
            key: 'ten_phong',
            render: (name) => <strong className="text-slate-800">{name}</strong>,
        },
        {
            title: 'Vị trí tầng',
            dataIndex: 'tang',
            key: 'tang',
            width: 120,
            render: (floor) => <Tag color="blue">{floor || 'Tầng 1'}</Tag>,
        },
        {
            title: 'Chuyên khoa',
            dataIndex: 'ten_chuyen_khoa',
            key: 'ten_chuyen_khoa',
            render: (spec) => spec ? <span className="text-slate-700">{spec}</span> : <span className="text-slate-400 italic">Dùng chung / Cận lâm sàng</span>,
        },
        {
            title: 'Loại buồng',
            dataIndex: 'loai_phong',
            key: 'loai_phong',
            width: 180,
            render: (type) => {
                const conf = ROOM_TYPE_LABELS[type] || { label: type || 'Khác', color: 'default' }
                return <Tag color={conf.color}>{conf.label}</Tag>
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            key: 'is_active',
            width: 130,
            render: (active) => (
                <Tag color={active !== false ? 'success' : 'error'}>
                    {active !== false ? 'Đang hoạt động' : 'Tạm dừng'}
                </Tag>
            ),
        },
    ]

    return (
        <div className="space-y-5">
            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide">Quản lý Lịch trực & Nguồn lực phòng khám</h2>
                        <span className="text-xs text-slate-500">
                            Điều phối ca trực bác sĩ thực tế, khuôn mẫu lịch định kỳ tuần và giám sát công suất buồng khám vật lý
                        </span>
                    </div>
                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={loading}
                        onClick={handleRefresh}
                        className="medpro-btn-outline !h-8 !px-3 text-xs font-semibold"
                    >
                        Làm mới
                    </Button>
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="middle"
                    items={[
                        {
                            key: 'daily_roster',
                            label: (
                                <span className="font-semibold">
                                    <UserOutlined /> Lịch trực thực tế & Sức chứa ca ({roster.length})
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
                                <span className="font-semibold">
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
                            <span className="text-slate-400 mr-2">Ngày khám:</span>
                            <DatePicker
                                format="DD/MM/YYYY"
                                value={dayjs(selectedDate)}
                                onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                            />
                        </div>
                        <div>
                            <span className="text-slate-400 mr-2">Ca trực:</span>
                            <Select
                                className="w-52"
                                value={selectedShift}
                                onChange={setSelectedShift}
                                options={[
                                    { value: 'all', label: 'Tất cả các ca' },
                                    { value: 'sang', label: 'Ca sáng (07:30 - 11:30)' },
                                    { value: 'chieu', label: 'Ca chiều (13:30 - 16:30)' },
                                ]}
                            />
                        </div>
                        <div>
                            <span className="text-slate-400 mr-2">Chuyên khoa:</span>
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
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <UserOutlined className="text-sky-600" />
                                Danh sách Bác sĩ trực ca ({roster.length} bác sĩ)
                            </h3>
                        </div>

                        {roster.length === 0 ? (
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                                <Empty description="Không có lịch phân ca trực nào phù hợp với bộ lọc ngày và ca khám đã chọn" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {roster.map((doc, idx) => {
                                    const isAbsent = doctorAbsences.some((a) => a.bac_si_id === (doc.bac_si_id || doc.id))
                                    const roomName = doc.ten_phong || doc.ma_phong || 'Chưa xếp phòng'
                                    const specialtyName = doc.chuyen_khoa || 'Chuyên khoa'
                                    const shiftName = doc.ca_lam_viec === 'sang'
                                        ? 'Ca sáng (07:30 - 11:30)'
                                        : doc.ca_lam_viec === 'chieu'
                                            ? 'Ca chiều (13:30 - 16:30)'
                                            : doc.ca_lam_viec || 'Cả ngày'

                                    const capacity = doc.gioi_han_ca_kham || 30
                                    const currentCount = doc.so_luot_da_nhan || 0
                                    const isFull = currentCount >= capacity
                                    const percentUsed = Math.min(100, Math.round((currentCount / capacity) * 100))

                                    return (
                                        <div
                                            key={doc.lich_lam_viec_id || doc.bac_si_id || idx}
                                            className={`p-4 rounded-2xl border transition shadow-2xs space-y-3 ${isAbsent
                                                ? 'bg-red-50/40 border-red-200'
                                                : isFull
                                                    ? 'bg-amber-50/30 border-amber-300'
                                                    : 'bg-white border-slate-200/90 hover:border-sky-300'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 text-sm">{doc.ten_bac_si}</h4>
                                                    <span className="text-[11px] text-slate-500">{specialtyName}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <Tag
                                                        color={isAbsent ? 'error' : doc.is_active === false ? 'default' : 'success'}
                                                        className="mr-0 text-[10px] font-bold"
                                                    >
                                                        {isAbsent ? 'Nghỉ đột xuất' : doc.is_active === false ? 'Hủy ca' : 'Đang trực'}
                                                    </Tag>
                                                    {isFull && (
                                                        <Tag color="red" className="mr-0 text-[10px] font-bold">
                                                            Đầy ca
                                                        </Tag>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-xs text-slate-600 space-y-1.5 pt-1 border-t border-slate-100">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Phòng trực:</span>
                                                    <span className="font-semibold text-slate-800 text-right max-w-[170px] truncate" title={roomName}>
                                                        {roomName}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Ca trực:</span>
                                                    <span className="font-medium text-slate-700">{shiftName}</span>
                                                </div>
                                                <div className="space-y-1 pt-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400">Sức chứa ca:</span>
                                                        <span className={`font-bold ${isFull ? 'text-rose-600' : 'text-sky-700'}`}>
                                                            {currentCount} / {capacity} lượt
                                                        </span>
                                                    </div>
                                                    <Progress
                                                        percent={percentUsed}
                                                        size="small"
                                                        status={isFull ? 'exception' : (percentUsed >= 80 ? 'active' : 'normal')}
                                                        strokeColor={isFull ? '#ef4444' : (percentUsed >= 80 ? '#f59e0b' : '#0284c7')}
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
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <MedicineBoxOutlined className="text-emerald-600" />
                                    Giám sát phụ tải buồng khám thời gian thực ({roomStatus.length} phòng)
                                </h3>
                                <span className="text-xs text-slate-500">
                                    Cập nhật bác sĩ ngồi buồng, bệnh nhân đang khám và cảnh báo quá tải hàng chờ (≥ 5 người)
                                </span>
                            </div>
                        </div>

                        {roomStatus.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs">
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
                                            className={`p-3.5 rounded-xl border space-y-2.5 transition ${isOverloaded
                                                ? 'bg-amber-50/50 border-amber-300'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-xs">
                                                        {room.ten_phong}
                                                    </div>
                                                    <div className="text-slate-400 text-[10px]">
                                                        {room.chuyen_khoa || 'Chuyên khoa'} • {room.tang || 'Tầng 1'}
                                                    </div>
                                                </div>
                                                <Tag
                                                    color={isOverloaded ? 'error' : (room.ten_bac_si ? 'processing' : 'default')}
                                                    className="mr-0 text-[10px] font-semibold"
                                                >
                                                    {isOverloaded ? 'Quá tải' : (room.ten_bac_si ? 'Đang khám' : 'Chưa phân ca')}
                                                </Tag>
                                            </div>

                                            <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                                                <div className="flex justify-between text-slate-600">
                                                    <span className="text-slate-400">Bác sĩ:</span>
                                                    <span className="font-medium text-slate-800 truncate max-w-[130px]" title={room.ten_bac_si || 'Chưa gán'}>
                                                        {room.ten_bac_si || 'Chưa gán'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-slate-600">
                                                    <span className="text-slate-400">Đang khám:</span>
                                                    <span className="font-medium text-emerald-700 truncate max-w-[130px]" title={room.benh_nhan_dang_kham || 'Buồng trống'}>
                                                        {room.benh_nhan_dang_kham || 'Buồng trống'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                                                <span className="text-slate-500">Đang chờ:</span>
                                                <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${waitingCount >= 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
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
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-extrabold text-[#003553] flex items-center gap-2">
                                    <CalendarOutlined className="text-[#009EDB]" />
                                    Bảng lịch làm việc của Bác sĩ theo tuần
                                </h3>
                                <span className="text-xs text-slate-500">
                                    Theo dõi trực quan ca sáng/chiều từng ngày trong tuần, chuyên khoa và buồng khám phụ trách
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setTemplateViewMode('WEEK_MATRIX')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                            templateViewMode === 'WEEK_MATRIX'
                                                ? 'bg-[#00263C] text-white shadow-2xs'
                                                : 'text-slate-600 hover:text-[#00263C]'
                                        }`}
                                    >
                                        <TableOutlined />
                                        <span>Ma trận Tuần</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTemplateViewMode('LIST_VIEW')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                            templateViewMode === 'LIST_VIEW'
                                                ? 'bg-[#00263C] text-white shadow-2xs'
                                                : 'text-slate-600 hover:text-[#00263C]'
                                        }`}
                                    >
                                        <UnorderedListOutlined />
                                        <span>Danh sách ca</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5">
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
                                        className="font-bold text-[#003553]"
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
                                    <div className="text-xs font-bold text-[#00263C] px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200">
                                        {dayjs(templateWeekMonday).format('DD/MM/YYYY')} → {dayjs(templateWeekSunday).format('DD/MM/YYYY')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                <Input
                                    allowClear
                                    size="small"
                                    prefix={<SearchOutlined className="text-slate-400" />}
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
                                        { value: 'sang', label: 'Ca sáng (07:30 - 11:30)' },
                                        { value: 'chieu', label: 'Ca chiều (13:30 - 17:00)' },
                                    ]}
                                />
                            </div>

                            {templateViewMode === 'WEEK_MATRIX' && (
                                <button
                                    type="button"
                                    onClick={() => setShowSlotDetails((prev) => !prev)}
                                    className={`h-8 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                        showSlotDetails
                                            ? 'bg-[#00263C] text-[#00B5F1] border-[#00B5F1]'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                    title="Bật/Tắt hiển thị số slot Onl / Quầy trên từng ô lịch"
                                >
                                    <SlidersOutlined />
                                    <span>{showSlotDetails ? 'Ẩn Slot Onl/Q' : 'Hiện Slot Onl/Q'}</span>
                                </button>
                            )}
                        </div>

                        {templateViewMode === 'WEEK_MATRIX' && (
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 select-none">
                                <span className="font-bold text-[#00263C] text-xs">Chú giải:</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 inline-block" />
                                    <span>Ca Sáng (07:30 - 11:30)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded bg-sky-100 border border-sky-300 inline-block" />
                                    <span>Ca Chiều (13:30 - 17:00)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded border border-dashed border-slate-300 bg-white inline-block" />
                                    <span>Chưa xếp ca</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 inline-block" />
                                    <span>Nghỉ phép / Đã khóa ca</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded bg-slate-300 border border-slate-400 inline-block" />
                                    <span>Cuối tuần (T7, CN)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {templateViewMode === 'WEEK_MATRIX' ? (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            <div className="max-h-[640px] overflow-auto relative">
                                <table className="w-full text-left border-collapse min-w-[1050px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 h-[48px]">
                                            <th
                                                rowSpan={2}
                                                className="sticky top-0 left-0 bg-slate-50 z-40 p-2.5 text-xs font-black text-[#00263C] border-r border-slate-200 w-[235px] min-w-[235px] max-w-[235px] shadow-2xs"
                                            >
                                                Bác sĩ & Chuyên khoa ({matrixDoctors.length})
                                            </th>
                                            {weekDays.map((day) => (
                                                <th
                                                    key={day.isoDate}
                                                    colSpan={2}
                                                    className={`sticky top-0 z-30 h-[48px] px-2 py-1 text-center text-xs font-bold border-l border-slate-200 ${
                                                        day.isSelected
                                                            ? 'bg-sky-100 text-[#00263C] ring-2 ring-[#009EDB] ring-inset'
                                                            : day.isWeekend
                                                            ? 'bg-slate-200/90 text-slate-900 border-l-2 border-slate-300 font-extrabold'
                                                            : day.isToday
                                                            ? 'bg-sky-100/80 text-[#00263C] ring-2 ring-[#00B5F1] ring-inset'
                                                            : 'bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                                                        <span>{day.label}</span>
                                                        {day.isWeekend && (
                                                            <span className="px-1 py-0.5 rounded bg-slate-700 text-white text-[9px] font-black uppercase tracking-wider">
                                                                Cuối tuần
                                                            </span>
                                                        )}
                                                        {day.isToday && (
                                                            <span className="px-1 py-0.5 rounded bg-[#00B5F1] text-[#00263C] text-[9px] font-black uppercase tracking-wider">
                                                                Hôm nay
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">({day.displayDate})</div>
                                                </th>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-slate-200">
                                            {weekDays.map((day) => (
                                                <Fragment key={day.isoDate}>
                                                    <th
                                                        className={`sticky top-[48px] z-30 p-1 text-center text-[11px] font-bold border-l border-slate-200 ${
                                                            day.isWeekend ? 'bg-slate-200 text-slate-800' : 'bg-slate-100/90 text-slate-600'
                                                        }`}
                                                    >
                                                        S
                                                    </th>
                                                    <th
                                                        className={`sticky top-[48px] z-30 p-1 text-center text-[11px] font-bold border-l border-slate-200 ${
                                                            day.isWeekend ? 'bg-slate-200 text-slate-800' : 'bg-slate-100/90 text-slate-600'
                                                        }`}
                                                    >
                                                        C
                                                    </th>
                                                </Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={15} className="p-12 text-center text-slate-400 text-xs">
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
                                                <tr key={doc.key} className="hover:bg-slate-50/70 transition">
                                                    <td className="sticky left-0 bg-white z-20 shadow-2xs p-2.5 border-r border-slate-200 align-middle w-[235px] min-w-[235px] max-w-[235px]">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#003553] to-[#00B5F1] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                                                                {getDoctorInitials(doc.ho_ten)}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-extrabold text-[#003553] text-xs leading-snug break-words">
                                                                    {doc.ho_ten}
                                                                </div>
                                                                <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
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
                                                                ? 'bg-sky-50/40'
                                                                : day.isWeekend
                                                                ? 'bg-slate-100/60'
                                                                : day.isToday
                                                                ? 'bg-sky-50/20'
                                                                : ''
                                                            if (!shift) {
                                                                return (
                                                                    <td className={`p-1 border-l border-slate-100 align-middle text-center ${cellBg}`}>
                                                                        <div className="h-[46px] rounded-lg border border-dashed border-slate-200 bg-white/80 flex items-center justify-center text-slate-300 text-xs">
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
                                                                <div className="text-xs space-y-0.5">
                                                                    <div className="font-bold">{doc.ho_ten}</div>
                                                                    <div>{shift.phong_kham || shortCode}</div>
                                                                    <div>
                                                                        {caType === 'sang' ? 'Ca sáng' : 'Ca chiều'} ({timeStr}) • {dayjs(day.isoDate).format('DD/MM/YYYY')}
                                                                    </div>
                                                                    <div>
                                                                        Hạn mức: {shift.gioi_han_ca_kham ?? 0} lượt (Onl: {shift.han_muc_dat_truoc ?? 0} • Quầy: {shift.han_muc_vang_lai ?? 0})
                                                                    </div>
                                                                    {isLocked && shift.ghi_chu_nghi && (
                                                                        <div className="text-rose-300">Lý do khóa: {shift.ghi_chu_nghi}</div>
                                                                    )}
                                                                </div>
                                                            )

                                                            return (
                                                                <td className={`p-1 border-l border-slate-100 align-middle text-center ${cellBg}`}>
                                                                    <Tooltip title={tooltipText}>
                                                                        <div
                                                                            className={`h-[46px] rounded-lg border p-1 flex flex-col items-center justify-center shadow-2xs transition ${
                                                                                isLocked
                                                                                    ? 'border-slate-300 bg-slate-100 text-slate-500'
                                                                                    : caType === 'sang'
                                                                                    ? 'border-amber-300/80 bg-amber-50 hover:bg-amber-100/70 text-amber-900'
                                                                                    : 'border-sky-300/80 bg-sky-50 hover:bg-sky-100/70 text-sky-900'
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
                                            <tr className="border-t-2 border-slate-200 bg-slate-50">
                                                <td className="sticky left-0 bg-slate-50 z-20 p-2.5 border-r border-slate-200 text-xs font-extrabold text-[#003553]">
                                                    Tổng BS trực / ca
                                                </td>
                                                {weekDays.map((day) => {
                                                    const sangCount = slotActiveDoctorCounts.get(`${day.isoDate}_sang`)?.size || 0
                                                    const chieuCount = slotActiveDoctorCounts.get(`${day.isoDate}_chieu`)?.size || 0
                                                    return (
                                                        <Fragment key={day.isoDate}>
                                                            <td className="p-1.5 border-l border-slate-200 text-center text-[11px] font-extrabold text-amber-800 bg-amber-50/40">
                                                                {sangCount} BS
                                                            </td>
                                                            <td className="p-1.5 border-l border-slate-200 text-center text-[11px] font-extrabold text-sky-800 bg-sky-50/40">
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
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
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
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <ApartmentOutlined className="text-emerald-600" />
                                Danh mục buồng phòng vật lý & phân bổ chuyên khoa
                            </h3>
                            <span className="text-xs text-slate-500">
                                Toàn bộ cơ sở vật chất phòng ốc gồm phòng khám, xét nghiệm và chẩn đoán hình ảnh
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Lọc chuyên khoa:</span>
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
