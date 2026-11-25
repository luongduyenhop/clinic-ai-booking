import { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, Select, DatePicker, Input, Button, message, Alert, Spin, Tag, Card } from 'antd'
import { UserAddOutlined, UserOutlined, CheckCircleOutlined } from '../common/ClinicIcon'
import { useDispatch } from 'react-redux'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import dayjs from 'dayjs'
import { createAppointmentAsync, fetchAppointmentsAsync } from '../../redux/actions/reception/receptionAction'
import { receptionService } from '../../services/reception/receptionService'
import { unwrapApi, unwrapPagedApi } from '../../utils/helpers/apiHelper'
import PatientFormModal from './PatientFormModal'

export default function AppointmentFormModal({ open, onClose, defaultPatientId }) {
    const dispatch = useDispatch()

    const [specialtiesList, setSpecialtiesList] = useState([])
    const [loadingSpecialties, setLoadingSpecialties] = useState(false)

    const [departmentDoctors, setDepartmentDoctors] = useState([])
    const [loadingDoctors, setLoadingDoctors] = useState(false)

    const [patientList, setPatientList] = useState([])
    const [selectedPatientObj, setSelectedPatientObj] = useState(null)
    const [isSearchingPatient, setIsSearchingPatient] = useState(false)
    const [isCreatePatientOpen, setIsCreatePatientOpen] = useState(false)
    const searchTimeoutRef = useRef(null)

    const [doctorSlots, setDoctorSlots] = useState([])
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [slotError, setSlotError] = useState(null)

    const formik = useFormik({
        initialValues: {
            patientId: defaultPatientId || '',
            departmentId: '',
            doctorId: '',
            appointmentDate: dayjs().format('YYYY-MM-DD'),
            timeSlot: '',
            reason: '',
            symptoms: '',
        },
        enableReinitialize: true,
        validationSchema: Yup.object({
            patientId: Yup.mixed().required('Vui lòng chọn người bệnh'),
            departmentId: Yup.mixed().required('Vui lòng chọn chuyên khoa'),
            doctorId: Yup.mixed().required('Vui lòng chọn bác sĩ khám'),
            appointmentDate: Yup.string().required('Vui lòng chọn ngày khám'),
            timeSlot: Yup.string().required('Vui lòng chọn khung giờ khám'),
            reason: Yup.string().trim().required('Vui lòng nhập lý do khám'),
        }),
        onSubmit: async (values, { resetForm }) => {
            try {
                let rawTime = values.timeSlot || ''
                if (rawTime.includes(' - ')) {
                    rawTime = rawTime.split(' - ')[0]
                }
                const formattedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime

                const payload = {
                    benh_nhan_id: Number(values.patientId),
                    bac_si_id: Number(values.doctorId),
                    chuyen_khoa_id: values.departmentId ? Number(values.departmentId) : undefined,
                    ngay_kham: values.appointmentDate,
                    gio_kham: formattedTime,
                    ly_do_kham: values.reason.trim(),
                    trieu_chung_ban_dau: values.symptoms ? values.symptoms.trim() : undefined,
                }

                await dispatch(createAppointmentAsync({ payload })).unwrap()
                dispatch(fetchAppointmentsAsync())

                message.success('Đặt lịch hẹn khám cho bệnh nhân thành công!')
                resetForm()
                setSelectedPatientObj(null)
                setDoctorSlots([])
                setDepartmentDoctors([])
                onClose()
            } catch (err) {
                const errMsg = typeof err === 'string' ? err : err?.message || 'Lỗi khi đặt lịch hẹn'
                message.error(errMsg)
            }
        },
    })

    const fetchPatients = useCallback(async (query = '') => {
        setIsSearchingPatient(true)
        try {
            const res = await receptionService.searchPatients({
                search: query.trim() || undefined,
                page: 1,
                page_size: 20,
            })
            const paged = unwrapPagedApi(res, 20)
            const items = (paged.items || []).map((p) => ({
                id: p.id,
                patientCode: p.ma_dinh_danh_y_te || `BN-${p.id}`,
                fullName: p.ho_ten || p.fullName,
                phone: p.so_dien_thoai || p.phone,
                identityCard: p.cccd_so || p.identityCard,
                dob: p.ngay_sinh || p.dob,
                gender: p.gioi_tinh || p.gender,
            }))
            setPatientList(items)

            if (defaultPatientId && !selectedPatientObj) {
                const found = items.find((p) => String(p.id) === String(defaultPatientId))
                if (found) {
                    setSelectedPatientObj(found)
                }
            }
        } catch {
            setPatientList([])
        } finally {
            setIsSearchingPatient(false)
        }
    }, [defaultPatientId, selectedPatientObj])

    const loadSpecialties = useCallback(async () => {
        setLoadingSpecialties(true)
        try {
            const res = await receptionService.getSpecialties()
            const data = unwrapApi(res) || []
            setSpecialtiesList(
                data.map((s) => ({
                    id: s.id,
                    name: s.ten_chuyen_khoa || s.name,
                    code: s.ma_chuyen_khoa || s.code,
                    room: s.vi_tri_phong,
                    doctorCount: s.so_luong_bac_si || 0,
                }))
            )
        } catch {
            setSpecialtiesList([])
        } finally {
            setLoadingSpecialties(false)
        }
    }, [])

    useEffect(() => {
        if (open) {
            loadSpecialties()
            fetchPatients('')
        }
    }, [open, loadSpecialties, fetchPatients])

    const handlePatientSearch = (value) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }
        searchTimeoutRef.current = setTimeout(() => {
            fetchPatients(value)
        }, 350)
    }

    const handleSelectPatient = (val) => {
        formik.setFieldValue('patientId', val)
        const pat = patientList.find((p) => String(p.id) === String(val))
        setSelectedPatientObj(pat || null)
    }

    const fetchSlots = useCallback(async (docId, dateStr) => {
        if (!docId || !dateStr) {
            setDoctorSlots([])
            setSlotError(null)
            return
        }
        setLoadingSlots(true)
        setSlotError(null)
        try {
            const res = await receptionService.getDoctorSlots(docId, dateStr)
            const data = unwrapApi(res)
            const slots = data?.slots || []
            setDoctorSlots(slots)
            if (slots.length === 0) {
                setSlotError('Bác sĩ không có ca trực hoặc không còn khung giờ khả dụng trong ngày này.')
            }
        } catch (err) {
            setDoctorSlots([])
            setSlotError(err?.message || 'Bác sĩ không có ca trực trong ngày đã chọn.')
        } finally {
            setLoadingSlots(false)
        }
    }, [])

    const handleDepartmentChange = async (depId) => {
        formik.setFieldValue('departmentId', depId)
        formik.setFieldValue('doctorId', '')
        formik.setFieldValue('timeSlot', '')
        setDoctorSlots([])
        setSlotError(null)

        if (!depId) {
            setDepartmentDoctors([])
            return
        }

        setLoadingDoctors(true)

        try {
            const docsRes = await receptionService.getDoctors({
                specialty_id: Number(depId),
                page: 1,
                page_size: 100,
            })
            const data = unwrapApi(docsRes)
            const rawList = Array.isArray(data) ? data : data?.items || []
            const doctorsFound = rawList.map((d) => ({
                id: d.id,
                name: d.ho_ten || d.name,
                title: d.hoc_vi || '',
                room: d.vi_tri_phong || '',
                experience: d.nam_kinh_nghiem || 0,
                status: d.is_active === false ? 'ON_LEAVE' : 'AVAILABLE',
            }))
            setDepartmentDoctors(doctorsFound)

            if (doctorsFound.length === 1 && doctorsFound[0].status !== 'ON_LEAVE') {
                const singleDoc = doctorsFound[0]
                formik.setFieldValue('doctorId', singleDoc.id)
                if (formik.values.appointmentDate) {
                    fetchSlots(singleDoc.id, formik.values.appointmentDate)
                }
            }
        } catch {
            setDepartmentDoctors([])
        } finally {
            setLoadingDoctors(false)
        }
    }

    const handleDoctorChange = (docId) => {
        formik.setFieldValue('doctorId', docId)
        formik.setFieldValue('timeSlot', '')
        if (docId && formik.values.appointmentDate) {
            fetchSlots(docId, formik.values.appointmentDate)
        }
    }

    const handleDateChange = (date) => {
        const dateStr = date ? date.format('YYYY-MM-DD') : ''
        formik.setFieldValue('appointmentDate', dateStr)
        formik.setFieldValue('timeSlot', '')
        if (formik.values.doctorId && dateStr) {
            fetchSlots(formik.values.doctorId, dateStr)
        }
    }

    const slotOptions = doctorSlots.length > 0
        ? doctorSlots.map((slot) => {
            const isAvailable = slot.status === 'available' || slot.is_available === true
            const isBooked = slot.status === 'booked' || (slot.is_available === false && slot.status !== 'past')
            const isPast = slot.status === 'past'

            let labelSuffix = ''
            if (isAvailable) {
                labelSuffix = ''
            } else if (isBooked) {
                labelSuffix = ' (Đã kín)'
            } else if (isPast) {
                labelSuffix = ' (Đã qua)'
            } else {
                labelSuffix = ' (Hết chỗ)'
            }

            const slotValue = slot.time_val || (slot.time_str && slot.time_str.length === 5 ? `${slot.time_str}:00` : slot.time_str)

            return {
                value: slotValue,
                label: `${slot.time_str}${labelSuffix}`,
                disabled: !isAvailable,
            }
        })
        : []

    return (
        <>
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <UserOutlined className="text-clinic-cta" />
                        <span className="font-bold text-clinic-navy">Đặt lịch hẹn khám cho bệnh nhân (Lễ tân)</span>
                    </div>
                }
                open={open}
                onCancel={() => {
                    formik.resetForm()
                    setSelectedPatientObj(null)
                    setDoctorSlots([])
                    setSlotError(null)
                    setDepartmentDoctors([])
                    onClose()
                }}
                width={650}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button onClick={onClose}>Hủy bỏ</Button>
                        <Button
                            type="primary"
                            onClick={formik.handleSubmit}
                            className="medpro-btn-primary font-semibold"
                            loading={formik.isSubmitting}
                        >
                            Xác nhận đặt lịch
                        </Button>
                    </div>
                }
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4 py-2">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label htmlFor="af-patient" className="medpro-label !mb-0">
                                Bệnh nhân <span className="text-clinic-danger">*</span>
                            </label>
                            <Button
                                type="link"
                                size="small"
                                icon={<UserAddOutlined />}
                                onClick={() => setIsCreatePatientOpen(true)}
                                className="text-xs p-0 text-clinic-cta font-semibold"
                            >
                                + Thêm bệnh nhân mới
                            </Button>
                        </div>

                        <Select
                            id="af-patient"
                            showSearch
                            className="w-full"
                            placeholder="Gõ tên, SĐT, Mã BN hoặc CCCD để tìm kiếm..."
                            value={formik.values.patientId || undefined}
                            onChange={handleSelectPatient}
                            onSearch={handlePatientSearch}
                            filterOption={false}
                            loading={isSearchingPatient}
                            notFoundContent={
                                isSearchingPatient ? (
                                    <div className="text-center py-2"><Spin size="small" /> Đang tìm...</div>
                                ) : (
                                    <div className="text-center py-2 text-xs text-clinic-text-secondary">
                                        Không tìm thấy bệnh nhân. Bấm <strong>&ldquo;+ Thêm bệnh nhân mới&rdquo;</strong> để tạo hồ sơ.
                                    </div>
                                )
                            }
                            options={patientList.map((p) => ({
                                value: p.id,
                                label: `${p.patientCode} - ${p.fullName} (${p.phone || 'Chưa SĐT'})${p.identityCard ? ` - CCCD: ${p.identityCard}` : ''}`,
                            }))}
                            status={formik.touched.patientId && formik.errors.patientId ? 'error' : ''}
                        />
                        {formik.touched.patientId && formik.errors.patientId && (
                            <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.patientId}</span>
                        )}

                        {selectedPatientObj && (
                            <Card size="small" className="mt-2 bg-clinic-surface-tint border-clinic-info-border">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="space-y-0.5">
                                        <div className="font-bold text-clinic-navy flex items-center gap-2">
                                            <CheckCircleOutlined className="text-clinic-success" />
                                            <span>{selectedPatientObj.fullName}</span>
                                            <Tag color="blue" className="font-mono text-[10px] m-0 tabular-nums">
                                                {selectedPatientObj.patientCode}
                                            </Tag>
                                        </div>
                                        <div className="text-clinic-text-secondary text-[11px] flex gap-3 tabular-nums">
                                            <span>SĐT: <strong>{selectedPatientObj.phone || 'Chưa cập nhật'}</strong></span>
                                            {selectedPatientObj.identityCard && <span>CCCD: <strong>{selectedPatientObj.identityCard}</strong></span>}
                                            {selectedPatientObj.dob && <span>NS: <strong>{dayjs(selectedPatientObj.dob).format('DD/MM/YYYY')}</strong></span>}
                                        </div>
                                    </div>
                                    <Button
                                        size="small"
                                        type="text"
                                        className="text-xs text-clinic-text-muted hover:text-clinic-danger"
                                        onClick={() => {
                                            formik.setFieldValue('patientId', '')
                                            setSelectedPatientObj(null)
                                        }}
                                    >
                                        Đổi
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label htmlFor="af-department" className="medpro-label !mb-0">
                                    Chuyên khoa <span className="text-clinic-danger">*</span>
                                </label>
                                {loadingSpecialties && <Spin size="small" />}
                            </div>
                            <Select
                                id="af-department"
                                className="w-full"
                                placeholder={loadingSpecialties ? 'Đang tải chuyên khoa...' : 'Chọn chuyên khoa khám'}
                                value={formik.values.departmentId || undefined}
                                onChange={handleDepartmentChange}
                                onBlur={() => formik.setFieldTouched('departmentId', true)}
                                loading={loadingSpecialties}
                                options={specialtiesList.map((d) => ({
                                    value: d.id,
                                    label: `${d.name} (${d.doctorCount || 0} BS)`,
                                }))}
                                status={formik.touched.departmentId && formik.errors.departmentId ? 'error' : ''}
                            />
                            {formik.touched.departmentId && formik.errors.departmentId && (
                                <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.departmentId}</span>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label htmlFor="af-doctor" className="medpro-label !mb-0">
                                    Bác sĩ phụ trách <span className="text-clinic-danger">*</span>
                                </label>
                                {loadingDoctors && <Spin size="small" />}
                            </div>
                            <Select
                                id="af-doctor"
                                className="w-full"
                                placeholder={
                                    loadingDoctors
                                        ? 'Đang tải danh sách bác sĩ...'
                                        : !formik.values.departmentId
                                          ? 'Chọn chuyên khoa trước'
                                          : departmentDoctors.length === 0
                                            ? 'Khoa này chưa có bác sĩ'
                                            : 'Chọn bác sĩ khám'
                                }
                                value={formik.values.doctorId || undefined}
                                onChange={handleDoctorChange}
                                onBlur={() => formik.setFieldTouched('doctorId', true)}
                                disabled={!formik.values.departmentId || loadingDoctors}
                                options={departmentDoctors.map((d) => ({
                                    value: d.id,
                                    label: `${d.title ? `${d.title} ` : ''}${d.name} ${d.status === 'ON_LEAVE' ? '(Nghỉ)' : ''}`,
                                    disabled: d.status === 'ON_LEAVE',
                                }))}
                                status={formik.touched.doctorId && formik.errors.doctorId ? 'error' : ''}
                            />
                            {formik.touched.doctorId && formik.errors.doctorId && (
                                <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.doctorId}</span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="af-date" className="medpro-label">
                                Ngày khám <span className="text-clinic-danger">*</span>
                            </label>
                            <DatePicker
                                id="af-date"
                                className="w-full"
                                format="DD/MM/YYYY"
                                value={formik.values.appointmentDate ? dayjs(formik.values.appointmentDate) : null}
                                onChange={handleDateChange}
                                onBlur={() => formik.setFieldTouched('appointmentDate', true)}
                                disabledDate={(current) => current && current < dayjs().startOf('day')}
                                status={formik.touched.appointmentDate && formik.errors.appointmentDate ? 'error' : ''}
                            />
                            {formik.touched.appointmentDate && formik.errors.appointmentDate && (
                                <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.appointmentDate}</span>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label htmlFor="af-slot" className="medpro-label !mb-0">
                                    Khung giờ khám (Slot 30p) <span className="text-clinic-danger">*</span>
                                </label>
                                {loadingSlots && <Spin size="small" />}
                            </div>
                            <Select
                                id="af-slot"
                                className="w-full"
                                placeholder={
                                    loadingSlots
                                        ? 'Đang kiểm tra slot trống...'
                                        : !formik.values.doctorId
                                          ? 'Chọn bác sĩ trước'
                                          : slotOptions.length === 0
                                            ? 'Không có khung giờ trống'
                                            : 'Chọn khung giờ khám'
                                }
                                value={formik.values.timeSlot || undefined}
                                onChange={(slot) => formik.setFieldValue('timeSlot', slot)}
                                onBlur={() => formik.setFieldTouched('timeSlot', true)}
                                options={slotOptions}
                                disabled={!formik.values.doctorId || !formik.values.appointmentDate || loadingSlots}
                                status={formik.touched.timeSlot && formik.errors.timeSlot ? 'error' : ''}
                            />
                            {formik.touched.timeSlot && formik.errors.timeSlot && (
                                <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.timeSlot}</span>
                            )}
                        </div>
                    </div>

                    {slotError && (
                        <Alert
                            message="Thông báo ca khám"
                            description={slotError}
                            type="info"
                            showIcon
                            className="text-xs"
                        />
                    )}

                    <div>
                        <label htmlFor="af-reason" className="medpro-label">
                            Lý do khám <span className="text-clinic-danger">*</span>
                        </label>
                        <Input
                            id="af-reason"
                            placeholder="Ví dụ: Tức ngực, đau đầu, tái khám theo hẹn..."
                            value={formik.values.reason}
                            onChange={(e) => formik.setFieldValue('reason', e.target.value)}
                            onBlur={() => formik.setFieldTouched('reason', true)}
                            status={formik.touched.reason && formik.errors.reason ? 'error' : ''}
                        />
                        {formik.touched.reason && formik.errors.reason && (
                            <span className="text-clinic-danger text-xs mt-0.5 block">{formik.errors.reason}</span>
                        )}
                    </div>

                    <div>
                        <label htmlFor="af-symptoms" className="medpro-label">
                            Triệu chứng ban đầu <span className="text-clinic-text-muted font-normal">(tùy chọn)</span>
                        </label>
                        <Input.TextArea
                            id="af-symptoms"
                            rows={2}
                            placeholder="Mô tả triệu chứng ban đầu (VD: Bắt đầu xuất hiện từ 2 ngày trước, kèm sốt nhẹ...)"
                            value={formik.values.symptoms}
                            onChange={(e) => formik.setFieldValue('symptoms', e.target.value)}
                        />
                    </div>
                </form>
            </Modal>

            <PatientFormModal
                open={isCreatePatientOpen}
                onClose={() => setIsCreatePatientOpen(false)}
                onCreatedSuccess={(newPatient) => {
                    if (newPatient) {
                        const formatted = {
                            id: newPatient.id,
                            patientCode: newPatient.ma_dinh_danh_y_te || `BN-${newPatient.id}`,
                            fullName: newPatient.ho_ten || newPatient.fullName,
                            phone: newPatient.so_dien_thoai || newPatient.phone,
                            identityCard: newPatient.cccd_so || newPatient.identityCard,
                            dob: newPatient.ngay_sinh || newPatient.dob,
                            gender: newPatient.gioi_tinh || newPatient.gender,
                        }
                        setPatientList((prev) => [formatted, ...prev])
                        formik.setFieldValue('patientId', formatted.id)
                        setSelectedPatientObj(formatted)
                    }
                }}
            />
        </>
    )
}
