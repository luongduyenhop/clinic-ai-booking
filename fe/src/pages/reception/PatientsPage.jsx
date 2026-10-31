import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Table, Input, Button, Tag, Space, Modal, Alert, Descriptions } from 'antd'
import {
    SearchOutlined,
    UserAddOutlined,
    EditOutlined,
    WarningOutlined,
    EyeOutlined,
    IdcardOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PatientFormModal from '../../components/reception/PatientFormModal'
import PatientDetailDrawer from '../../components/reception/PatientDetailDrawer'
import AppointmentFormModal from '../../components/reception/AppointmentFormModal'

export default function PatientsPage() {
    const { patients, appointments, queueEntries } = useSelector((state) => state.reception)

    const [searchQuery, setSearchQuery] = useState('')
    const [filterDuplicateOnly, setFilterDuplicateOnly] = useState(false)
    const [selectedPatientId, setSelectedPatientId] = useState(null)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editPatient, setEditPatient] = useState(null)
    const [newAppPatientId, setNewAppPatientId] = useState(null)

    // Filter patients
    const filteredPatients = useMemo(() => {
        return patients.filter((p) => {
            const matchesQuery =
                !searchQuery ||
                p.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                p.phone.includes(searchQuery.trim()) ||
                p.patientCode.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                (p.identityCard && p.identityCard.includes(searchQuery.trim()))

            const matchesDup = !filterDuplicateOnly || p.isDuplicateSuspect

            return matchesQuery && matchesDup
        })
    }, [patients, searchQuery, filterDuplicateOnly])

    const columns = [
        {
            title: 'Mã hồ sơ',
            dataIndex: 'patientCode',
            key: 'patientCode',
            width: 140,
            render: (code, record) => (
                <div>
                    <span className="font-mono font-bold text-sky-700 block">{code}</span>
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
                        {record.gender === 'MALE' ? 'Nam' : 'Nữ'} • {dayjs(record.dob).format('DD/MM/YYYY')}
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

                </div>
            ),
        },
        {
            title: 'Người đại diện / Bảo lãnh',
            key: 'guardian',
            render: (_, record) => (
                <div className="text-xs text-slate-600">
                    {record.guardianName ? (
                        <div>
                            <span className="font-medium text-slate-800">{record.guardianName}</span>
                            <span className="text-[11px] text-slate-400 block">{record.guardianPhone}</span>
                        </div>
                    ) : (
                        <span className="text-slate-400">Không có</span>
                    )}
                </div>
            ),
        },
        {
            title: 'Lịch sử khám',
            key: 'historyStats',
            width: 130,
            render: (_, record) => {
                const appCount = appointments.filter((a) => a.patientId === record.id).length
                const queueCount = queueEntries.filter((q) => q.patientId === record.id).length
                return (
                    <div className="text-xs text-slate-600 space-y-0.5">
                        <div>
                            Lịch hẹn: <strong>{appCount}</strong>
                        </div>
                        <div>
                            Đã khám: <strong>{queueCount}</strong>
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
            {/* Header & Search */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Quản lý hồ sơ bệnh nhân</h2>
                        <span className="text-xs text-slate-500">
                            Tra cứu hồ sơ hành chính, kiểm tra giấy tờ còn thiếu, người đại diện và cảnh báo trùng lặp
                        </span>
                    </div>
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-sky-600 font-semibold"
                    >
                        Tạo hồ sơ mới (RC-09)
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                    <Input
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder="Tìm theo tên, SĐT, CCCD hoặc mã bệnh nhân..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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
                        {filterDuplicateOnly ? 'Hiển thị tất cả' : 'Chỉ lọc hồ sơ nghi vấn trùng (RC-10)'}
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <Table
                    columns={columns}
                    dataSource={filteredPatients}
                    rowKey="id"
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    size="middle"
                    rowClassName={(record) => (record.isDuplicateSuspect ? 'bg-red-50/20' : '')}
                />
            </div>

            {/* Modals & Drawer */}
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
                onEditClick={(pat) => setEditPatient(pat)}
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
