import { useState, useMemo, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../services/admin/clinicSeedData'
import {
    StatusBadge,
    EmptyState,
    Stethoscope,
    LockKey,
    PencilSimple,
    FloppyDisk,
    CheckCircle,
    ClipboardText,
    Pill,
    Printer,
    Trash,
    Signature,
    UploadSimple,
    Warning,
    XCircle,
    MagnifyingGlass,
    Plus,
    Check,
    X,
    Scales,
    Sparkle,
    CaretLeft,
    CaretRight,
    CaretDown,
    Clock,
    Pulse,
    Eye,
    Tooth,
    Ear,
    FirstAidKit,
    Heartbeat,
    ClinicIcon,
} from '../../components/common/ClinicIcon'

const DEPARTMENTS = [
    { id: 'CHUNG', label: 'Khám chung & Sinh hiệu', icon: 'Stethoscope' },
    { id: 'NOI', label: 'Khoa Nội (Tim mạch/Hô hấp)', icon: 'Heartbeat' },
    { id: 'NGOAI', label: 'Khoa Ngoại & Tiểu phẫu', icon: 'FirstAidKit' },
    { id: 'MAT', label: 'Khoa Mắt (Nhãn khoa)', icon: 'Eye' },
    { id: 'TMH', label: 'Khoa Tai Mũi Họng', icon: 'Ear' },
    { id: 'RHM', label: 'Khoa Răng Hàm Mặt', icon: 'Tooth' },
]

const defaultSpecialtyData = {
    noiKhoa: {
        tuanHoan: 'T1, T2 rõ, đều, không âm thổi bệnh lý',
        hoHap: 'Rì rào phế nang 2 phế trường êm dịu, không rale',
        tieuHoa: 'Bụng mềm, gan lách không to, không sờ thấy u bướu, không điểm đau khu trú',
        thanKinh: 'Tỉnh táo, tiếp xúc tốt, Glasgow 15đ, không dấu thần kinh khu trú',
        coXuongKhop: 'Vận động các khớp bình thường, không biến dạng, không sưng nóng đỏ',
    },
    ngoaiKhoa: {
        khamNgoaiTongQuat: 'Thể trạng trung bình, da niêm hồng, không phù ngoại vi',
        vetMoVetThuong: 'Không có vết thương hở, vết mổ cũ liền sẹo tốt',
        uBuouHach: 'Không sờ thấy hạch ngoại vi bất thường ở cổ, nách, bẹn',
        thoatVi: 'Thành bụng chắc, lỗ bẹn nông 2 bên không phồng giãn khi rặn',
        tieuPhauDeNghi: 'Chưa có chỉ định can thiệp phẫu thuật / thủ thuật ngoại khoa',
    },
    mat: {
        thiLucKhongKinhP: '10/10',
        thiLucKhongKinhT: '10/10',
        thiLucCoKinhP: '10/10',
        thiLucCoKinhT: '10/10',
        nhanApP: '16',
        nhanApT: '16',
        ketMac: 'Kết mạc 2 mắt bình thường, không sung huyết, không xuất huyết',
        giacMac: 'Giác mạc trong suốt, biểu mô nguyên vẹn',
        tienPhong: 'Tiền phòng sâu sạch, không ngấn mủ',
        dongTu: 'Đồng tử tròn đều 2.5mm, phản xạ ánh sáng (+)',
        theThuyTinh: 'Thể thủy tinh trong suốt, chưa phát hiện đục',
        dayMat: 'Gai thị hồng, bờ rõ, tỷ lệ C/D 0.3, mạch máu bình thường',
    },
    tmh: {
        taiPhai: 'Màng nhĩ sáng bóng, nón sáng rõ, không đọng dịch',
        taiTrai: 'Màng nhĩ sáng bóng, nón sáng rõ, không co kéo, không thủng',
        mui: 'Hốc mũi thoáng, niêm mạc hồng hào, cuốn mũi dưới không phì đại, vách ngăn thẳng',
        hong: 'Niêm mạc họng hồng hào, không có hạt lympho xung huyết',
        amidan: 'Amidan 2 bên không quá phát (Độ 0), không hốc mủ',
        thanhQuan: 'Dây thanh âm trắng bóng, di động khép mở bình thường',
    },
    rhm: {
        teethStatus: {
            '18': 'BT', '17': 'BT', '16': 'BT', '15': 'BT', '14': 'BT', '13': 'BT', '12': 'BT', '11': 'BT',
            '21': 'BT', '22': 'BT', '23': 'BT', '24': 'BT', '25': 'BT', '26': 'BT', '27': 'BT', '28': 'BT',
            '48': 'BT', '47': 'BT', '46': 'BT', '45': 'BT', '44': 'BT', '43': 'BT', '42': 'BT', '41': 'BT',
            '31': 'BT', '32': 'BT', '33': 'BT', '34': 'BT', '35': 'BT', '36': 'BT', '37': 'BT', '38': 'BT',
        },
        selectedTooth: '16',
        nuouLoi: 'Nướu hồng hào, săn chắc, gai nướu ôm sát cổ răng',
        caoRang: 'Độ 1 (Có ít mảng bám vôi răng mặt trong)',
        chayMauKhamBOP: 'Âm tính (-)',
        khopCan: 'Khớp cắn Loại I (Bình thường)',
        khopThaiDuongHam: 'Há miệng bình thường (4cm), không có tiếng lục cục, không đau',
    },
}

export default function ClinicalExamPage() {
    const dispatch = useDispatch()
    const { clinicData } = useSelector((state) => state.app.admin)

    const registrations = clinicData?.registrations || []
    const icdCatalog = clinicData?.catalogs?.danhMucBenh || []
    const serviceCatalog = clinicData?.catalogs?.dichVu || []
    const drugCatalog = clinicData?.catalogs?.thuocVatTu || []
    const templates = clinicData?.templates || []
    const healthCheckupTemplates = clinicData?.healthCheckupClassifications || []

    const [classifications, setClassifications] = useState(() => healthCheckupTemplates)
    const [overallClassification, setOverallClassification] = useState('Loại I')

    const masterOptions = getMasterOptions(clinicData)
    const defaults = getFormDefaults(clinicData)
    const fsmSteps = masterOptions.prescriptionFsmSteps || []
    const serviceCategoryTabs = masterOptions.serviceOrderCategoryTabs || ['Tất cả', 'Khám bệnh', 'Siêu âm', 'X-Quang']

    const packageTemplates = useMemo(
        () => templates.filter((t) => t.loaiMau === 'ke-goi-dich-vu'),
        [templates]
    )
    const prescriptionTemplates = useMemo(
        () => templates.filter((t) => t.loaiMau === 'don-thuoc-mau'),
        [templates]
    )

    const location = useLocation()
    const navigate = useNavigate()
    const queryTab = new URLSearchParams(location.search).get('tab')
    const queryDept = new URLSearchParams(location.search).get('dept')

    const [searchText, setSearchText] = useState('')
    const [activeSubTab, setActiveSubTab] = useState(() => {
        if (queryTab === 'KE_DICH_VU') return 'KE_DICH_VU'
        if (queryTab === 'KHAM_SUC_KHOE') return 'KHAM_SUC_KHOE'
        return 'KHAM_BENH'
    })
    const [selectedDept, setSelectedDept] = useState('CHUNG')

    useEffect(() => {
        const deptKeyMap = {
            NOI: 'noi-khoa',
            NGOAI: 'ngoai-khoa',
            MAT: 'mat',
            TMH: 'tai-mui-hong',
            RHM: 'rang-ham-mat',
        }
        if (queryDept && deptKeyMap[queryDept]) {
            navigate(`/admin/kham-chuyen-khoa/${deptKeyMap[queryDept]}`, { replace: true })
            return
        }
        if (queryTab === 'KE_DICH_VU') {
            setActiveSubTab('KE_DICH_VU')
        } else if (queryTab === 'KHAM_SUC_KHOE') {
            setActiveSubTab('KHAM_SUC_KHOE')
        } else if (queryTab === 'KHAM_BENH' || (!queryTab && !queryDept)) {
            setActiveSubTab('KHAM_BENH')
        }
    }, [queryTab, queryDept, navigate])

    const [selectedRegId, setSelectedRegId] = useState(registrations[0]?.id || '')
    const [isQueueCollapsed, setIsQueueCollapsed] = useState(false)
    const [isPatientInfoCollapsed, setIsPatientInfoCollapsed] = useState(false)
    const [doseMorning, setDoseMorning] = useState('1')
    const [doseNoon, setDoseNoon] = useState('0')
    const [doseAfternoon, setDoseAfternoon] = useState('1')
    const [doseNight, setDoseNight] = useState('0')
    const [followUpDate, setFollowUpDate] = useState('2026-10-19')
    const [followUpNotes, setFollowUpNotes] = useState('Tái khám theo hẹn hoặc khi có triệu chứng đau tức ngực bất thường')
    const [primaryIcdCode, setPrimaryIcdCode] = useState('I10')

    const currentExam = useMemo(() => {
        return registrations.find((r) => r.id === selectedRegId) || registrations[0] || null
    }, [registrations, selectedRegId])

    const currentIndex = useMemo(() => {
        return registrations.findIndex((r) => r.id === currentExam?.id)
    }, [registrations, currentExam?.id])
    const hasPrev = currentIndex > 0
    const hasNext = currentIndex >= 0 && currentIndex < registrations.length - 1

    const [vitals, setVitals] = useState(() => currentExam?.vitals || {})
    const [notes, setNotes] = useState(() => currentExam?.clinicalNotes || {})
    const [icdList, setIcdList] = useState(() => currentExam?.icdList || [])
    const [services, setServices] = useState(() => currentExam?.services || [])
    const [specialtyData, setSpecialtyData] = useState(() => currentExam?.specialtyExams || defaultSpecialtyData)
    useEffect(() => {
        if (currentExam) {
            setSpecialtyData(currentExam.specialtyExams || defaultSpecialtyData)
        }
    }, [currentExam?.id])

    const [prescription, setPrescription] = useState(
        () =>
            currentExam?.prescription || {
                maDon: 'DTQG-2026-NEW',
                trangThaiFSM: 'DRAFT',
                maLienThongQuocGia: '',
                ngayKy: '',
                loiDanBacSi: '',
                items: [],
            }
    )

    // Popups & Modals
    const [selectedIcdCode, setSelectedIcdCode] = useState(icdCatalog[0]?.maICD || 'I10')
    const [icdNote, setIcdNote] = useState('Bệnh chính')
    const [showServiceModal, setShowServiceModal] = useState(false)
    const [serviceCategoryFilter, setServiceCategoryFilter] = useState(serviceCategoryTabs[0] || 'Tất cả')
    const [showAmendmentModal, setShowAmendmentModal] = useState(false)
    const [amendmentReason, setAmendmentReason] = useState('')

    // New Drug Input Row
    const [selectedDrugId, setSelectedDrugId] = useState(drugCatalog[0]?.maThuoc || 'TH001')
    const [drugQty, setDrugQty] = useState(14)
    const [drugDosage, setDrugDosage] = useState('Ngày uống 2 viên chia 2 lần Sáng - Chiều sau ăn')

    const handleSelectPatientQueue = (reg) => {
        setSelectedRegId(reg.id)
        setVitals(reg.vitals || {})
        setNotes(reg.clinicalNotes || {})
        setIcdList(reg.icdList || [])
        setServices(reg.services || [])
        setSpecialtyData(reg.specialtyExams || defaultSpecialtyData)
        setPrescription(
            reg.prescription || {
                maDon: `DTQG-2026-${reg.maKCB}`,
                trangThaiFSM: 'DRAFT',
                maLienThongQuocGia: '',
                ngayKy: '',
                loiDanBacSi: '',
                items: [],
            }
        )
    }

    const handlePrevPatient = () => {
        if (hasPrev) {
            handleSelectPatientQueue(registrations[currentIndex - 1])
        }
    }

    const handleNextPatient = () => {
        if (hasNext) {
            handleSelectPatientQueue(registrations[currentIndex + 1])
        }
    }

    // Keyboard shortcuts (Alt+1...3, Alt+Left/Right)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey) {
                if (e.key === '1') {
                    e.preventDefault()
                    setActiveSubTab('KHAM_BENH')
                } else if (e.key === '2') {
                    e.preventDefault()
                    setActiveSubTab('KE_DICH_VU')
                } else if (e.key === '3') {
                    e.preventDefault()
                    setActiveSubTab('KHAM_SUC_KHOE')
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    handlePrevPatient()
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    handleNextPatient()
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, hasPrev, hasNext, registrations])

    const saveCurrentExamState = async (patch = {}, auditAction = 'UPDATE_CLINICAL_EXAM', auditPurpose = 'Cập nhật hồ sơ khám bệnh') => {
        if (!currentExam) return
        const updatedExam = {
            ...currentExam,
            vitals,
            clinicalNotes: notes,
            icdList,
            services,
            prescription,
            specialtyExams: specialtyData,
            ...patch,
        }
        const updatedList = registrations.map((r) => (r.id === currentExam.id ? updatedExam : r))
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'registrations',
                items: updatedList,
                auditEntry: {
                    hanhDong: auditAction,
                    doiTuong: `HSBA ${currentExam.maKCB} - BN ${currentExam.hoTen}`,
                    mucDich: auditPurpose,
                },
            })
        )
    }

    const handleAddIcd = () => {
        if (currentExam?.emrLocked) {
            AppToast.warning('Bệnh án đã khóa (INT-03)! Vui lòng lập Biên bản đính chính nếu cần bổ sung.')
            return
        }
        const found = icdCatalog.find((i) => i.maICD === selectedIcdCode)
        if (!found) return
        if (icdList.some((x) => x.maICD === found.maICD)) {
            AppToast.info('Mã bệnh ICD-10 này đã có trong danh sách chẩn đoán!')
            return
        }
        setIcdList([...icdList, { maICD: found.maICD, tenBenh: found.tenBenh, dienGiai: icdNote }])
        if (found.truyenNhiem) {
            AppToast.warning(
                `CẢNH BÁO DỊCH TỄ (LAW-01): Mã bệnh ${found.maICD} (${found.tenBenh}) thuộc danh mục bệnh truyền nhiễm cần báo cáo giám sát!`
            )
        }
    }

    const handleRemoveIcd = (maICD) => {
        if (currentExam?.emrLocked) {
            AppToast.warning('Bệnh án đã khóa bất biến (INT-03)!')
            return
        }
        setIcdList(icdList.filter((i) => i.maICD !== maICD))
    }

    const handleAddServiceFromCatalog = (srv) => {
        if (services.some((s) => s.maDV === srv.maDV)) {
            AppToast.info(`Dịch vụ "${srv.tenDV}" đã có trong phiếu chỉ định!`)
            return
        }
        const newOrder = {
            id: `SRV-${Date.now().toString().slice(-4)}`,
            maDV: srv.maDV,
            tenDV: srv.tenDV,
            dvt: srv.dvt,
            soLuong: 1,
            donGia: srv.donGia,
            thanhTien: srv.donGia,
            phongTH: srv.phongTH,
            trangThaiCLS: 'Chờ thực hiện',
        }
        setServices((prev) => [...prev, newOrder])
        AppToast.success(`Đã chỉ định dịch vụ: ${srv.tenDV}`)
    }

    const handleApplyServicePackage = (pkg) => {
        if (!pkg?.services) return
        const merged = [...services]
        pkg.services.forEach((s) => {
            if (!merged.some((existing) => existing.maDV === s.maDV)) {
                merged.push({
                    id: `SRV-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
                    ...s,
                    thanhTien: s.donGia * (s.soLuong || 1),
                    trangThaiCLS: 'Chờ thực hiện',
                })
            }
        })
        setServices(merged)
        AppToast.success(`Đã áp dụng ${pkg.tenMau} (${pkg.services.length} dịch vụ)!`)
    }

    const isPrescriptionImmutable = ['SIGNED', 'ISSUED', 'SUBMISSION_PENDING', 'SUBMITTED', 'ACCEPTED'].includes(
        prescription.trangThaiFSM
    )

    const handleAddDrug = () => {
        if (isPrescriptionImmutable) {
            AppToast.error(
                `CHẶN SỬA ĐƠN THUỐC (INT-04): Đơn thuốc đã ở trạng thái ${prescription.trangThaiFSM}. Không thể sửa trực tiếp thuốc đã ký số!`
            )
            return
        }
        const drug = drugCatalog.find((d) => d.maThuoc === selectedDrugId)
        if (!drug) return
        const calculatedDose = `Sáng: ${doseMorning || '0'}, Trưa: ${doseNoon || '0'}, Chiều: ${doseAfternoon || '0'}, Tối: ${doseNight || '0'} ${drug.dvt || 'viên'}`
        const newItem = {
            id: `RX-${Date.now().toString().slice(-4)}`,
            maThuoc: drug.maThuoc,
            tenThuoc: drug.tenThuoc,
            hoatChat: drug.hoatChat,
            dvt: drug.dvt,
            sang: doseMorning || '1',
            trua: doseNoon || '0',
            chieu: doseAfternoon || '1',
            toi: doseNight || '0',
            soLuong: Number(drugQty) || 14,
            lieuDung: drugDosage || calculatedDose,
            ghiChu: drug.nhomThuoc,
        }
        setPrescription({
            ...prescription,
            items: [...(prescription.items || []), newItem],
        })
        AppToast.success(`Đã thêm thuốc: ${drug.tenThuoc}`)
    }

    const handleApplySamplePrescription = (sample) => {
        if (isPrescriptionImmutable) {
            AppToast.error('Đơn thuốc đã ký số, không thể ghi đè bằng đơn thuốc mẫu!')
            return
        }
        if (!sample?.items) return
        const mapped = sample.items.map((item, idx) => ({
            id: `RX-SMP-${idx + 1}`,
            sang: item.sang || '1',
            trua: item.trua || '0',
            chieu: item.chieu || '1',
            toi: item.toi || '0',
            ...item,
        }))
        setPrescription({
            ...prescription,
            items: mapped,
        })
        AppToast.success(`Đã nạp ${sample.tenMau}!`)
    }

    const handleTransitionPrescriptionFSM = async (nextState) => {
        const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16)
        const updatedRx = {
            ...prescription,
            trangThaiFSM: nextState,
            ngayKy: nextState === 'SIGNED' ? nowStr : prescription.ngayKy,
            maLienThongQuocGia:
                nextState === 'ACCEPTED'
                    ? `VN-RX-${Math.floor(1000000 + Math.random() * 9000000)}-A`
                    : prescription.maLienThongQuocGia,
        }
        setPrescription(updatedRx)
        await saveCurrentExamState(
            { prescription: updatedRx },
            `PRESCRIPTION_FSM_${nextState}`,
            `Chuyển trạng thái Đơn thuốc điện tử sang ${nextState} theo Thông tư 26/2025/TT-BYT`
        )
        AppToast.success(`Trạng thái Đơn thuốc Quốc gia đã chuyển sang: ${nextState}`)
    }

    const handleFinishAndLockEMR = async () => {
        await saveCurrentExamState(
            { trangThai: 'Đã khám', emrLocked: true },
            'LOCK_EMR_RECORD',
            'Hoàn thành khám lâm sàng & Khóa Hồ sơ bệnh án điện tử bất biến (INT-03)'
        )
        AppToast.success('Đã hoàn thành ca khám và Khóa Bệnh án điện tử (INT-03)!')
    }

    const handleCreateAmendment = async () => {
        if (!amendmentReason.trim()) {
            AppToast.warning('Vui lòng nhập Lý do đính chính bệnh án!')
            return
        }
        const newAmendment = {
            id: `BBDC-${Date.now().toString().slice(-4)}`,
            thoiGian: new Date().toISOString().replace('T', ' ').slice(0, 16),
            nguoiLap: currentExam?.bacSi || defaults.defaultDoctor,
            lyDo: amendmentReason,
            noiDungCu: notes.chanDoanXacDinh,
        }
        const history = [...(currentExam?.amendmentHistory || []), newAmendment]
        await saveCurrentExamState(
            { emrLocked: false, amendmentHistory: history },
            'AMEND_EMR_WITH_HISTORY',
            `Lập Biên bản đính chính bệnh án có lưu vết lịch sử: ${amendmentReason}`
        )
        setShowAmendmentModal(false)
        setAmendmentReason('')
        AppToast.success('Đã lập Biên bản đính chính (lưu lịch sử gốc) và mở khóa đính chính có kiểm soát!')
    }

    const totalServiceCost = services.reduce((sum, s) => sum + (Number(s.thanhTien) || 0), 0)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* LEFT PANEL (Queue): Danh sách bệnh nhân chờ khám / đang khám */}
            <div
                className={`medpro-card p-3 flex flex-col h-[calc(100vh-88px)] transition-all duration-200 ${
                    isQueueCollapsed ? 'hidden' : 'lg:col-span-3'
                }`}
            >
                <div className="medpro-section-title !mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#003553]">
                        <Stethoscope size={15} weight="duotone" className="text-[#00B5F1]" />
                        <span>HÀNG ĐỢI ({registrations.length})</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsQueueCollapsed(true)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#003553] transition cursor-pointer"
                        title="Thu gọn hàng đợi (mở rộng vùng làm việc)"
                    >
                        <CaretLeft size={16} weight="bold" />
                    </button>
                </div>

                <div className="mb-2 relative">
                    <MagnifyingGlass
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Tìm Mã KCB, Họ tên, SĐT..."
                        className="medpro-input !pl-8 text-xs !py-1.5"
                    />
                </div>

                <div className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl no-scrollbar">
                    <table className="medpro-table text-xs">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Mã KCB</th>
                                <th>Họ tên</th>
                                <th>Tuổi</th>
                                <th className="text-center">TT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registrations
                                .filter(
                                    (r) =>
                                        !searchText ||
                                        r.hoTen.toLowerCase().includes(searchText.toLowerCase()) ||
                                        r.maKCB.includes(searchText)
                                )
                                .map((r, idx) => (
                                    <tr
                                        key={r.id}
                                        onClick={() => handleSelectPatientQueue(r)}
                                        className={`cursor-pointer ${
                                            currentExam?.id === r.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                        }`}
                                    >
                                        <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                        <td className="font-mono text-[10.5px] font-bold text-[#00B5F1]">{r.maKCB}</td>
                                        <td className="font-semibold text-[#12263F] truncate max-w-[100px]">
                                            {r.hoTen}
                                            {r.emrLocked && (
                                                <LockKey
                                                    size={12}
                                                    weight="fill"
                                                    className="inline ml-1 text-emerald-600"
                                                    title="Hồ sơ bệnh án đã khóa bất biến"
                                                />
                                            )}
                                        </td>
                                        <td>{r.tuoi}</td>
                                        <td className="text-center">
                                            <StatusBadge status={r.trangThai} showText={false} />
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* RIGHT PANEL: Workspace (Expands to 100% when queue is collapsed) */}
            <div
                className={`medpro-card p-4 space-y-3.5 transition-all duration-200 ${
                    isQueueCollapsed ? 'lg:col-span-12' : 'lg:col-span-9'
                }`}
            >
                {/* tClinic Unified Top Bar: Patient Prev/Next + Top Workflow Tabs + Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E2EDF5]">
                    <div className="flex flex-wrap items-center gap-2">
                        {isQueueCollapsed && (
                            <button
                                type="button"
                                onClick={() => setIsQueueCollapsed(false)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#E8F4FD] text-[#003553] hover:bg-[#00B5F1] hover:text-white transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Mở lại danh sách hàng đợi khám"
                            >
                                <CaretRight size={13} weight="bold" />
                                <span>Hàng đợi ({registrations.length})</span>
                            </button>
                        )}

                        {/* 1-Click Patient Prev/Next Switcher (tClinic style) */}
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            <button
                                type="button"
                                disabled={!hasPrev}
                                onClick={handlePrevPatient}
                                className="px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-0.5 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-white text-[#003553] cursor-pointer"
                                title="Chuyển sang ca trước (Alt + Mũi tên trái)"
                            >
                                <CaretLeft size={13} weight="bold" />
                                <span className="hidden sm:inline">Trước</span>
                            </button>
                            <span className="text-xs text-slate-500 font-bold px-1.5 tabular-nums">
                                {currentIndex + 1}/{registrations.length}
                            </span>
                            <button
                                type="button"
                                disabled={!hasNext}
                                onClick={handleNextPatient}
                                className="px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-0.5 disabled:opacity-35 disabled:cursor-not-allowed bg-white shadow-2xs text-[#00B5F1] hover:bg-[#E8F4FD] cursor-pointer"
                                title="Chuyển sang ca tiếp theo (Alt + Mũi tên phải)"
                            >
                                <span className="hidden sm:inline">Tiếp</span>
                                <CaretRight size={13} weight="bold" />
                            </button>
                        </div>

                        {/* 2 Main Workflow Tabs (Matching demo.tclinic.io) */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setActiveSubTab('KHAM_BENH')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    activeSubTab === 'KHAM_BENH'
                                        ? 'bg-white text-[#003553] shadow-xs'
                                        : 'text-slate-500 hover:text-[#003553]'
                                }`}
                            >
                                <Stethoscope size={15} weight={activeSubTab === 'KHAM_BENH' ? 'fill' : 'duotone'} className={activeSubTab === 'KHAM_BENH' ? 'text-[#00B5F1]' : ''} />
                                <span>Khám bệnh</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSubTab('KE_DICH_VU')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    activeSubTab === 'KE_DICH_VU'
                                        ? 'bg-white text-[#003553] shadow-xs'
                                        : 'text-slate-500 hover:text-[#003553]'
                                }`}
                            >
                                <ClipboardText size={15} weight={activeSubTab === 'KE_DICH_VU' ? 'fill' : 'duotone'} className={activeSubTab === 'KE_DICH_VU' ? 'text-[#00B5F1]' : ''} />
                                <span>Kê dịch vụ (F7)</span>
                                {services.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#00B5F1] text-white">
                                        {services.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSubTab('KHAM_SUC_KHOE')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    activeSubTab === 'KHAM_SUC_KHOE'
                                        ? 'bg-white text-[#003553] shadow-xs'
                                        : 'text-slate-500 hover:text-[#003553]'
                                }`}
                            >
                                <Scales size={15} weight={activeSubTab === 'KHAM_SUC_KHOE' ? 'fill' : 'duotone'} className={activeSubTab === 'KHAM_SUC_KHOE' ? 'text-[#00B5F1]' : ''} />
                                <span>Sức khỏe (TT 32)</span>
                            </button>
                        </div>
                    </div>

                    {/* Top Action Buttons (Matching tClinic: Lịch sử F8, Lưu tạm F5, Hoàn thành khám) */}
                    <div className="flex flex-wrap items-center gap-2">
                        {currentExam?.amendmentHistory?.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowAmendmentModal(true)}
                                className="medpro-btn-outline !py-1 !px-2.5 text-xs text-amber-700 border-amber-300"
                                title="Lịch sử đính chính bệnh án (F8)"
                            >
                                <Clock size={14} weight="duotone" />
                                <span>Lịch sử (F8)</span>
                            </button>
                        )}
                        {currentExam?.emrLocked ? (
                            <button
                                type="button"
                                onClick={() => setShowAmendmentModal(true)}
                                className="medpro-btn-amber text-xs font-bold"
                            >
                                <PencilSimple size={14} weight="bold" />
                                <span>Lập Biên bản Đính chính (INT-03)</span>
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        saveCurrentExamState()
                                        AppToast.success('Đã lưu dữ liệu khám bệnh!')
                                    }}
                                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                                >
                                    <FloppyDisk size={14} weight="duotone" className="text-[#00B5F1]" />
                                    <span>Lưu tạm (F5)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFinishAndLockEMR}
                                    className="medpro-btn-primary !py-1.5 !px-3.5 text-xs"
                                >
                                    <CheckCircle size={15} weight="fill" />
                                    <span>Hoàn thành khám</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* TAB 1: KHÁM BỆNH (QUY TRÌNH 4 BƯỚC LIÊN HOÀN CHUẨN tClinic) */}
                {/* ======================================================== */}
                {activeSubTab === 'KHAM_BENH' && (
                    <div className="space-y-3.5">
                        {/* 1. THÔNG TIN NGƯỜI ĐĂNG KÝ KHÁM */}
                        <div className="rounded-xl border border-[#CBE9FA] bg-white overflow-hidden shadow-2xs">
                            <div
                                onClick={() => setIsPatientInfoCollapsed(!isPatientInfoCollapsed)}
                                className="flex items-center justify-between px-3.5 py-2.5 bg-[#F4F9FD] border-b border-[#E2EDF5] cursor-pointer hover:bg-[#EBF5FB] transition select-none"
                            >
                                <div className="flex items-center gap-2 text-xs font-extrabold text-[#003553]">
                                    <span className="w-1.5 h-3.5 rounded-full bg-[#00B5F1]" />
                                    <span className="uppercase">1. THÔNG TIN NGƯỜI ĐĂNG KÝ KHÁM</span>
                                    <span className="text-[11px] font-normal text-slate-500">
                                        ({isPatientInfoCollapsed ? 'Nhấn để mở rộng chi tiết' : 'Nhấn để thu gọn'})
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-rose-600 text-xs uppercase">{currentExam?.hoTen}</span>
                                    <button type="button" className="text-slate-400 hover:text-[#003553]">
                                        {isPatientInfoCollapsed ? <CaretRight size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
                                    </button>
                                </div>
                            </div>

                            {!isPatientInfoCollapsed ? (
                                <div className="p-3.5 text-xs space-y-2.5">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                        <div>
                                            <div className="text-[11px] text-slate-400 font-medium">Mã KCB:</div>
                                            <div className="font-mono font-bold text-[#00B5F1]">{currentExam?.maKCB}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-slate-400 font-medium">Họ và tên:</div>
                                            <div className="font-bold text-rose-600 uppercase text-xs">{currentExam?.hoTen}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-slate-400 font-medium">Mã bệnh nhân:</div>
                                            <div className="font-mono font-bold text-[#003553]">{currentExam?.maBN}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-slate-400 font-medium">Điện thoại:</div>
                                            <div className="font-bold text-rose-600">{currentExam?.dienThoai}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-slate-400 font-medium">Tuổi / Giới tính:</div>
                                            <div className="font-semibold text-slate-700">{currentExam?.tuoi} • {currentExam?.gioiTinh}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-slate-400 font-medium">Ngày đăng ký:</div>
                                            <div className="font-semibold text-slate-700">{currentExam?.ngayKham || '12/10/2026 08:30'}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100 items-center">
                                        <div className="sm:col-span-2 text-slate-600">
                                            <span className="text-slate-400">Địa chỉ:</span>{' '}
                                            <span className="font-medium">{currentExam?.diaChi || '123 Đường Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, TP. Hà Nội'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 sm:justify-end">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 font-bold border border-amber-300 text-[11px]">
                                                <Warning size={13} weight="fill" className="text-amber-600 shrink-0" />
                                                <span>Tiền sử dị ứng:</span>
                                                <span className="text-rose-700 underline font-black">{currentExam?.tienSuDiUng || 'Penicillin, Aspirin, hải sản'}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-3.5 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600 bg-white">
                                    <div>
                                        Mã KCB: <strong className="font-mono text-[#00B5F1]">{currentExam?.maKCB}</strong> &bull; BN: <strong className="font-mono text-slate-700">{currentExam?.maBN}</strong> &bull; Tuổi: <strong>{currentExam?.tuoi}</strong> &bull; SĐT: <strong className="text-rose-600">{currentExam?.dienThoai}</strong>
                                    </div>
                                    <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                                        ⚠️ Dị ứng: {currentExam?.tienSuDiUng || 'Penicillin, Aspirin'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 2. KHÁM LÂM SÀNG & CHẨN ĐOÁN ICD-10 */}
                        <div className="rounded-xl border border-[#CBE9FA] bg-white overflow-hidden shadow-2xs space-y-3 p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2 text-xs font-extrabold text-[#003553]">
                                    <span className="w-1.5 h-3.5 rounded-full bg-[#00B5F1]" />
                                    <span className="uppercase">2. KHÁM LÂM SÀNG & CHẨN ĐOÁN ICD-10</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                                    <span>Bác sĩ: <strong className="text-[#003553]">{currentExam?.bacSi || 'BS.CKII Nguyễn Minh Hoàng'}</strong></span>
                                    <span>&bull;</span>
                                    <span>Phòng: <strong className="text-[#003553]">{currentExam?.phongKham || 'Phòng khám Nội 1'}</strong></span>
                                </div>
                            </div>

                            {/* Dải chỉ số sinh hiệu (Phong cách tClinic nền dịu) */}
                            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/70">
                                <div className="text-[11px] font-bold text-amber-900 mb-2 uppercase flex items-center gap-1.5">
                                    <Pulse size={13} weight="bold" className="text-amber-600" />
                                    <span>CHỈ SỐ SINH HIỆU LÂM SÀNG</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                    {[
                                        { key: 'mach', label: 'Mạch (lần/p)', ph: '82' },
                                        { key: 'nhietDo', label: 'Nhiệt độ (°C)', ph: '36.8' },
                                        { key: 'huyetAp', label: 'Huyết áp (mmHg)', ph: '135/85' },
                                        { key: 'nhipTho', label: 'Nhịp thở (lần/p)', ph: '19' },
                                        { key: 'chieuCao', label: 'Chiều cao (cm)', ph: '160' },
                                        { key: 'canNang', label: 'Cân nặng (kg)', ph: '56' },
                                        { key: 'bmi', label: 'Chỉ số BMI', ph: '21.9' },
                                    ].map((v) => (
                                        <div key={v.key} className="bg-white p-1.5 rounded-lg border border-amber-200/60 shadow-2xs">
                                            <label className="block text-[10.5px] font-semibold text-slate-500 mb-0.5 text-center">{v.label}</label>
                                            <input
                                                type="text"
                                                disabled={currentExam?.emrLocked}
                                                value={vitals[v.key] || ''}
                                                placeholder={v.ph}
                                                onChange={(e) => setVitals({ ...vitals, [v.key]: e.target.value })}
                                                className="w-full text-center font-mono font-bold text-xs text-[#003553] bg-transparent outline-none border-b border-dashed border-amber-300 focus:border-[#00B5F1]"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Triệu chứng ban đầu & Khám toàn thân (Chuẩn tClinic) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                                <div>
                                    <label className="medpro-label">Triệu chứng ban đầu & Lý do đến khám</label>
                                    <textarea
                                        rows={3}
                                        disabled={currentExam?.emrLocked}
                                        value={notes.trieuChungBanDau || ''}
                                        onChange={(e) => setNotes({ ...notes, trieuChungBanDau: e.target.value })}
                                        className="medpro-input"
                                        placeholder="Ghi nhận triệu chứng cơ năng người bệnh than phiền..."
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Khám lâm sàng toàn thân & Bộ phận chung</label>
                                    <textarea
                                        rows={3}
                                        disabled={currentExam?.emrLocked}
                                        value={notes.ketQuaKham || ''}
                                        onChange={(e) => setNotes({ ...notes, ketQuaKham: e.target.value })}
                                        className="medpro-input"
                                        placeholder="Da niêm mạc, tuyến giáp, hạch ngoại vi, thể trạng..."
                                    />
                                </div>
                            </div>

                            {/* Liên kết mở khám chuyên sâu theo 5 chuyên khoa chuẩn tClinic */}
                            <div className="p-3 rounded-xl bg-[#F0F7FC] border border-[#CBE9FA] flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-[#003553] font-bold">
                                    <Stethoscope size={16} weight="duotone" className="text-[#00B5F1]" />
                                    <span>Khám chuyên khoa sâu riêng biệt (Chuẩn tClinic):</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {[
                                        { label: 'Khoa Nội', path: '/admin/kham-chuyen-khoa/noi-khoa' },
                                        { label: 'Khoa Ngoại', path: '/admin/kham-chuyen-khoa/ngoai-khoa' },
                                        { label: 'Khoa Mắt', path: '/admin/kham-chuyen-khoa/mat' },
                                        { label: 'Khoa TMH', path: '/admin/kham-chuyen-khoa/tai-mui-hong' },
                                        { label: 'Khoa RHM (Odontogram)', path: '/admin/kham-chuyen-khoa/rang-ham-mat' },
                                    ].map((ck) => (
                                        <button
                                            key={ck.path}
                                            type="button"
                                            onClick={() => navigate(ck.path)}
                                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-[#00B5F1] hover:text-[#00B5F1] text-slate-700 font-bold transition text-[11px] shadow-2xs cursor-pointer"
                                        >
                                            {ck.label} ➔
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* CHẨN ĐOÁN SƠ BỘ & HƯỚNG XỬ TRÍ CHUNG CHO CẢ 5 CHUYÊN KHOA */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100">
                                <div>
                                    <label className="medpro-label">Chẩn đoán sơ bộ ban đầu</label>
                                    <input
                                        type="text"
                                        disabled={currentExam?.emrLocked}
                                        value={notes.chanDoanSoBo || ''}
                                        onChange={(e) => setNotes({ ...notes, chanDoanSoBo: e.target.value })}
                                        className="medpro-input"
                                        placeholder="Chẩn đoán sơ bộ ban đầu của bác sĩ..."
                                    />
                                </div>
                                <div>
                                    <label className="medpro-label">Hướng xử trí & Điều trị</label>
                                    <input
                                        type="text"
                                        disabled={currentExam?.emrLocked}
                                        value={notes.huongXuTri || ''}
                                        onChange={(e) => setNotes({ ...notes, huongXuTri: e.target.value })}
                                        className="medpro-input"
                                        placeholder="Chỉ định CLS, dùng thuốc ngoại trú hoặc nhập viện..."
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="medpro-label">Chẩn đoán xác định kết luận sau thăm khám</label>
                                    <input
                                        type="text"
                                        disabled={currentExam?.emrLocked}
                                        value={notes.chanDoanXacDinh || ''}
                                        onChange={(e) => setNotes({ ...notes, chanDoanXacDinh: e.target.value })}
                                        className="medpro-input font-bold text-[#003553]"
                                        placeholder="Chẩn đoán xác định kết luận..."
                                    />
                                </div>
                            </div>

                            {/* Bảng chẩn đoán ICD-10 chuẩn tClinic */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex flex-wrap items-end gap-2">
                                    <div className="flex-1 min-w-[240px]">
                                        <label className="medpro-label">Chọn bệnh lý từ Danh mục ICD-10</label>
                                        <select
                                            value={selectedIcdCode}
                                            onChange={(e) => setSelectedIcdCode(e.target.value)}
                                            className="medpro-input"
                                        >
                                            {icdCatalog.map((icd) => (
                                                <option key={icd.id} value={icd.maICD}>
                                                    {icd.maICD} — {icd.tenBenh} {icd.truyenNhiem ? '(Bệnh truyền nhiễm)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-48">
                                        <label className="medpro-label">Phân loại / Diễn giải</label>
                                        <input
                                            type="text"
                                            value={icdNote}
                                            onChange={(e) => setIcdNote(e.target.value)}
                                            className="medpro-input"
                                            placeholder="Bệnh chính / Kèm theo"
                                        />
                                    </div>
                                    <button type="button" onClick={handleAddIcd} className="medpro-btn-primary text-xs">
                                        <Plus size={14} weight="bold" />
                                        <span>Thêm ICD-10</span>
                                    </button>
                                </div>

                                <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                                    <table className="medpro-table">
                                        <thead>
                                            <tr>
                                                <th className="w-12 text-center">BC</th>
                                                <th>Mã ICD-10</th>
                                                <th>Tên bệnh lý</th>
                                                <th>Diễn giải</th>
                                                <th className="w-14 text-center">Xóa</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {icdList.map((item, idx) => (
                                                <tr key={item.maICD}>
                                                    <td className="text-center">
                                                        <input
                                                            type="radio"
                                                            name="primaryIcd"
                                                            checked={primaryIcdCode === item.maICD || (idx === 0 && !primaryIcdCode)}
                                                            onChange={() => setPrimaryIcdCode(item.maICD)}
                                                            className="accent-[#00B5F1] cursor-pointer"
                                                            title="Chọn làm bệnh chính"
                                                        />
                                                    </td>
                                                    <td className="font-mono font-bold text-[#00B5F1]">{item.maICD}</td>
                                                    <td className="font-semibold text-[#12263F]">{item.tenBenh}</td>
                                                    <td>{item.dienGiai || (primaryIcdCode === item.maICD ? 'Bệnh chính' : 'Bệnh kèm theo')}</td>
                                                    <td className="text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveIcd(item.maICD)}
                                                            className="text-rose-600 hover:text-rose-700 cursor-pointer"
                                                            title="Xóa ICD-10"
                                                        >
                                                            <Trash size={14} weight="bold" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {icdList.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-4 text-slate-400 text-xs italic">
                                                        Chưa có mã bệnh ICD-10 nào. Hãy chọn mã từ danh mục trên và nhấn "Thêm ICD-10".
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {currentExam?.amendmentHistory?.length > 0 && (
                                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1">
                                        <div className="font-bold text-amber-800 inline-flex items-center gap-1.5">
                                            <Warning size={14} weight="fill" />
                                            <span>LỊCH SỬ BIÊN BẢN ĐÍNH CHÍNH BỆNH ÁN (TT 13/2025/TT-BYT):</span>
                                        </div>
                                        {currentExam.amendmentHistory.map((am) => (
                                            <div key={am.id} className="text-amber-900">
                                                • [{am.thoiGian}] <strong>{am.nguoiLap}</strong> — Lý do: {am.lyDo} (Chẩn đoán cũ: <em>{am.noiDungCu}</em>)
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. ĐƠN THUỐC ĐIỆN TỬ NGOẠI TRÚ (KHÔNG QUẢN LÝ KHO THUỐC) */}
                        <div className="rounded-xl border border-[#CBE9FA] bg-white overflow-hidden shadow-2xs space-y-3 p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2 text-xs font-extrabold text-[#003553]">
                                    <span className="w-1.5 h-3.5 rounded-full bg-[#00B5F1]" />
                                    <span className="uppercase">3. ĐƠN THUỐC ĐIỆN TỬ NGOẠI TRÚ (INT-04)</span>
                                    <span className="font-mono text-[11px] font-bold text-[#00B5F1]">
                                        Mã: {prescription.maDon}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleTransitionPrescriptionFSM('VALIDATED')}
                                        className="medpro-btn-outline !py-1 !px-2.5 text-[11px]"
                                    >
                                        <CheckCircle size={13} weight="duotone" className="text-[#00B5F1]" />
                                        <span>Kiểm tra</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTransitionPrescriptionFSM('SIGNED')}
                                        className="medpro-btn-primary !py-1 !px-2.5 text-[11px]"
                                    >
                                        <Signature size={13} weight="bold" />
                                        <span>Ký số (Khóa đơn)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTransitionPrescriptionFSM('ACCEPTED')}
                                        className="medpro-btn-amber !py-1 !px-2.5 text-[11px] font-bold"
                                    >
                                        <UploadSimple size={13} weight="bold" />
                                        <span>Cổng QG</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => AppToast.success(`Đang in Đơn thuốc Quốc gia ${prescription.maDon}...`)}
                                        className="medpro-btn-outline !py-1 !px-2.5 text-[11px]"
                                    >
                                        <Printer size={13} weight="duotone" className="text-[#00B5F1]" />
                                        <span>In (F9)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Đơn thuốc mẫu nhanh */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="font-bold text-[#003553] text-[11px]">ĐƠN THUỐC MẪU GỢI Ý:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {prescriptionTemplates.map((smp) => (
                                        <button
                                            key={smp.id}
                                            type="button"
                                            onClick={() => handleApplySamplePrescription(smp)}
                                            className="px-2.5 py-0.5 rounded-full bg-[#E8F4FD] text-[#003553] hover:bg-[#00B5F1] hover:text-white text-[11px] font-bold transition cursor-pointer"
                                        >
                                            + {smp.tenMau}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ô nhập thêm thuốc: BỎ TỒN KHO, CHIA LIỀU SÁNG - TRƯA - CHIỀU - TỐI */}
                            <div className="p-3 rounded-xl bg-[#F8FBFE] border border-slate-200 space-y-2.5 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                    <div className="sm:col-span-5">
                                        <label className="medpro-label">Tên thuốc & Hoạt chất (Danh mục chuẩn BYT)</label>
                                        <select
                                            value={selectedDrugId}
                                            onChange={(e) => setSelectedDrugId(e.target.value)}
                                            className="medpro-input"
                                        >
                                            {drugCatalog.map((d) => (
                                                <option key={d.id} value={d.maThuoc}>
                                                    {d.tenThuoc} — {d.hoatChat} ({d.dvt})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-4 grid grid-cols-4 gap-1">
                                        <div>
                                            <label className="medpro-label text-center text-[10px]">Sáng</label>
                                            <input
                                                type="text"
                                                value={doseMorning}
                                                onChange={(e) => setDoseMorning(e.target.value)}
                                                className="medpro-input text-center !py-1 font-bold text-[#003553]"
                                            />
                                        </div>
                                        <div>
                                            <label className="medpro-label text-center text-[10px]">Trưa</label>
                                            <input
                                                type="text"
                                                value={doseNoon}
                                                onChange={(e) => setDoseNoon(e.target.value)}
                                                className="medpro-input text-center !py-1 font-bold text-[#003553]"
                                            />
                                        </div>
                                        <div>
                                            <label className="medpro-label text-center text-[10px]">Chiều</label>
                                            <input
                                                type="text"
                                                value={doseAfternoon}
                                                onChange={(e) => setDoseAfternoon(e.target.value)}
                                                className="medpro-input text-center !py-1 font-bold text-[#003553]"
                                            />
                                        </div>
                                        <div>
                                            <label className="medpro-label text-center text-[10px]">Tối</label>
                                            <input
                                                type="text"
                                                value={doseNight}
                                                onChange={(e) => setDoseNight(e.target.value)}
                                                className="medpro-input text-center !py-1 font-bold text-[#003553]"
                                            />
                                        </div>
                                    </div>
                                    <div className="sm:col-span-1">
                                        <label className="medpro-label text-center">Tổng SL</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={drugQty}
                                            onChange={(e) => setDrugQty(e.target.value)}
                                            className="medpro-input text-center tabular-nums font-bold"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <button type="button" onClick={handleAddDrug} className="medpro-btn-primary w-full text-xs !py-2">
                                            <Plus size={14} weight="bold" />
                                            <span>Thêm thuốc</span>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="medpro-label">Hướng dẫn liều dùng & Cách dùng</label>
                                    <input
                                        type="text"
                                        value={drugDosage}
                                        onChange={(e) => setDrugDosage(e.target.value)}
                                        className="medpro-input"
                                        placeholder="Ví dụ: Uống sau ăn 30 phút, kiêng rượu bia..."
                                    />
                                </div>
                            </div>

                            {/* Bảng đơn thuốc chuẩn tClinic */}
                            <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                                <table className="medpro-table">
                                    <thead>
                                        <tr>
                                            <th className="w-10 text-center">#</th>
                                            <th>Tên thuốc / Hoạt chất</th>
                                            <th>ĐVT</th>
                                            <th className="text-center">Sáng</th>
                                            <th className="text-center">Trưa</th>
                                            <th className="text-center">Chiều</th>
                                            <th className="text-center">Tối</th>
                                            <th className="text-center">Tổng SL</th>
                                            <th>Cách dùng & Lời dặn</th>
                                            <th className="w-14 text-center">Xóa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(prescription.items || []).map((item, idx) => (
                                            <tr key={item.id}>
                                                <td className="text-center font-bold tabular-nums">{idx + 1}</td>
                                                <td>
                                                    <div className="font-bold text-[#12263F]">{item.tenThuoc}</div>
                                                    <div className="text-[11px] text-slate-500 font-mono">{item.maThuoc} — {item.hoatChat}</div>
                                                </td>
                                                <td>{item.dvt}</td>
                                                <td className="text-center font-semibold">{item.sang || '1'}</td>
                                                <td className="text-center font-semibold">{item.trua || '0'}</td>
                                                <td className="text-center font-semibold">{item.chieu || '1'}</td>
                                                <td className="text-center font-semibold">{item.toi || '0'}</td>
                                                <td className="text-center tabular-nums font-bold text-[#003553]">{item.soLuong}</td>
                                                <td>{item.lieuDung}</td>
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (isPrescriptionImmutable) {
                                                                AppToast.error('Đơn thuốc đã ký số (INT-04), cấm xóa dòng thuốc!')
                                                                return
                                                            }
                                                            setPrescription({
                                                                ...prescription,
                                                                items: prescription.items.filter((x) => x.id !== item.id),
                                                            })
                                                        }}
                                                        className="text-rose-600 hover:text-rose-700 cursor-pointer"
                                                        title="Xóa thuốc"
                                                    >
                                                        <Trash size={14} weight="bold" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(prescription.items || []).length === 0 && (
                                            <tr>
                                                <td colSpan={10} className="text-center py-4 text-slate-400 text-xs italic">
                                                    Đơn thuốc chưa có thuốc. Nhấn "Thêm thuốc" hoặc áp dụng "Đơn thuốc mẫu" ở trên.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="text-xs">
                                <label className="medpro-label">Lời dặn của Bác sĩ trên Đơn thuốc</label>
                                <input
                                    type="text"
                                    value={prescription.loiDanBacSi || ''}
                                    onChange={(e) => setPrescription({ ...prescription, loiDanBacSi: e.target.value })}
                                    className="medpro-input"
                                    placeholder="Ví dụ: Tái khám mang theo đơn này, uống nhiều nước ấm..."
                                />
                            </div>
                        </div>

                        {/* 4. HẸN TÁI KHÁM & DẶN DÒ */}
                        <div className="rounded-xl border border-[#CBE9FA] bg-white overflow-hidden shadow-2xs p-3.5 space-y-2.5">
                            <div className="flex items-center gap-2 text-xs font-extrabold text-[#003553] border-b border-slate-100 pb-2">
                                <span className="w-1.5 h-3.5 rounded-full bg-[#00B5F1]" />
                                <span className="uppercase">4. HẸN TÁI KHÁM & DẶN DÒ</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-xs">
                                <div>
                                    <label className="medpro-label">Ngày hẹn tái khám</label>
                                    <input
                                        type="date"
                                        value={followUpDate}
                                        onChange={(e) => setFollowUpDate(e.target.value)}
                                        className="medpro-input font-bold text-[#003553]"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="medpro-label">Nội dung dặn dò khi tái khám</label>
                                    <input
                                        type="text"
                                        value={followUpNotes}
                                        onChange={(e) => setFollowUpNotes(e.target.value)}
                                        className="medpro-input"
                                        placeholder="Ví dụ: Nhịn ăn sáng làm xét nghiệm mỡ máu, mang theo kết quả cũ..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* TAB 2: KÊ DỊCH VỤ & KÊ GÓI DỊCH VỤ (CLS / X-QUANG / XÉT NGHIỆM) */}
                {/* ======================================================== */}
                {activeSubTab === 'KE_DICH_VU' && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FBFE] p-3 rounded-xl border border-[#CBE9FA]">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowServiceModal(true)}
                                    className="medpro-btn-primary text-xs"
                                >
                                    <Plus size={14} weight="bold" />
                                    <span>Chọn Dịch vụ Kỹ thuật (X-Quang / Siêu âm / Xét nghiệm)</span>
                                </button>
                                {packageTemplates.map((pkg) => (
                                    <button
                                        key={pkg.id}
                                        type="button"
                                        onClick={() => handleApplyServicePackage(pkg)}
                                        className="medpro-btn-amber text-xs font-bold"
                                    >
                                        <ClipboardText size={14} weight="bold" />
                                        <span>Áp dụng {pkg.tenMau}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => AppToast.success('Đang in Phiếu chỉ định Cận lâm sàng...')}
                                className="medpro-btn-outline text-xs"
                            >
                                <Printer size={14} weight="duotone" className="text-[#00B5F1]" />
                                <span>In phiếu chỉ định</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Mã DV</th>
                                        <th>Tên dịch vụ kỹ thuật</th>
                                        <th>ĐVT</th>
                                        <th>SL</th>
                                        <th>Đơn giá</th>
                                        <th>Thành tiền</th>
                                        <th>Phòng thực hiện</th>
                                        <th>Trạng thái CLS</th>
                                        <th>Xóa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {services.map((s, idx) => (
                                        <tr key={s.id}>
                                            <td className="tabular-nums font-bold">{idx + 1}</td>
                                            <td className="font-mono font-bold text-[#00B5F1]">{s.maDV}</td>
                                            <td className="font-semibold text-[#12263F]">{s.tenDV}</td>
                                            <td>{s.dvt}</td>
                                            <td className="tabular-nums">{s.soLuong}</td>
                                            <td className="tabular-nums">{Number(s.donGia).toLocaleString('vi-VN')} đ</td>
                                            <td className="tabular-nums font-bold text-[#003553]">
                                                {Number(s.thanhTien).toLocaleString('vi-VN')} đ
                                            </td>
                                            <td>{s.phongTH}</td>
                                            <td>
                                                <StatusBadge status={s.trangThaiCLS} compact />
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => setServices(services.filter((x) => x.id !== s.id))}
                                                    className="text-rose-600 hover:text-rose-700 cursor-pointer"
                                                    title="Xóa dịch vụ"
                                                >
                                                    <Trash size={15} weight="bold" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {services.length === 0 && (
                                        <tr>
                                            <td colSpan={10}>
                                                <EmptyState
                                                    icon="ClipboardText"
                                                    title="Chưa có dịch vụ chỉ định"
                                                    description="Nhấn 'Chọn Dịch vụ Kỹ thuật' hoặc 'Áp dụng Gói khám' để thêm chỉ định."
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-[#E8F4FD] text-[#003553] font-bold text-sm">
                            <span>Tổng cộng chi phí dịch vụ chỉ định:</span>
                            <span className="font-display text-lg text-[#00B5F1] tabular-nums">
                                {totalServiceCost.toLocaleString('vi-VN')} VNĐ
                            </span>
                        </div>
                    </div>
                )}

                {/* SUB-TAB 4: KHÁM SỨC KHỎE PHÂN LOẠI I-V THEO THÔNG TƯ 32/2023/TT-BYT (tClinic /khamlamsang/noikhoa) */}
                {activeSubTab === 'KHAM_SUC_KHOE' && (
                    <div className="space-y-4">
                        <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50/60 border border-[#B8E5FA] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h4 className="font-display font-extrabold text-xs text-[#003553] uppercase">
                                    KHÁM LÂM SÀNG PHÂN LOẠI SỨC KHỎE CÁC HỆ CƠ QUAN (THEO THÔNG TƯ 32/2023/TT-BYT)
                                </h4>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                    Áp dụng cho khám sức khỏe định kỳ cá nhân & khám đoàn doanh nghiệp. Kết luận phân loại sức khỏe từ Loại I đến Loại V.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-[#003553]">Phân loại chung:</span>
                                <select
                                    value={overallClassification}
                                    onChange={(e) => setOverallClassification(e.target.value)}
                                    className="medpro-input !py-1 font-black text-[#00B5F1] text-xs !w-28"
                                >
                                    <option value="Loại I">Loại I</option>
                                    <option value="Loại II">Loại II</option>
                                    <option value="Loại III">Loại III</option>
                                    <option value="Loại IV">Loại IV</option>
                                    <option value="Loại V">Loại V</option>
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Hệ cơ quan khám</th>
                                        <th>Kết quả khám lâm sàng</th>
                                        <th>Mã ICD-10 (nếu có)</th>
                                        <th>Phân loại hệ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {classifications.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                            <td className="font-bold">{idx + 1}</td>
                                            <td className="font-bold text-[#003553] whitespace-nowrap">{item.heCoQuan}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.ketQuaMacDinh || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setClassifications((prev) =>
                                                            prev.map((c, i) => (i === idx ? { ...c, ketQuaMacDinh: val } : c))
                                                        )
                                                    }}
                                                    className="medpro-input !py-1 text-xs"
                                                />
                                            </td>
                                            <td className="w-28">
                                                <input
                                                    type="text"
                                                    value={item.maICD || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setClassifications((prev) =>
                                                            prev.map((c, i) => (i === idx ? { ...c, maICD: val } : c))
                                                        )
                                                    }}
                                                    placeholder="ICD-10"
                                                    className="medpro-input !py-1 text-xs font-mono uppercase"
                                                />
                                            </td>
                                            <td className="w-28">
                                                <select
                                                    value={item.phanLoai || 'Loại I'}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setClassifications((prev) =>
                                                            prev.map((c, i) => (i === idx ? { ...c, phanLoai: val } : c))
                                                        )
                                                    }}
                                                    className="medpro-input !py-1 text-xs font-bold text-[#00B5F1]"
                                                >
                                                    <option value="Loại I">Loại I</option>
                                                    <option value="Loại II">Loại II</option>
                                                    <option value="Loại III">Loại III</option>
                                                    <option value="Loại IV">Loại IV</option>
                                                    <option value="Loại V">Loại V</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-slate-600">
                                Kết luận: Sức khỏe đạt <strong>{overallClassification}</strong> &bull; Đủ điều kiện làm việc / học tập theo quy định.
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => AppToast.success('Đã ký số Bác sĩ kết luận Khám sức khỏe định kỳ!')}
                                    className="medpro-btn-primary text-xs"
                                >
                                    <Signature size={14} weight="bold" />
                                    <span>Ký số Bác sĩ</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => AppToast.success(`Đã đồng bộ phiếu khám sức khỏe lên Cổng Sổ Sức Khỏe Điện Tử HSSK (Idempotency Key: HSSK-${currentExam?.maKCB})!`)}
                                    className="medpro-btn-amber text-xs font-bold"
                                >
                                    <UploadSimple size={14} weight="bold" />
                                    <span>Đồng bộ HSSK Quốc gia</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Chọn Dịch vụ Kỹ thuật (Popup Video 03A) */}
            {showServiceModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="medpro-card max-w-3xl w-full p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="font-display font-extrabold text-base text-[#003553] inline-flex items-center gap-2">
                                <ClipboardText size={18} weight="duotone" className="text-[#00B5F1]" />
                                <span>DANH MỤC CHỈ ĐỊNH DỊCH VỤ KỸ THUẬT & CẬN LÂM SÀNG</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowServiceModal(false)}
                                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer"
                            >
                                <X size={13} weight="bold" />
                                <span>Đóng</span>
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {serviceCategoryTabs.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setServiceCategoryFilter(cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${
                                        serviceCategoryFilter === cat
                                            ? 'bg-[#00B5F1] text-white'
                                            : 'bg-[#E8F4FD] text-[#003553]'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="overflow-y-auto max-h-72 border border-slate-200 rounded-xl">
                            <table className="medpro-table">
                                <thead>
                                    <tr>
                                        <th>Mã DV</th>
                                        <th>Tên dịch vụ</th>
                                        <th>Nhóm</th>
                                        <th>Đơn giá</th>
                                        <th>Phòng thực hiện</th>
                                        <th>Chọn</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {serviceCatalog
                                        .filter((s) => serviceCategoryFilter === 'Tất cả' || s.nhomDV === serviceCategoryFilter)
                                        .map((srv) => (
                                            <tr key={srv.id}>
                                                <td className="font-mono font-bold text-[#00B5F1]">{srv.maDV}</td>
                                                <td className="font-semibold">{srv.tenDV}</td>
                                                <td>{srv.nhomDV}</td>
                                                <td className="tabular-nums font-bold">
                                                    {Number(srv.donGia).toLocaleString('vi-VN')} đ
                                                </td>
                                                <td>{srv.phongTH}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddServiceFromCatalog(srv)}
                                                        className="medpro-btn-primary !py-1 !px-3 text-xs"
                                                    >
                                                        <Plus size={12} weight="bold" />
                                                        <span>Chỉ định</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Biên bản Đính chính Bệnh án (INT-03) */}
            {showAmendmentModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="medpro-card max-w-lg w-full p-5 space-y-4">
                        <h3 className="font-display font-extrabold text-base text-[#003553] inline-flex items-center gap-2">
                            <PencilSimple size={18} weight="bold" className="text-[#00B5F1]" />
                            <span>LẬP BIÊN BẢN ĐÍNH CHÍNH HỒ SƠ BỆNH ÁN ĐIỆN TỬ (INT-03)</span>
                        </h3>
                        <p className="text-xs text-slate-600">
                            Theo Thông tư 13/2025/TT-BYT và Nghị định 102/2025/NĐ-CP, bệnh án đã khóa không được chỉnh sửa âm thầm. Mọi đính chính phải lưu lại bản gốc và lý do đính chính.
                        </p>
                        <div>
                            <label className="medpro-label">Lý do đính chính chuyên môn *</label>
                            <textarea
                                rows={3}
                                value={amendmentReason}
                                onChange={(e) => setAmendmentReason(e.target.value)}
                                placeholder="VD: Bổ sung kết quả hội chẩn tim mạch và cập nhật chẩn đoán kèm theo..."
                                className="medpro-input"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowAmendmentModal(false)}
                                className="medpro-btn-outline text-xs"
                            >
                                Hủy
                            </button>
                            <button type="button" onClick={handleCreateAmendment} className="medpro-btn-primary text-xs">
                                Xác nhận lập Biên bản & Mở đính chính
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
