import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Table, Input, Button, Tag, Space } from 'antd'
import {
    SearchOutlined,
    UserAddOutlined,
    EditOutlined,
    WarningOutlined,
    EyeOutlined,
    SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PatientFormModal from '../../components/reception/PatientFormModal'
import PatientDetailDrawer from '../../components/reception/PatientDetailDrawer'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'
import {
    searchPatientsAsync,
    fetchAppointmentsAsync,
    fetchFlowBoardAsync,
} from '../../redux/actions/reception/receptionAction'

export default function PatientsPage() {
    const dispatch = useDispatch()
    const {
        patients = [],
        patientPagination = { page: 1, pageSize: 15, totalItems: 0 },
        appointments = [],
        queueEntries = [],
        loading,
    } = useSelector((state) => state.reception)

    const [searchQuery, setSearchQuery] = useState('')
    const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false)
    const [selectedPatientId, setSelectedPatientId] = useState(null)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editPatient, setEditPatient] = useState(null)
    const [newAppPatientId, setNewAppPatientId] = useState(null)

    useEffect(() => {
        dispatch(searchPatientsAsync({ search: searchQuery, page: 1, pageSize: 15 }))
        dispatch(fetchAppointmentsAsync({ pageSize: 100 }))
        dispatch(fetchFlowBoardAsync())
    }, [dispatch])

    const handleSearch = (val) => {
        setSearchQuery(val)
        dispatch(searchPatientsAsync({ search: val, page: 1, pageSize: 15 }))
    }

    const handleTableChange = (pagination) => {
        dispatch(
            searchPatientsAsync({
                search: searchQuery,
                page: pagination.current,
                pageSize: pagination.pageSize,
            })
        )
    }

    const filteredPatients = useMemo(() => {
        if (!filterDuplicateOnly) return patients
        return patients.filter((p) => p.isDuplicateSuspect)
    }, [patients, filterDuplicateOnly])

    const columns = [
        {
            title: 'Mã hồ sơ',
            dataIndex: 'patientCode',
            key: 'patientCode',
            width: 140,
            render: (code, record) => (
                <div>
                    <span className="font-mono font-bold text-sky-700 block">{code || `BN-${record.id}`}</span>
                    {record.isDuplicateSuspect && (
                        <Tag color="red" className="text-[10px] mr-0 mt-0.5">
                            Trùng hồ sơ
                        </Tag>
                    )}
                </div>
            ),
        },
        {
            title: 'Họ và tên người bệnh',
            dataIndex: 'fullName',
            key: 'fullName',
            width: 220,
            render: (name, record) => (
                <div>
                    <span className="font-bold text-slate-900 block">{name}</span>
                    <span className="text-[11px] text-slate-400">
                        {record.gender === 'MALE' ? 'Nam' : record.gender === 'FEMALE' ? 'Nữ' : 'Khác'} •{' '}
                        {record.dob ? dayjs(record.dob).format('DD/MM/YYYY') : 'Chưa có ngày sinh'}
                    </span>
                </div>
            ),
        },
        {
            title: 'Liên hệ & Định danh',
            key: 'contact',
            render: (_, record) => (
                <div className="text-xs space-y-0.5">
                    <div>
                        SĐT: <strong>{record.phone}</strong>
                    </div>
                    <div className="text-slate-500">
                        CCCD: {record.identityCard || <span className="text-slate-400 italic">Chưa có</span>}
                    </div>
                    {record.address && (
                        <div className="text-slate-400 text-[11px] truncate max-w-xs">{record.address}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Lịch sử khám',
            key: 'historyStats',
            width: 140,
            render: (_, record) => {
                const appCount = appointments.filter(
                    (a) => (a.patientId && a.patientId === record.id) ||
                           (a.benh_nhan_id && a.benh_nhan_id === record.id) ||
                           (record.phone && a.so_dien_thoai === record.phone) ||
                           (record.patientCode && a.patientCode === record.patientCode)
                ).length
                const queueCount = queueEntries.filter(
                    (q) => (q.patientId && q.patientId === record.id) ||
                           (q.benh_nhan_id && q.benh_nhan_id === record.id) ||
                           (record.phone && q.phone === record.phone) ||
                           (record.patientCode && q.patientCode === record.patientCode)
                ).length
                return (
                    <div className="text-xs text-slate-600 space-y-0.5">
                        <div>
                            Lịch hẹn: <strong className="text-sky-700">{appCount}</strong>
                        </div>
                        <div>
                            Đã khám: <strong className="text-emerald-700">{queueCount}</strong>
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 170,
            align: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => setSelectedPatientId(record.id)}
                        className="text-xs"
                    >
                        Chi tiết
                    </Button>
                    <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => setEditPatient(record)}
                        className="text-xs"
                    >
                        Sửa
                    </Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="space-y-5">
            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide">Quản lý hồ sơ bệnh nhân (Master Patient Index)</h2>
                        <span className="text-xs text-slate-500">
                            Tra cứu hồ sơ hành chính từ CSDL, kiểm tra mã định danh, người đại diện và cảnh báo trùng lặp
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            icon={<SyncOutlined />}
                            onClick={() => {
                                dispatch(searchPatientsAsync({ search: searchQuery, page: 1, pageSize: 15 }))
                                dispatch(fetchAppointmentsAsync({ pageSize: 100 }))
                                dispatch(fetchFlowBoardAsync())
                            }}
                            className="medpro-btn-outline !h-8 !px-3 text-xs font-semibold"
                        >
                            Làm mới
                        </Button>
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={() => setIsCreateModalOpen(true)}
                            className="medpro-btn-primary !h-8 !px-4 text-xs font-bold"
                        >
                            Tạo hồ sơ mới
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                    <Input
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder="Tìm theo tên, SĐT, CCCD hoặc mã bệnh nhân..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full sm:w-80"
                        allowClear
                    />
                    <Button
                        type={filterDuplicateOnly ? 'primary' : 'default'}
                        danger={filterDuplicateOnly}
                        onClick={() => setFilterDuplicateOnly(!filterDuplicateOnly)}
                        icon={<WarningOutlined />}
                        className="text-xs font-semibold"
                    >
                        {filterDuplicateOnly ? 'Hiển thị tất cả' : 'Chỉ lọc hồ sơ nghi vấn trùng'}
                    </Button>
                </div>
            </div>

            <div className="medpro-card overflow-hidden">
                <Table
                    columns={columns}
                    dataSource={filteredPatients}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: patientPagination.page,
                        pageSize: patientPagination.pageSize,
                        total: patientPagination.totalItems,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng cộng ${total} bệnh nhân`,
                    }}
                    onChange={handleTableChange}
                    size="middle"
                    locale={{ emptyText: 'Chưa có hồ sơ bệnh nhân nào phù hợp' }}
                />
            </div>

            <PatientFormModal
                open={isCreateModalOpen || Boolean(editPatient)}
                editPatient={editPatient}
                onClose={() => {
                    setIsCreateModalOpen(false)
                    setEditPatient(null)
                }}
            />

            <PatientDetailDrawer
                patientId={selectedPatientId}
                open={Boolean(selectedPatientId)}
                onClose={() => setSelectedPatientId(null)}
                onEditClick={(pat) => {
                    setSelectedPatientId(null)
                    setEditPatient(pat)
                }}
                onNewAppointmentClick={(patId) => setNewAppPatientId(patId)}
            />

            <AppointmentFormModal
                open={Boolean(newAppPatientId)}
                defaultPatientId={newAppPatientId}
                onClose={() => setNewAppPatientId(null)}
            />
        </div>
    )
}
