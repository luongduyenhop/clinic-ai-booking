import { exportToExcel, exportToCsv } from '../../utils/helpers/exportUtils'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { updateCatalogSubCollectionAsync } from '../../redux/actions/admin/adminAction'
import { adminService } from '../../services/admin/AdminService'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions } from '../../utils/helpers/clinicConfigHelpers'
import {
    ClinicIcon,
    StatusBadge,
    EmptyState,
    Plus,
    FloppyDisk,
    Trash,
    DownloadSimple,
    UploadSimple,
    MagnifyingGlass,
} from '../../components/common/ClinicIcon'

const removeVietnameseTones = (str) =>
    String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim()

const normDocKey = (str) =>
    String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/^(bs\.?|ths\.?|pgs\.?|ts\.?|cki{1,2}|ck1|ck2|\s)+/g, '')
        .replace(/[\s\.\-_]+/g, '')
        .trim()

const getNextCode = (list, prefix, pad = 3) => {
    let max = 0
    ;(list || []).forEach((item) => {
        const val = item.ma || item.maPhong || item.maThuoc || item.maDV || item.id || ''
        const m = String(val).match(/(\d+)/)
        if (m) {
            const num = parseInt(m[1], 10)
            if (num > max) max = num
        }
    })
    return prefix + String(max + 1).padStart(pad, '0')
}

export const SERVICE_GROUPS = [
    { value: 'Khám bệnh', label: 'Khám bệnh (Khám lâm sàng chuyên khoa)' },
    { value: 'Xét nghiệm', label: 'Xét nghiệm (Huyết học, Sinh hóa, Vi sinh, Nước tiểu)' },
    { value: 'Chẩn đoán hình ảnh', label: 'Chẩn đoán hình ảnh (Tổng hợp)' },
    { value: 'Siêu âm', label: 'Siêu âm (Doppler màu, Tuyến giáp, Ổ bụng)' },
    { value: 'X-Quang', label: 'Chụp X-Quang (Kỹ thuật số CR/DR)' },
    { value: 'Thăm dò chức năng', label: 'Thăm dò chức năng (Điện tim ECG, Điện não EEG)' },
    { value: 'Nội soi', label: 'Nội soi (Tai Mũi Họng, Dạ dày - Tiêu hóa)' },
    { value: 'Thủ thuật - VLTL', label: 'Thủ thuật & Vật lý trị liệu (Tiểu phẫu, Răng, Trị liệu)' },
    { value: 'Cận lâm sàng', label: 'Cận lâm sàng khác' },
]

export const ICD10_CHAPTERS = [
    { value: 'Chương I: Bệnh nhiễm trùng và ký sinh trùng', label: 'Chương I: Bệnh nhiễm trùng và ký sinh trùng (A00 - B99)' },
    { value: 'Chương II: Tân sinh (Khối u)', label: 'Chương II: Tân sinh (Khối u) (C00 - D48)' },
    { value: 'Chương III: Bệnh của máu và cơ quan tạo máu', label: 'Chương III: Bệnh của máu và cơ quan tạo máu (D50 - D89)' },
    { value: 'Chương IV: Bệnh nội tiết, dinh dưỡng và chuyển hóa', label: 'Chương IV: Bệnh nội tiết, dinh dưỡng và chuyển hóa (E00 - E90)' },
    { value: 'Chương V: Rối loạn tâm thần và hành vi', label: 'Chương V: Rối loạn tâm thần và hành vi (F00 - F99)' },
    { value: 'Chương VI: Bệnh hệ thần kinh', label: 'Chương VI: Bệnh hệ thần kinh (G00 - G99)' },
    { value: 'Chương VII: Bệnh của mắt và phần phụ', label: 'Chương VII: Bệnh của mắt và phần phụ (H00 - H59)' },
    { value: 'Chương VIII: Bệnh của tai và xương chũm', label: 'Chương VIII: Bệnh của tai và xương chũm (H60 - H95)' },
    { value: 'Chương IX: Bệnh hệ tuần hoàn', label: 'Chương IX: Bệnh hệ tuần hoàn (I00 - I99)' },
    { value: 'Chương X: Bệnh hệ hô hấp', label: 'Chương X: Bệnh hệ hô hấp (J00 - J99)' },
    { value: 'Chương XI: Bệnh hệ tiêu hóa', label: 'Chương XI: Bệnh hệ tiêu hóa (K00 - K93)' },
    { value: 'Chương XII: Bệnh của da và mô dưới da', label: 'Chương XII: Bệnh của da và mô dưới da (L00 - L99)' },
    { value: 'Chương XIII: Bệnh hệ cơ-xương-khớp', label: 'Chương XIII: Bệnh hệ cơ-xương-khớp (M00 - M99)' },
    { value: 'Chương XIV: Bệnh hệ sinh dục - tiết niệu', label: 'Chương XIV: Bệnh hệ sinh dục - tiết niệu (N00 - N99)' },
    { value: 'Chương XV: Thai nghén, sinh đẻ và hậu sản', label: 'Chương XV: Thai nghén, sinh đẻ và hậu sản (O00 - O99)' },
    { value: 'Chương XVI: Một số tình trạng trong chu sinh', label: 'Chương XVI: Một số tình trạng trong chu sinh (P00 - P96)' },
    { value: 'Chương XVII: Dị tật bẩm sinh, biến dạng', label: 'Chương XVII: Dị tật bẩm sinh, biến dạng (Q00 - Q99)' },
    { value: 'Chương XVIII: Triệu chứng & dấu hiệu bất thường', label: 'Chương XVIII: Triệu chứng & dấu hiệu bất thường (R00 - R99)' },
    { value: 'Chương XIX: Tổn thương, ngộ độc', label: 'Chương XIX: Tổn thương, ngộ độc (S00 - T98)' },
    { value: 'Chương XX: Nguyên nhân ngoại lai của bệnh tật', label: 'Chương XX: Nguyên nhân ngoại lai của bệnh tật (V01 - Y98)' },
    { value: 'Chương XXI: Yếu tố tiếp xúc dịch vụ y tế', label: 'Chương XXI: Yếu tố tiếp xúc dịch vụ y tế (Z00 - Z99)' },
    { value: 'Chương XXII: Mã dùng cho mục đích đặc biệt', label: 'Chương XXII: Mã dùng cho mục đích đặc biệt (U00 - U85)' },
]

export const detectIcdChapter = (code) => {
    const c = String(code || '').trim().toUpperCase()
    if (!c) return ''
    const ch = c[0]
    if (ch === 'A' || ch === 'B') return 'Chương I: Bệnh nhiễm trùng và ký sinh trùng'
    if (ch === 'C' || (ch === 'D' && c.length > 1 && '01234'.includes(c[1]))) return 'Chương II: Tân sinh (Khối u)'
    if (ch === 'D') return 'Chương III: Bệnh của máu và cơ quan tạo máu'
    if (ch === 'E') return 'Chương IV: Bệnh nội tiết, dinh dưỡng và chuyển hóa'
    if (ch === 'F') return 'Chương V: Rối loạn tâm thần và hành vi'
    if (ch === 'G') return 'Chương VI: Bệnh hệ thần kinh'
    if (ch === 'H' && c.length > 1 && '012345'.includes(c[1])) return 'Chương VII: Bệnh của mắt và phần phụ'
    if (ch === 'H') return 'Chương VIII: Bệnh của tai và xương chũm'
    if (ch === 'I') return 'Chương IX: Bệnh hệ tuần hoàn'
    if (ch === 'J') return 'Chương X: Bệnh hệ hô hấp'
    if (ch === 'K') return 'Chương XI: Bệnh hệ tiêu hóa'
    if (ch === 'L') return 'Chương XII: Bệnh của da và mô dưới da'
    if (ch === 'M') return 'Chương XIII: Bệnh hệ cơ-xương-khớp'
    if (ch === 'N') return 'Chương XIV: Bệnh hệ sinh dục - tiết niệu'
    if (ch === 'O') return 'Chương XV: Thai nghén, sinh đẻ và hậu sản'
    if (ch === 'P') return 'Chương XVI: Một số tình trạng trong chu sinh'
    if (ch === 'Q') return 'Chương XVII: Dị tật bẩm sinh, biến dạng'
    if (ch === 'R') return 'Chương XVIII: Triệu chứng & dấu hiệu bất thường'
    if (ch === 'S' || ch === 'T') return 'Chương XIX: Tổn thương, ngộ độc'
    if (['V', 'W', 'X', 'Y'].includes(ch)) return 'Chương XX: Nguyên nhân ngoại lai của bệnh tật'
    if (ch === 'Z') return 'Chương XXI: Yếu tố tiếp xúc dịch vụ y tế'
    if (ch === 'U') return 'Chương XXII: Mã dùng cho mục đích đặc biệt'
    return ''
}

export default function CatalogManagementPage() {

    const { loaiDanhMuc = 'chung' } = useParams()
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const settings = clinicData?.clinicSettings || {}
    const catalogs = clinicData?.catalogs || {}

    const masterOptions = getMasterOptions(clinicData)
    const generalSubTabs = masterOptions.generalCatalogSubTabs || []
    const defaultCatalogRouteMap = {
        chung: { title: 'Danh mục chung (5 phân mục)', path: '/admin/danh-muc/chung', icon: 'SlidersHorizontal' },
        'dia-chi': { title: 'Danh mục Địa chỉ Hành chính', path: '/admin/danh-muc/dia-chi', icon: 'MapPin' },
        'chuyen-khoa': { title: 'Danh mục Chuyên khoa lâm sàng', path: '/admin/danh-muc/chuyen-khoa', icon: 'FirstAid' },
        'khoa-phong': { title: 'Danh mục Khoa phòng & Buồng khám', path: '/admin/danh-muc/khoa-phong', icon: 'Buildings' },
        benh: { title: 'Danh mục Bệnh lý Quốc tế (ICD-10)', path: '/admin/danh-muc/benh', icon: 'Heartbeat' },
        'thuoc-vat-tu': { title: 'Danh mục Thuốc & Vật tư Y tế', path: '/admin/danh-muc/thuoc-vat-tu', icon: 'Pill' },
        'dich-vu': { title: 'Danh mục Dịch vụ Kỹ thuật Y tế', path: '/admin/danh-muc/dich-vu', icon: 'Stethoscope' },
    }
    const catalogRouteMap = {
        ...defaultCatalogRouteMap,
        ...(masterOptions.catalogRouteMap || {}),
        'chuyen-khoa': { title: 'Danh mục Chuyên khoa lâm sàng', path: '/admin/danh-muc/chuyen-khoa', icon: 'FirstAid' },
    }

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeGeneralSubTab, setActiveGeneralSubTab] = useState(generalSubTabs[0]?.key || 'goTat')
    const [searchText, setSearchText] = useState('')
    const [exportLoading, setExportLoading] = useState(false)

    const handleExportServicesToExcel = async () => {
        setExportLoading(true)
        try {
            const res = await adminService.exportServicesCatalog()
            const servicesData = res?.danh_sach_dich_vu || catalogs.dichVu || []
            const headers = ['Mã DV', 'Tên dịch vụ kỹ thuật', 'Nhóm dịch vụ', 'Đơn vị tính', 'Đơn giá niêm yết (VNĐ)', 'Thuế VAT (%)', 'Đơn giá sau VAT (VNĐ)', 'Thời gian TH (phút)', 'Số lượt đã làm', 'Doanh thu tích lũy (VNĐ)', 'Trạng thái']
            const rows = servicesData.map((s, idx) => [
                s.ma_dich_vu || s.maDV || `DV0${idx + 1}`,
                s.ten_dich_vu || s.tenDV || s.ten || '',
                s.nhom_dich_vu || s.nhomDV || 'Khám bệnh',
                s.don_vi_tinh || s.dvt || 'Lần',
                Number(s.don_gia || s.donGia) || 150000,
                Number(s.vat_percent !== undefined ? s.vat_percent : 0),
                Number(s.don_gia_sau_vat || (Number(s.donGia || s.don_gia || 150000) * (1 + (s.vat_percent || 0) / 100))),
                Number(s.thoi_gian_thuc_hien) || 15,
                Number(s.so_luong_da_lam || 0),
                Number(s.doanh_thu_tich_luy || 0),
                s.trang_thai !== false && s.trangThai !== false ? 'Đang áp dụng' : 'Tạm ngưng',
            ])
            const configuredClinicName = (settings.tenPhongKham || settings.tenCoSo || 'Phòng Khám Đa Khoa Quốc Tế Clinic-AI').toUpperCase()
            const configuredClinicAddress = [
                settings.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
                settings.dienThoai ? `Hotline: ${settings.dienThoai}` : 'Hotline: 1900 2115',
                settings.giayPhepHoatDong ? `GPHĐ: ${settings.giayPhepHoatDong}` : 'GPHĐ: Số 1428/HNO-GPHĐ',
            ].filter(Boolean).join(' | ')

            exportToExcel({
                filename: `Bang_gia_dich_vu_ky_thuat_chuan_y_te_${new Date().toISOString().slice(0, 10)}.xlsx`,
                sheetName: 'Bảng Giá Dịch Vụ',
                title: 'BẢNG GIÁ DỊCH VỤ KỸ THUẬT & CẬN LÂM SÀNG CHUẨN HÓA',
                subtitle: `Ban hành theo quy định Bộ Y Tế • Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} • Số lượng: ${rows.length} dịch vụ`,
                clinicName: configuredClinicName,
                clinicAddress: configuredClinicAddress,
                headers,
                rows,
                signOff: true,
            })
            AppToast.success('Đã xuất thành công Bảng giá Dịch vụ Kỹ thuật Chuẩn y tế (Excel)!')
        } catch {
            AppToast.error('Không thể kết nối danh mục kỹ thuật y tế!')
        } finally {
            setExportLoading(false)
        }
    }

    const getCatalogSubKeyByRoute = (routeKey, generalTab) => {
        switch (routeKey) {
            case 'chung':
                return generalTab || 'goTat'
            case 'dia-chi':
                return 'diaChi'
            case 'chuyen-khoa':
                return 'chuyenKhoa'
            case 'khoa-phong':
                return 'khoaPhong'
            case 'benh':
                return 'danhMucBenh'
            case 'thuoc-vat-tu':
                return 'thuocVatTu'
            case 'dich-vu':
                return 'dichVu'
            default:
                return routeKey
        }
    }

    const activeCatalogKey = getCatalogSubKeyByRoute(loaiDanhMuc, activeGeneralSubTab)

    const listData = catalogs[activeCatalogKey] || []

    const [form, setForm] = useState(() => listData[0] || {})
    const [departmentsList, setDepartmentsList] = useState([])
    const [doctorsList, setDoctorsList] = useState([])
    const [roomsList, setRoomsList] = useState([])
    const [dvtScopeFilter, setDvtScopeFilter] = useState('ALL')
    const staffList = clinicData?.staffList || []

    const doctorsForDepartment = useMemo(() => {
        const rawDoctorSources = [
            ...doctorsList.map((d) => ({
                id: d.id,
                hoTen: d.ho_ten || d.hoTen,
                vaiTro: 'Bác sĩ khám bệnh',
                chuyenKhoa: d.ten_chuyen_khoa || d.chuyenKhoa || '',
                is_active: d.is_active,
            })),
            ...staffList,
        ]

        const onlyDoctors = rawDoctorSources.filter((s) => {
            const role = String(s.vaiTro || s.role || '').toLowerCase()
            const name = String(s.hoTen || '').toLowerCase()
            const isNonDoctor =
                role.includes('lễ tân') ||
                role.includes('tiếp đón') ||
                role.includes('thu ngân') ||
                role.includes('kế toán') ||
                role.includes('hành chính') ||
                role.includes('bảo vệ')
            if (isNonDoctor) return false

            return (
                role.includes('bác sĩ') ||
                role.includes('chuyên môn') ||
                role.includes('doctor') ||
                name.startsWith('bs') ||
                name.startsWith('ths') ||
                name.startsWith('pgs') ||
                name.startsWith('ts.')
            )
        })

        const uniqueDoctorsMap = new Map()
        for (const doc of onlyDoctors) {
            const rawName = (doc.hoTen || doc.name || '').trim()
            if (!rawName) continue
            const cleanName = rawName.replace(/^(BS\.?\s*CKI{1,2}|ThS\.?\s*BS|PGS\.?\s*TS)\s+\1/i, '$1')
            const key = normDocKey(cleanName) || cleanName.toLowerCase().replace(/[\s\.]+/g, '')
            if (!uniqueDoctorsMap.has(key)) {
                uniqueDoctorsMap.set(key, { ...doc, hoTen: cleanName })
            }
        }
        const cleanedDoctors = Array.from(uniqueDoctorsMap.values())

        if (!form.chuyenKhoa || !String(form.chuyenKhoa).trim()) {
            return []
        }

        const norm = (str) =>
            String(str || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .toLowerCase()
                .replace(/khoa\s*/g, '')
                .trim()

        const selectedDept = norm(form.chuyenKhoa)

        return cleanedDoctors.filter((doc) => {
            const docDept = norm(doc.chuyenKhoa || doc.ten_chuyen_khoa)
            if (!docDept) return false
            return (
                docDept.includes(selectedDept) ||
                selectedDept.includes(docDept) ||
                (selectedDept.includes('noi') && docDept.includes('noi')) ||
                (selectedDept.includes('ngoai') && docDept.includes('ngoai')) ||
                (selectedDept.includes('tai mui hong') && docDept.includes('tai mui hong')) ||
                (selectedDept.includes('rang') && (docDept.includes('rang') || docDept.includes('nha'))) ||
                (selectedDept.includes('mat') && docDept.includes('mat')) ||
                (selectedDept.includes('co xuong khop') && (docDept.includes('co xuong khop') || docDept.includes('khop'))) ||
                (selectedDept.includes('tim mach') && docDept.includes('tim')) ||
                (selectedDept.includes('tieu hoa') && docDept.includes('tieu hoa')) ||
                (selectedDept.includes('da lieu') && docDept.includes('da')) ||
                (selectedDept.includes('chan doan hinh anh') && (docDept.includes('hinh anh') || docDept.includes('x-quang') || docDept.includes('sieu am')))
            )
        })
    }, [staffList, doctorsList, form.chuyenKhoa])

    const matchedDoctorInList = useMemo(() => {
        if (!form.bacSiPhuTrach) return null
        const targetKey = normDocKey(form.bacSiPhuTrach)
        if (!targetKey) return null
        return doctorsForDepartment.find((d) => {
            const dName = d.hoTen || d.ho_ten || d.name || ''
            return normDocKey(dName) === targetKey
        })
    }, [form.bacSiPhuTrach, doctorsForDepartment])

    const activeSpecialtyList = useMemo(() => {
        const source =
            departmentsList && departmentsList.length > 0
                ? departmentsList
                : catalogs.chuyenKhoa && catalogs.chuyenKhoa.length > 0
                ? catalogs.chuyenKhoa
                : (masterOptions.specialties || [
                      'Khoa Nội tổng quát',
                      'Khoa Ngoại',
                      'Khoa Tai Mũi Họng',
                      'Khoa Răng',
                      'Khoa Mắt',
                      'Cơ xương khớp',
                  ]).map((s, idx) => ({ id: `dept-${idx}`, ten_chuyen_khoa: s, is_active: true }))

        return source.filter((dept) => {
            return dept.is_active !== false && dept.trangThai !== false
        })
    }, [catalogs.chuyenKhoa, departmentsList, masterOptions.specialties])

    const availableRooms = useMemo(() => {
        const source = roomsList.length > 0 ? roomsList : catalogs.khoaPhong || []
        return source.map((r) => ({
            id: r.id,
            maPhong: r.ma_phong || r.maPhong || r.ma || '',
            tenPhong: r.ten_phong || r.tenPhong || r.ten || '',
        }))
    }, [roomsList, catalogs.khoaPhong])

    const donViTinhList = catalogs.donViTinh || []

    const medicineUnitOptions = useMemo(() => {
        return Array.from(
            new Set(
                donViTinhList
                    .filter((u) => u.trangThai !== false && u.is_active !== false)
                    .filter((u) => {
                        const scope = String(u.loai || u.phamVi || '').toUpperCase()
                        return !scope || scope === 'THUOC' || scope === 'CHUNG'
                    })
                    .map((u) => (u.ten || u.noiDung || u.ma || '').trim())
                    .filter(Boolean)
            )
        )
    }, [donViTinhList])

    const serviceUnitOptions = useMemo(() => {
        return Array.from(
            new Set(
                donViTinhList
                    .filter((u) => u.trangThai !== false && u.is_active !== false)
                    .filter((u) => {
                        const scope = String(u.loai || u.phamVi || '').toUpperCase()
                        return !scope || scope === 'DICH_VU' || scope === 'CHUNG'
                    })
                    .map((u) => (u.ten || u.noiDung || u.ma || '').trim())
                    .filter(Boolean)
            )
        )
    }, [donViTinhList])

    useEffect(() => {
        let isMounted = true
        adminService.getDepartmentsAdmin().then((list) => {
            if (isMounted && Array.isArray(list) && list.length > 0) {
                setDepartmentsList(list)
            }
        })
        adminService.getDoctorsAdmin().then((list) => {
            if (isMounted && Array.isArray(list) && list.length > 0) {
                setDoctorsList(list)
            }
        })
        adminService.getRoomsAdmin().then((list) => {
            if (isMounted && Array.isArray(list) && list.length > 0) {
                setRoomsList(list)
            }
        })
        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        setForm(listData[0] || {})
        setSearchText('')
    }, [activeCatalogKey, listData.length])

    const handleSwitchCatalogView = (items) => {
        setForm(items?.[0] || {})
        setSearchText('')
    }

    const getItemUniqueKey = (item) => {
        if (!item) return ''
        return String(
            item.maChuyenKhoa ||
            item.maPhong ||
            item.maDV ||
            item.maThuoc ||
            item.maICD ||
            item.maTinh ||
            item.ma ||
            item.id ||
            ''
        ).trim().toUpperCase()
    }

    const checkDuplicateCode = (formData, currentList, key) => {
        let codeToCheck = ''
        let codeLabel = 'Mã'
        if (key === 'chuyenKhoa') {
            codeToCheck = (formData.maChuyenKhoa || formData.ma || '').trim().toUpperCase()
            codeLabel = 'Mã chuyên khoa'
        } else if (key === 'danhMucBenh') {
            codeToCheck = (formData.maICD || '').trim().toUpperCase()
            codeLabel = 'Mã bệnh ICD-10'
        } else if (key === 'thuocVatTu') {
            codeToCheck = (formData.maThuoc || '').trim().toUpperCase()
            codeLabel = 'Mã thuốc'
        } else if (key === 'dichVu') {
            codeToCheck = (formData.maDV || '').trim().toUpperCase()
            codeLabel = 'Mã dịch vụ'
        } else if (key === 'khoaPhong') {
            codeToCheck = (formData.maPhong || '').trim().toUpperCase()
            codeLabel = 'Mã phòng'
        } else if (key === 'diaChi') {
            codeToCheck = (formData.maTinh || '').trim().toUpperCase()
            codeLabel = 'Mã Tỉnh / TP'
        } else {
            codeToCheck = (formData.ma || '').trim().toUpperCase()
            codeLabel = 'Mã danh mục'
        }

        if (!codeToCheck) {
            return `${codeLabel} không được để trống!`
        }

        const isDup = currentList.some((item) => {
            if (item.id === formData.id && formData.id) return false
            const itemCode = (
                item.maChuyenKhoa ||
                item.maICD ||
                item.maThuoc ||
                item.maDV ||
                item.maPhong ||
                item.maTinh ||
                item.ma ||
                ''
            )
                .trim()
                .toUpperCase()
            return itemCode === codeToCheck
        })

        if (isDup) {
            return `${codeLabel} "${codeToCheck}" đã tồn tại trong hệ thống! Vui lòng chọn hoặc nhập mã khác.`
        }
        return null
    }

    const handleNewItem = (customList = null) => {
        const targetList = Array.isArray(customList) ? customList : listData
        if (activeCatalogKey === 'diaChi') {
            setForm({
                id: '',
                maTinh: getNextCode(targetList, 'TT', 2),
                tenTinh: '',
                quanHuyen: '',
                phuongXa: '',
                trangThai: true,
                is_active: true,
            })
        } else if (activeCatalogKey === 'chuyenKhoa') {
            setForm({
                id: '',
                maChuyenKhoa: getNextCode(targetList, 'CK', 2),
                tenChuyenKhoa: '',
                viTriPhong: 'Tầng 1 - Khu khám bệnh',
                moTa: '',
                trangThai: true,
                is_active: true,
            })
        } else if (activeCatalogKey === 'khoaPhong') {
            const firstDept =
                activeSpecialtyList[0]?.ten_chuyen_khoa ||
                activeSpecialtyList[0]?.tenChuyenKhoa ||
                activeSpecialtyList[0]?.name ||
                'Khoa Nội tổng quát'
            setForm({
                id: '',
                maPhong: getNextCode(targetList, 'PK', 2),
                tenPhong: '',
                chuyenKhoa: firstDept,
                tang: 'Tầng 1',
                bacSiPhuTrach: '',
                trangThai: true,
                is_active: true,
            })
        } else if (activeCatalogKey === 'danhMucBenh') {
            setForm({
                id: '',
                maICD: '',
                tenBenh: '',
                chuongBenh: 'Chương X: Bệnh hệ hô hấp',
                truyenNhiem: false,
                trangThai: true,
                is_active: true,
            })
        } else if (activeCatalogKey === 'thuocVatTu') {
            setForm({
                id: '',
                maThuoc: getNextCode(targetList, 'TH', 3),
                tenThuoc: '',
                hoatChat: '',
                hamLuong: '',
                dvt: 'Viên',
                duongDung: 'Uống',
                nhomThuoc: 'Thuốc kê đơn',
                trangThai: true,
                is_active: true,
            })
        } else if (activeCatalogKey === 'dichVu') {
            setForm({
                id: '',
                maDV: getNextCode(targetList, 'DV', 3),
                tenDV: '',
                nhomDV: 'Khám bệnh',
                dvt: 'Lần',
                donGia: 150000,
                vat_percent: 0,
                thoi_gian_thuc_hien: 15,
                phongTH: 'Phòng số 1 (Phòng khám Nội)',
                trangThai: true,
                is_active: true,
            })
        } else {
            setForm({
                id: '',
                ma: '',
                ten: '',
                noiDung: '',
                moTa: '',
                donGiaMacDinh: 100000,
                thuTu: targetList.length + 1,
                trangThai: true,
                is_active: true,
            })
        }
    }

    const handleSaveItem = async () => {
        const dupError = checkDuplicateCode(form, listData, activeCatalogKey)
        if (dupError) {
            AppToast.error(dupError)
            return
        }

        if (activeCatalogKey === 'chuyenKhoa') {
            if (!form.tenChuyenKhoa?.trim()) {
                AppToast.error('Vui lòng nhập Tên chuyên khoa lâm sàng!')
                return
            }
            form.maChuyenKhoa = (form.maChuyenKhoa || '').trim().toUpperCase()
        } else if (activeCatalogKey === 'danhMucBenh') {
            if (!form.tenBenh?.trim()) {
                AppToast.error('Vui lòng nhập Tên bệnh chuẩn Bộ Y tế!')
                return
            }
            form.maICD = (form.maICD || '').trim().toUpperCase()
        } else if (activeCatalogKey === 'thuocVatTu' && !form.tenThuoc?.trim()) {
            AppToast.error('Vui lòng nhập Tên biệt dược / Thuốc thương mại!')
            return
        } else if (activeCatalogKey === 'dichVu' && !form.tenDV?.trim()) {
            AppToast.error('Vui lòng nhập Tên dịch vụ khám / Cận lâm sàng!')
            return
        } else if (activeCatalogKey === 'khoaPhong' && !form.tenPhong?.trim()) {
            AppToast.error('Vui lòng nhập Tên Khoa / Phòng khám!')
            return
        }

        const formKey = getItemUniqueKey(form)
        const exists = listData.some((item) => {
            const itemKey = getItemUniqueKey(item)
            return Boolean(itemKey && formKey && itemKey === formKey)
        })
        const isCurrentActive = form.trangThai !== false && form.is_active !== false
        const sanitizedForm = {
            ...form,
            trangThai: isCurrentActive,
            is_active: isCurrentActive,
        }
        if (activeCatalogKey === 'khoaPhong' && matchedDoctorInList) {
            sanitizedForm.bacSiPhuTrach =
                matchedDoctorInList.hoTen ||
                matchedDoctorInList.ho_ten ||
                matchedDoctorInList.name ||
                sanitizedForm.bacSiPhuTrach
        }

        let unitRenamedMsg = ''
        if (activeCatalogKey === 'donViTinh' && exists) {
            const oldItem = listData.find((item) => getItemUniqueKey(item) === formKey)
            const oldUnitName = oldItem ? (oldItem.ten || oldItem.noiDung || oldItem.ma || '').trim() : ''
            const newUnitName = (sanitizedForm.ten || sanitizedForm.noiDung || sanitizedForm.ma || '').trim()
            if (oldUnitName && newUnitName && oldUnitName !== newUnitName) {
                unitRenamedMsg = `Đã cập nhật ĐVT "${oldUnitName}" thành "${newUnitName}" và tự động đồng bộ sang toàn bộ danh mục Thuốc & Dịch vụ!`
            }
        }

        let updated
        if (exists) {
            updated = listData.map((item) =>
                getItemUniqueKey(item) === formKey ? { ...item, ...sanitizedForm } : item
            )
        } else {
            const newItem = {
                ...sanitizedForm,
                id: `${activeCatalogKey.toUpperCase()}-${Date.now().toString().slice(-4)}`,
            }
            updated = [...listData, newItem]
        }

        await dispatch(
            updateCatalogSubCollectionAsync({
                subKey: activeCatalogKey,
                items: updated,
                auditEntry: {
                    hanhDong: exists ? 'UPDATE_CATALOG_ITEM' : 'CREATE_CATALOG_ITEM',
                    mucDich: `Cập nhật phân hệ Danh mục (${activeCatalogKey})`,
                },
            })
        )
        if (unitRenamedMsg) {
            AppToast.success(unitRenamedMsg)
        }
        if (activeCatalogKey === 'chuyenKhoa') {
            setDepartmentsList((prev) => {
                const fCode = (sanitizedForm.maChuyenKhoa || sanitizedForm.id || '').toString()
                const fName = (sanitizedForm.tenChuyenKhoa || sanitizedForm.ten || '').toString()
                const existsInDept = prev.some((d) => {
                    const dCode = (d.ma_chuyen_khoa || d.maChuyenKhoa || d.id || '').toString()
                    const dName = (d.ten_chuyen_khoa || d.tenChuyenKhoa || d.name || '').toString()
                    return (dCode && dCode === fCode) || (dName && dName === fName)
                })
                if (existsInDept) {
                    return prev.map((d) => {
                        const dCode = (d.ma_chuyen_khoa || d.maChuyenKhoa || d.id || '').toString()
                        const dName = (d.ten_chuyen_khoa || d.tenChuyenKhoa || d.name || '').toString()
                        if ((dCode && dCode === fCode) || (dName && dName === fName)) {
                            return { ...d, ...sanitizedForm, ten_chuyen_khoa: sanitizedForm.tenChuyenKhoa }
                        }
                        return d
                    })
                }
                return [...prev, { ...sanitizedForm, ten_chuyen_khoa: sanitizedForm.tenChuyenKhoa }]
            })
        }
        handleNewItem(updated)
    }

    const handleToggleStatus = async () => {
        const formKey = getItemUniqueKey(form)
        if (!formKey) return
        const isCurrentlyActive = form.trangThai !== false && form.is_active !== false
        const nextStatus = !isCurrentlyActive
        const updatedForm = { ...form, trangThai: nextStatus, is_active: nextStatus }
        const updated = listData.map((item) =>
            getItemUniqueKey(item) === formKey ? updatedForm : item
        )
        setForm(updatedForm)
        await dispatch(
            updateCatalogSubCollectionAsync({
                subKey: activeCatalogKey,
                items: updated,
                auditEntry: {
                    hanhDong: nextStatus ? 'ACTIVATE_CATALOG_ITEM' : 'INACTIVATE_CATALOG_ITEM',
                    mucDich: `${nextStatus ? 'Khôi phục' : 'Tạm ngưng/Ẩn'} bản ghi danh mục (${activeCatalogKey})`,
                },
            })
        )
        if (activeCatalogKey === 'chuyenKhoa') {
            setDepartmentsList((prev) =>
                prev.map((d) => {
                    const dCode = (d.ma_chuyen_khoa || d.maChuyenKhoa || d.id || '').toString()
                    const fCode = (updatedForm.maChuyenKhoa || updatedForm.id || '').toString()
                    const dName = (d.ten_chuyen_khoa || d.tenChuyenKhoa || d.name || '').toString()
                    const fName = (updatedForm.tenChuyenKhoa || updatedForm.ten || '').toString()
                    if ((dCode && dCode === fCode) || (dName && dName === fName)) {
                        return { ...d, is_active: nextStatus, trangThai: nextStatus }
                    }
                    return d
                })
            )
        }
    }

    const handleDeleteItem = async () => {
        const formKey = getItemUniqueKey(form)
        if (!formKey) return
        const updated = listData.filter((item) => getItemUniqueKey(item) !== formKey)
        const res = await dispatch(
            updateCatalogSubCollectionAsync({
                subKey: activeCatalogKey,
                items: updated,
                deletedItem: form,
                deletedItemKey: formKey,
                auditEntry: {
                    hanhDong: 'DELETE_CATALOG_ITEM',
                    mucDich: `Xóa hẳn bản ghi khỏi danh mục (${activeCatalogKey})`,
                },
            })
        )
        if (res?.error) {
            return
        }
        AppToast.success('Đã xóa bản ghi khỏi danh mục thành công!')
        handleNewItem(updated)
    }

    const filteredList = useMemo(() => {
        let base = listData
        if (loaiDanhMuc === 'chung' && activeGeneralSubTab === 'donViTinh' && dvtScopeFilter !== 'ALL') {
            base = base.filter((u) => {
                const scope = String(u.loai || u.phamVi || '').toUpperCase()
                if (dvtScopeFilter === 'THUOC') return !scope || scope === 'THUOC' || scope === 'CHUNG'
                if (dvtScopeFilter === 'DICH_VU') return !scope || scope === 'DICH_VU' || scope === 'CHUNG'
                if (dvtScopeFilter === 'CHUNG') return scope === 'CHUNG'
                return true
            })
        }
        if (!searchText.trim()) return base
        const searchRaw = searchText.toLowerCase().trim()
        const searchNorm = removeVietnameseTones(searchText)
        return base.filter((item) => {
            const rawJson = JSON.stringify(item).toLowerCase()
            const normJson = removeVietnameseTones(rawJson)
            return rawJson.includes(searchRaw) || normJson.includes(searchNorm)
        })
    }, [listData, searchText, loaiDanhMuc, activeGeneralSubTab, dvtScopeFilter])

    const handleExportCatalog = () => {
        const configuredClinicName = (settings.tenPhongKham || settings.tenCoSo || 'Phòng Khám Đa Khoa Quốc Tế Clinic-AI').toUpperCase()
        const configuredClinicAddress = [
            settings.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
            settings.dienThoai ? `Hotline: ${settings.dienThoai}` : 'Hotline: 1900 2115',
            settings.giayPhepHoatDong ? `GPHĐ: ${settings.giayPhepHoatDong}` : 'GPHĐ: Số 1428/HNO-GPHĐ',
        ].filter(Boolean).join(' | ')

        let title = 'DANH MỤC DỮ LIỆU CƠ SỞ Y TẾ'
        let headers = []
        let rows = []

        if (loaiDanhMuc === 'dich-vu') {
            title = 'BẢNG GIÁ DỊCH VỤ KỸ THUẬT & KHÁM BỆNH NIÊM YẾT'
            headers = ['Mã DV', 'Tên dịch vụ kỹ thuật', 'Nhóm dịch vụ', 'Đơn vị tính', 'Đơn giá niêm yết (VNĐ)', 'Trạng thái']
            rows = filteredList.map((item) => [
                item.maDV || item.ma || '',
                item.tenDV || item.ten || '',
                item.nhomDV || 'Khám bệnh',
                item.dvt || 'Lần',
                Number(item.donGia || 0),
                item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
            ])
        } else if (loaiDanhMuc === 'benh') {
            title = 'DANH MỤC MÃ BỆNH QUỐC TẾ (ICD-10 CHUẨN BỘ Y TẾ)'
            headers = ['Mã ICD-10', 'Tên bệnh / Chẩn đoán y khoa', 'Chương bệnh', 'Truyền nhiễm / Báo cáo dịch', 'Trạng thái']
            rows = filteredList.map((item) => [
                item.maICD || item.ma || '',
                item.tenBenh || item.ten || '',
                item.chuongBenh || '',
                item.truyenNhiem ? 'Bệnh truyền nhiễm (Cần báo cáo dịch)' : 'Không',
                item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
            ])
        } else if (loaiDanhMuc === 'thuoc-vat-tu') {
            title = 'DANH MỤC THUỐC & DƯỢC PHẨM KÊ ĐƠN BỘ Y TẾ'
            headers = ['Mã thuốc', 'Tên thuốc & Biệt dược', 'Hoạt chất & Hàm lượng', 'Đường dùng', 'Đơn vị tính', 'Nhóm thuốc', 'Trạng thái']
            rows = filteredList.map((item) => [
                item.maThuoc || item.ma || '',
                item.tenThuoc || item.ten || '',
                item.hoatChat || '',
                item.duongDung || 'Đường uống',
                item.dvt || 'Viên',
                item.nhomThuoc || 'Thuốc kê đơn',
                item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
            ])
        } else if (loaiDanhMuc === 'chuyen-khoa') {
            title = 'DANH MỤC CHUYÊN KHOA LÂM SÀNG & KHU VỰC KHÁM BỆNH'
            headers = ['Mã chuyên khoa', 'Tên chuyên khoa lâm sàng', 'Vị trí khu vực', 'Mô tả chuyên môn', 'Trạng thái']
            rows = filteredList.map((item) => [
                item.maChuyenKhoa || item.ma || '',
                item.tenChuyenKhoa || item.ten || '',
                item.viTriPhong || '',
                item.moTa || '',
                item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
            ])
        } else if (loaiDanhMuc === 'khoa-phong') {
            title = 'DANH MỤC KHOA PHÒNG & BUỒNG KHÁM CHUYÊN KHOA'
            headers = ['Mã buồng / phòng', 'Tên khoa phòng', 'Chuyên khoa phụ trách', 'Vị trí tầng', 'Bác sĩ phụ trách chuyên môn', 'Trạng thái']
            rows = filteredList.map((item) => [
                item.maPhong || item.ma || '',
                item.tenPhong || item.ten || '',
                item.chuyenKhoa || '',
                item.tang || 'Tầng 1',
                item.bacSiPhuTrach || '',
                item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
            ])
        } else if (loaiDanhMuc === 'dia-chi') {
            title = 'DANH MỤC ĐỊA BÀN HÀNH CHÍNH Y TẾ'
            headers = ['Mã Tỉnh / TP', 'Tỉnh / Thành phố', 'Quận / Huyện', 'Phường / Xã', 'Trạng thái']
            rows = filteredList.map((item) => [
                item.maTinh || item.ma || '',
                item.tenTinh || item.ten || '',
                item.quanHuyen || '',
                item.phuongXa || '',
                item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
            ])
        } else {
            if (activeGeneralSubTab === 'khoanThu') {
                title = 'DANH MỤC KHOẢN THU PHÍ & LỆ PHÍ VIỆN PHÍ'
                headers = ['Mã khoản thu', 'Tên khoản thu viện phí', 'Đơn giá định mức (VNĐ)', 'Trạng thái']
                rows = filteredList.map((item) => [
                    item.ma || '',
                    item.ten || '',
                    Number(item.donGiaMacDinh || 0),
                    item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
                ])
            } else if (activeGeneralSubTab === 'donViTinh') {
                title = 'DANH MỤC ĐƠN VỊ TÍNH CHUẨN Y TẾ'
                headers = ['Mã ĐVT', 'Tên đơn vị tính', 'Mô tả phạm vi áp dụng', 'Trạng thái']
                rows = filteredList.map((item) => [
                    item.ma || '',
                    item.ten || '',
                    item.moTa || '',
                    item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
                ])
            } else if (activeGeneralSubTab === 'phuongPhapTruDau') {
                title = 'DANH MỤC PHƯƠNG PHÁP TRỪ ĐAU & GÂY MÊ HỒI SỨC'
                headers = ['Mã phương pháp', 'Tên phương pháp', 'Mô tả kỹ thuật', 'Trạng thái']
                rows = filteredList.map((item) => [
                    item.ma || '',
                    item.ten || '',
                    item.moTa || '',
                    item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
                ])
            } else {
                title = 'DANH MỤC TỪ VIẾT TẮT & GÕ TẮT LÂM SÀNG'
                headers = ['Mã gõ tắt', 'Nội dung mở rộng / Cụm từ thay thế', 'Thứ tự', 'Trạng thái']
                rows = filteredList.map((item) => [
                    item.ma || '',
                    item.noiDung || '',
                    item.thuTu || 1,
                    item.trangThai !== false && item.is_active !== false ? 'Hoạt động' : 'Tạm dừng',
                ])
            }
        }

        exportToExcel({
            filename: `danh-muc-${loaiDanhMuc}_${new Date().toISOString().slice(0, 10)}.xlsx`,
            sheetName: 'Danh Mục',
            title,
            subtitle: `Phân hệ Quản trị Danh mục Y tế • Tổng số: ${rows.length} bản ghi`,
            clinicName: configuredClinicName,
            clinicAddress: configuredClinicAddress,
            headers,
            rows,
            signOff: true,
        })
        AppToast.success(`Đã xuất ${rows.length} bản ghi danh mục ra file Excel (.xlsx) thành công!`)
    }

    return (
        <div className="space-y-3.5">
            
            <div className="medpro-card p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(catalogRouteMap).map(([key, meta]) => {
                        const active = loaiDanhMuc === key
                        const targetSubKey = getCatalogSubKeyByRoute(key, activeGeneralSubTab)
                        return (
                            <Link
                                key={key}
                                to={meta.path}
                                onClick={() =>
                                    handleSwitchCatalogView(
                                        catalogs[targetSubKey] || []
                                    )
                                }
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                                    active
                                        ? 'bg-[#00B5F1] text-white shadow-xs'
                                        : 'bg-[#F0F7FC] text-[#003553] hover:bg-[#00B5F1]/15'
                                }`}
                            >
                                <ClinicIcon name={meta.icon || 'Folders'} size={14} weight={active ? 'fill' : 'duotone'} />
                                <span>{meta.title}</span>
                            </Link>
                        )
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportCatalog}
                        className="medpro-btn-outline !py-1 !px-3 text-xs"
                    >
                        <UploadSimple size={14} weight="bold" className="text-[#00B5F1]" />
                        <span>Xuất Excel</span>
                    </button>
                </div>
            </div>

            
            {loaiDanhMuc === 'chung' && (
                <div className="medpro-card p-2.5 flex flex-wrap items-center gap-1.5 bg-[#F8FBFE]">
                    {generalSubTabs.map((sub) => {
                        const active = activeGeneralSubTab === sub.key
                        return (
                            <button
                                key={sub.key}
                                type="button"
                                onClick={() => {
                                    setActiveGeneralSubTab(sub.key)
                                    setForm((catalogs[sub.key] || [])[0] || {})
                                }}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                                    active
                                        ? 'bg-[#003553] text-white shadow-xs'
                                        : 'bg-white text-[#003553] border border-[#CBE9FA] hover:border-[#00B5F1]'
                                }`}
                            >
                                <ClinicIcon
                                    name={sub.icon || 'SlidersHorizontal'}
                                    size={14}
                                    weight={active ? 'fill' : 'duotone'}
                                    className={active ? 'text-[#00B5F1]' : 'text-[#00B5F1]'}
                                />
                                <span>
                                    {sub.label} ({(catalogs[sub.key] || []).length})
                                </span>
                            </button>
                        )
                    })}
                </div>
            )}

            
            {loaiDanhMuc === 'dich-vu' && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-sky-50 via-[#E8F4FD] to-indigo-50/60 p-3 rounded-xl border border-[#00B5F1]/30">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-[#003553] text-[#00B5F1] flex items-center justify-center shrink-0">
                            <ClinicIcon name="Hospital" size={18} weight="duotone" />
                        </span>
                        <div>
                            <div className="text-xs font-extrabold text-[#003553]">
                                DANH MỤC DỊCH VỤ KỸ THUẬT & BẢNG GIÁ Y TẾ NIÊM YẾT
                            </div>
                            <div className="text-[11px] text-slate-500">
                                Quản lý Đơn vị tính (Lần/Test/Răng), Thuế suất VAT theo Luật Thuế GTGT, Thời gian thực hiện và Doanh thu tích lũy.
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleExportServicesToExcel}
                        disabled={exportLoading}
                        className="px-3.5 py-1.5 rounded-lg bg-[#00B5F1] hover:bg-[#009cd1] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <DownloadSimple size={14} weight="bold" />
                        <span>{exportLoading ? 'Đang xuất dữ liệu…' : 'Xuất Bảng giá Dịch vụ Chuẩn y tế (Excel)'}</span>
                    </button>
                </div>
            )}

            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    
                    <div className="lg:col-span-6 medpro-card p-3.5 flex flex-col h-[calc(100vh-195px)]">
                        <div className="medpro-section-title">
                            <span>
                                DANH SÁCH BẢN GHI ({filteredList.length}) — {catalogRouteMap[loaiDanhMuc]?.title?.toUpperCase()}
                            </span>
                        </div>

                    {loaiDanhMuc === 'chung' && activeGeneralSubTab === 'donViTinh' && (
                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                            {[
                                { id: 'ALL', label: `Tất cả (${listData.length})` },
                                { id: 'THUOC', label: `Thuốc (${listData.filter(u => (!u.loai && !u.phamVi) || u.loai === 'THUOC' || u.phamVi === 'THUOC' || u.loai === 'CHUNG' || u.phamVi === 'CHUNG').length})` },
                                { id: 'DICH_VU', label: `Dịch vụ (${listData.filter(u => (!u.loai && !u.phamVi) || u.loai === 'DICH_VU' || u.phamVi === 'DICH_VU' || u.loai === 'CHUNG' || u.phamVi === 'CHUNG').length})` },
                                { id: 'CHUNG', label: `Dùng chung (${listData.filter(u => u.loai === 'CHUNG' || u.phamVi === 'CHUNG').length})` },
                            ].map((pill) => (
                                <button
                                    key={pill.id}
                                    type="button"
                                    onClick={() => setDvtScopeFilter(pill.id)}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                        dvtScopeFilter === pill.id
                                            ? 'bg-[#00B5F1] text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {pill.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mb-3 relative">
                        <MagnifyingGlass
                            size={14}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Tìm kiếm nhanh theo mã, tên, hoạt chất, khoa phòng..."
                            className="medpro-input !pl-8"
                        />
                    </div>

                    <div key={activeCatalogKey} className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl">
                        <table key={activeCatalogKey} className="medpro-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Mã / Ký hiệu</th>
                                    <th>Tên / Nội dung danh mục</th>
                                    <th>Thông tin phụ</th>
                                    <th>TT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((item, idx) => {
                                    const code =
                                        item.maChuyenKhoa || item.ma || item.maTinh || item.maPhong || item.maICD || item.maThuoc || item.maDV
                                    const name =
                                        item.tenChuyenKhoa ||
                                        item.ten ||
                                        item.noiDung ||
                                        item.tenTinh ||
                                        item.tenPhong ||
                                        item.tenBenh ||
                                        item.tenThuoc ||
                                        item.tenDV
                                    const extra =
                                        activeCatalogKey === 'chuyenKhoa'
                                            ? item.viTriPhong ? `${item.viTriPhong}${item.moTa ? ` • ${item.moTa}` : ''}` : item.moTa || 'Chuyên khoa lâm sàng'
                                            : activeCatalogKey === 'thuocVatTu'
                                            ? item.hoatChat
                                                ? `${item.hoatChat} • ${item.dvt || item.donViTinh || 'Viên'} (${item.nhomThuoc || 'Kê đơn'})`
                                                : `${item.dvt || item.donViTinh || 'Viên'} • ${item.nhomThuoc || 'Kê đơn'}`
                                            : activeCatalogKey === 'dichVu'
                                            ? `${Number(item.donGia || 0).toLocaleString('vi-VN')} đ / ${item.dvt || item.donViTinh || 'Lần'} • ${item.nhomDV || 'Khám bệnh'}`
                                            : activeCatalogKey === 'danhMucBenh'
                                            ? item.truyenNhiem
                                                ? `🚨 Truyền nhiễm • ${item.chuongBenh || 'ICD-10'}`
                                                : item.chuongBenh || 'ICD-10'
                                            : activeGeneralSubTab === 'donViTinh' && loaiDanhMuc === 'chung'
                                            ? (() => {
                                                const scope = String(item.loai || item.phamVi || 'CHUNG').toUpperCase()
                                                const scopeLabel = scope === 'THUOC' ? 'Thuốc kê đơn' : scope === 'DICH_VU' ? 'Dịch vụ KT' : 'Dùng chung'
                                                const scopeBadgeClass =
                                                    scope === 'THUOC'
                                                        ? 'bg-sky-50 text-[#00B5F1] border border-sky-200'
                                                        : scope === 'DICH_VU'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-violet-50 text-violet-700 border border-violet-200'
                                                return (
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${scopeBadgeClass}`}>
                                                                {scopeLabel}
                                                            </span>
                                                            {item.usageCount > 0 && (
                                                                <span className="text-[11px] font-semibold text-slate-500">
                                                                    📦 {item.usageCount} bản ghi
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-slate-500 truncate max-w-[240px]">
                                                            {item.moTa || 'Đơn vị tính y tế chuẩn'}
                                                        </span>
                                                    </div>
                                                )
                                            })()
                                            : item.donGiaMacDinh
                                            ? `${Number(item.donGiaMacDinh).toLocaleString('vi-VN')} đ`
                                            : item.donGia
                                            ? `${Number(item.donGia).toLocaleString('vi-VN')} đ`
                                            : item.quanHuyen
                                            ? `${item.quanHuyen} - ${item.phuongXa}`
                                            : item.chuyenKhoa || item.chuongBenh || item.moTa || ''

                                    const isInactive =
                                        item.trangThai === false || item.is_active === false

                                    const itemKey = getItemUniqueKey(item)
                                    const formKey = getItemUniqueKey(form)
                                    const isSelected = Boolean(formKey && itemKey && formKey === itemKey)

                                    return (
                                        <tr
                                            key={`${activeCatalogKey}-${itemKey || idx}`}
                                            onClick={() => setForm({ ...item })}
                                            className={`cursor-pointer transition-colors ${
                                                isInactive
                                                    ? '!bg-slate-100/90 text-slate-400 opacity-60 italic hover:!bg-slate-200/70'
                                                    : 'hover:bg-sky-50/50'
                                            } ${
                                                isSelected
                                                    ? isInactive
                                                        ? '!bg-slate-200 font-semibold border-l-4 border-l-slate-400 shadow-2xs'
                                                        : '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]'
                                                    : ''
                                            }`}
                                        >
                                            <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                            <td className={`font-mono font-bold ${isInactive ? 'text-slate-400 line-through' : 'text-[#00B5F1]'}`}>{code}</td>
                                            <td className={`font-semibold ${isInactive ? 'text-slate-500' : 'text-[#12263F]'}`}>{name}</td>
                                            <td className="text-xs text-slate-500">{extra}</td>
                                            <td>
                                                <StatusBadge status={!isInactive ? 'Hoạt động' : 'Tạm ngưng'} compact />
                                            </td>
                                        </tr>
                                    )
                                })}
                                {filteredList.length === 0 && (
                                    <tr>
                                        <td colSpan={5}>
                                            <EmptyState icon="Folders" title="Không tìm thấy bản ghi danh mục" />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                
                <div className="lg:col-span-6 medpro-card p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F4FD] pb-3">
                        <div>
                            <h2 className="font-display font-extrabold text-base text-[#003553] uppercase">
                                CHI TIẾT BẢN GHI DANH MỤC
                            </h2>
                            <p className="text-xs text-slate-500">
                                Chỉnh sửa hoặc thêm mới dữ liệu chuẩn hóa dùng chung toàn phòng khám
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button type="button" onClick={() => handleNewItem()} className="medpro-btn-outline text-xs">
                                <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                                <span>Làm mới / Tạo mới</span>
                            </button>
                            <button type="button" onClick={handleSaveItem} className="medpro-btn-primary text-xs">
                                <FloppyDisk size={15} weight="bold" />
                                <span>Lưu danh mục</span>
                            </button>
                            {getItemUniqueKey(form) && (
                                <button
                                    type="button"
                                    onClick={handleToggleStatus}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer shadow-xs ${
                                        form.trangThai === false || form.is_active === false
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                                    }`}
                                    title={
                                        form.trangThai === false || form.is_active === false
                                            ? 'Kích hoạt lại bản ghi này'
                                            : 'Tạm ngưng / Ẩn bản ghi này (bôi xám)'
                                    }
                                >
                                    <ClinicIcon
                                        name={
                                            form.trangThai === false || form.is_active === false
                                                ? 'CheckCircle'
                                                : 'Prohibit'
                                        }
                                        size={14}
                                        weight="bold"
                                    />
                                    <span>
                                        {form.trangThai === false || form.is_active === false
                                            ? 'Khôi phục'
                                            : 'Tạm ngưng / Ẩn'}
                                    </span>
                                </button>
                            )}
                            {getItemUniqueKey(form) && (
                                <button
                                    type="button"
                                    onClick={handleDeleteItem}
                                    className="medpro-btn-danger text-xs !px-2"
                                    title="Xóa hẳn bản ghi khỏi danh mục"
                                >
                                    <Trash size={14} weight="bold" />
                                    <span>Xóa</span>
                                </button>
                            )}
                        </div>
                    </div>

                    
                    {activeCatalogKey === 'diaChi' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã Tỉnh / Thành phố</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maTinh || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                                    title="Mã Tỉnh / Thành phố do hệ thống tự sinh, không thể chỉnh sửa"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Tên Tỉnh / Thành phố *</label>
                                <input
                                    type="text"
                                    value={form.tenTinh || ''}
                                    onChange={(e) => setForm({ ...form, tenTinh: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Quận / Huyện *</label>
                                <input
                                    type="text"
                                    value={form.quanHuyen || ''}
                                    onChange={(e) => setForm({ ...form, quanHuyen: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Phường / Xã *</label>
                                <input
                                    type="text"
                                    value={form.phuongXa || ''}
                                    onChange={(e) => setForm({ ...form, phuongXa: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'chuyenKhoa' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã chuyên khoa *</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Chuẩn hóa KCB
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maChuyenKhoa || ''}
                                    onChange={(e) => setForm({ ...form, maChuyenKhoa: e.target.value.toUpperCase() })}
                                    placeholder="VD: KHOA_NOI, KHOA_NHI..."
                                    className="medpro-input font-mono font-bold text-[#00B5F1]"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Vị trí khu vực / Phòng đại diện</label>
                                <input
                                    type="text"
                                    value={form.viTriPhong || ''}
                                    onChange={(e) => setForm({ ...form, viTriPhong: e.target.value })}
                                    placeholder="VD: Tầng 1 - Khu A, Tầng 2..."
                                    className="medpro-input"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên chuyên khoa lâm sàng *</label>
                                <input
                                    type="text"
                                    value={form.tenChuyenKhoa || ''}
                                    onChange={(e) => setForm({ ...form, tenChuyenKhoa: e.target.value })}
                                    placeholder="VD: Khoa Nội tổng quát, Khoa Nhi, Khoa Mắt..."
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Mô tả nhiệm vụ & phạm vi chuyên môn</label>
                                <textarea
                                    rows={2}
                                    value={form.moTa || ''}
                                    onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                                    placeholder="Mô tả tóm tắt phạm vi chuyên môn khám chữa bệnh của chuyên khoa..."
                                    className="medpro-input resize-none text-xs"
                                />
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'khoaPhong' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã phòng khám</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maPhong || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                                    title="Mã phòng khám do hệ thống tự sinh, không thể sửa"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Tên Khoa / Phòng khám *</label>
                                <input
                                    type="text"
                                    value={form.tenPhong || ''}
                                    onChange={(e) => setForm({ ...form, tenPhong: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Chuyên khoa phụ trách *</label>
                                <select
                                    value={form.chuyenKhoa || ''}
                                    onChange={(e) => {
                                        const newDept = e.target.value
                                        setForm((prev) => ({
                                            ...prev,
                                            chuyenKhoa: newDept,
                                            bacSiPhuTrach: '',
                                        }))
                                    }}
                                    className="medpro-input font-medium bg-white"
                                >
                                    <option value="">-- Chọn chuyên khoa từ cơ sở dữ liệu --</option>
                                    {activeSpecialtyList.map((dept) => {
                                        const name =
                                            dept.ten_chuyen_khoa ||
                                            dept.tenChuyenKhoa ||
                                            dept.name ||
                                            dept.ten
                                        return (
                                            <option
                                                key={
                                                    dept.id ||
                                                    dept.ma_chuyen_khoa ||
                                                    dept.maChuyenKhoa ||
                                                    name
                                                }
                                                value={name}
                                            >
                                                {name}
                                            </option>
                                        )
                                    })}
                                    {form.chuyenKhoa &&
                                        !activeSpecialtyList.some(
                                            (d) =>
                                                (d.ten_chuyen_khoa ||
                                                    d.tenChuyenKhoa ||
                                                    d.name ||
                                                    d.ten) === form.chuyenKhoa
                                        ) && (
                                            <option value={form.chuyenKhoa}>
                                                {form.chuyenKhoa} (Đã tạm ngưng)
                                            </option>
                                        )}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Vị trí tầng</label>
                                <input
                                    type="text"
                                    value={form.tang || ''}
                                    onChange={(e) => setForm({ ...form, tang: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Bác sĩ phụ trách chuyên môn phòng *</label>
                                    {form.chuyenKhoa && (
                                        <span className="text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                                            Khoa: <strong>{form.chuyenKhoa}</strong> ({doctorsForDepartment.length} bác sĩ)
                                        </span>
                                    )}
                                </div>
                                <select
                                    value={
                                        matchedDoctorInList
                                            ? (matchedDoctorInList.hoTen || matchedDoctorInList.ho_ten || matchedDoctorInList.name)
                                            : (form.bacSiPhuTrach || '')
                                    }
                                    disabled={!form.chuyenKhoa}
                                    onChange={(e) => setForm({ ...form, bacSiPhuTrach: e.target.value })}
                                    className={`medpro-input font-semibold text-[#003553] bg-white ${
                                        !form.chuyenKhoa ? '!bg-slate-100 !text-slate-400 cursor-not-allowed' : ''
                                    }`}
                                >
                                    {!form.chuyenKhoa ? (
                                        <option value="">-- Vui lòng chọn Chuyên khoa phụ trách ở trên trước --</option>
                                    ) : doctorsForDepartment.length === 0 ? (
                                        <option value="">-- Chưa có bác sĩ thuộc {form.chuyenKhoa} --</option>
                                    ) : (
                                        <option value="">-- Chọn bác sĩ thuộc {form.chuyenKhoa} ({doctorsForDepartment.length} bác sĩ) --</option>
                                    )}
                                    {doctorsForDepartment.map((doc) => {
                                        const docName = doc.hoTen || doc.ho_ten || doc.name || 'Bác sĩ'
                                        return (
                                            <option key={doc.id || doc.maNV || docName} value={docName}>
                                                {docName}
                                            </option>
                                        )
                                    })}
                                    {form.bacSiPhuTrach && !matchedDoctorInList && (
                                        <option value={form.bacSiPhuTrach}>{form.bacSiPhuTrach}</option>
                                    )}
                                </select>
                                {!form.chuyenKhoa && (
                                    <p className="text-[11px] text-amber-600 mt-1 italic">
                                        * Hãy chọn chuyên khoa ở ô bên trên, danh sách bác sĩ sẽ tự động tải tương ứng theo khoa đã chọn.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'danhMucBenh' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">Mã bệnh Quốc tế ICD-10 *</label>
                                <input
                                    type="text"
                                    value={form.maICD || ''}
                                    onChange={(e) => {
                                        const newCode = e.target.value.toUpperCase()
                                        const autoChapter = detectIcdChapter(newCode)
                                        const isInf = newCode.startsWith('A') || newCode.startsWith('B')
                                        setForm((prev) => ({
                                            ...prev,
                                            maICD: newCode,
                                            ...(autoChapter ? { chuongBenh: autoChapter } : {}),
                                            ...(newCode.length >= 2 ? { truyenNhiem: prev.truyenNhiem || isInf } : {}),
                                        }))
                                    }}
                                    placeholder="Ví dụ: J02, I10, K29, A09..."
                                    className="medpro-input font-mono font-bold text-[#00B5F1]"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Chương bệnh ICD-10</label>
                                <select
                                    value={form.chuongBenh || 'Chương X: Bệnh hệ hô hấp'}
                                    onChange={(e) => setForm({ ...form, chuongBenh: e.target.value })}
                                    className="medpro-input bg-white font-medium"
                                >
                                    {ICD10_CHAPTERS.map((ch) => (
                                        <option key={ch.value} value={ch.value}>
                                            {ch.label}
                                        </option>
                                    ))}
                                    {form.chuongBenh &&
                                        !ICD10_CHAPTERS.some(
                                            (ch) => ch.value === form.chuongBenh || ch.label === form.chuongBenh
                                        ) && (
                                            <option value={form.chuongBenh}>{form.chuongBenh}</option>
                                        )}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên bệnh lý chuẩn Bộ Y tế *</label>
                                <input
                                    type="text"
                                    value={form.tenBenh || ''}
                                    onChange={(e) => setForm({ ...form, tenBenh: e.target.value })}
                                    placeholder="Ví dụ: Viêm họng cấp tính, Tăng huyết áp nguyên phát..."
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                                <input
                                    id="chk-truyennhiem"
                                    type="checkbox"
                                    checked={Boolean(form.truyenNhiem)}
                                    onChange={(e) => setForm({ ...form, truyenNhiem: e.target.checked })}
                                    className="w-4 h-4 accent-[#00B5F1]"
                                />
                                <label htmlFor="chk-truyennhiem" className="text-xs font-bold text-rose-600 cursor-pointer">
                                    Thuộc nhóm Bệnh truyền nhiễm bắt buộc cảnh báo dịch tễ (LAW-01)
                                </label>
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'thuocVatTu' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã thuốc kê đơn *</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maThuoc || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                                    title="Mã thuốc do hệ thống tự sinh theo chuẩn THxxx, không thể sửa"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Nhóm dược lý / Phân loại</label>
                                <input
                                    type="text"
                                    value={form.nhomThuoc || ''}
                                    onChange={(e) => setForm({ ...form, nhomThuoc: e.target.value })}
                                    placeholder="VD: Kháng sinh, Hạ sốt..."
                                    className="medpro-input"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên biệt dược / Thuốc thương mại *</label>
                                <input
                                    type="text"
                                    value={form.tenThuoc || ''}
                                    onChange={(e) => setForm({ ...form, tenThuoc: e.target.value })}
                                    placeholder="VD: Augmentin 1g, Efferalgan 500mg..."
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Hoạt chất chính (Chuẩn Cổng Đơn thuốc QG)</label>
                                <input
                                    type="text"
                                    value={form.hoatChat || ''}
                                    onChange={(e) => setForm({ ...form, hoatChat: e.target.value })}
                                    placeholder="VD: Amoxicillin, Paracetamol..."
                                    className="medpro-input font-mono"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Hàm lượng (Chuẩn kê đơn)</label>
                                <input
                                    type="text"
                                    value={form.hamLuong || ''}
                                    onChange={(e) => setForm({ ...form, hamLuong: e.target.value })}
                                    placeholder="VD: 500mg, 875mg/125mg..."
                                    className="medpro-input font-mono"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Đơn vị tính (DVT) *</label>
                                <select
                                    value={form.dvt || 'Viên'}
                                    onChange={(e) => setForm({ ...form, dvt: e.target.value, donViTinh: e.target.value })}
                                    className="medpro-input bg-white font-medium"
                                >
                                    {medicineUnitOptions.map((unit) => (
                                        <option key={unit} value={unit}>
                                            {unit}
                                        </option>
                                    ))}
                                    {form.dvt && !medicineUnitOptions.includes(form.dvt) && (
                                        <option value={form.dvt}>{form.dvt}</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Đường dùng & Hướng dẫn mặc định</label>
                                <input
                                    type="text"
                                    value={form.duongDung || form.huongDan || ''}
                                    onChange={(e) => setForm({ ...form, duongDung: e.target.value, huongDan: e.target.value })}
                                    placeholder="VD: Uống sau ăn, Bôi ngoài da..."
                                    className="medpro-input"
                                />
                            </div>
                        </div>
                    )}

                    {activeCatalogKey === 'dichVu' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã dịch vụ kỹ thuật *</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maDV || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                                    title="Mã dịch vụ do hệ thống tự sinh, không thể sửa"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Nhóm dịch vụ *</label>
                                <select
                                    value={form.nhomDV || 'Khám bệnh'}
                                    onChange={(e) => setForm({ ...form, nhomDV: e.target.value })}
                                    className="medpro-input bg-white font-medium"
                                >
                                    {SERVICE_GROUPS.map((g) => (
                                        <option key={g.value} value={g.value}>
                                            {g.label}
                                        </option>
                                    ))}
                                    {form.nhomDV && !SERVICE_GROUPS.some((g) => g.value === form.nhomDV) && (
                                        <option value={form.nhomDV}>{form.nhomDV}</option>
                                    )}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên dịch vụ khám / Cận lâm sàng *</label>
                                <input
                                    type="text"
                                    value={form.tenDV || ''}
                                    onChange={(e) => setForm({ ...form, tenDV: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Đơn vị tính (DVT) chuẩn y tế *</label>
                                <select
                                    value={form.dvt || 'Lần'}
                                    onChange={(e) => setForm({ ...form, dvt: e.target.value, donViTinh: e.target.value })}
                                    className="medpro-input bg-white font-medium"
                                >
                                    {serviceUnitOptions.map((unit) => (
                                        <option key={unit} value={unit}>
                                            {unit}
                                        </option>
                                    ))}
                                    {form.dvt && !serviceUnitOptions.includes(form.dvt) && (
                                        <option value={form.dvt}>{form.dvt}</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Đơn giá niêm yết (VNĐ)</label>
                                <input
                                    type="number"
                                    value={form.donGia || 0}
                                    onChange={(e) => setForm({ ...form, donGia: Number(e.target.value) })}
                                    className="medpro-input tabular-nums font-bold text-[#003553]"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Thuế suất VAT (%)</label>
                                <select
                                    value={form.vat_percent !== undefined ? form.vat_percent : 0}
                                    onChange={(e) => setForm({ ...form, vat_percent: Number(e.target.value) })}
                                    className="medpro-input"
                                >
                                    <option value={0}>0% (Dịch vụ KCB miễn thuế GTGT)</option>
                                    <option value={5}>5%</option>
                                    <option value={8}>8%</option>
                                    <option value={10}>10%</option>
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Thời gian thực hiện (Phút)</label>
                                <input
                                    type="number"
                                    value={form.thoi_gian_thuc_hien || 15}
                                    onChange={(e) => setForm({ ...form, thoi_gian_thuc_hien: Number(e.target.value) })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Buồng / Phòng thực hiện kỹ thuật</label>
                                <select
                                    value={form.phongTH || ''}
                                    onChange={(e) => setForm({ ...form, phongTH: e.target.value })}
                                    className="medpro-input bg-white font-medium"
                                >
                                    <option value="">-- Chọn buồng thực hiện kỹ thuật --</option>
                                    {availableRooms.map((rm) => (
                                        <option key={rm.maPhong || rm.id} value={`${rm.maPhong} - ${rm.tenPhong}`}>
                                            {rm.maPhong} - {rm.tenPhong}
                                        </option>
                                    ))}
                                    {form.phongTH && !availableRooms.some((rm) => `${rm.maPhong} - ${rm.tenPhong}` === form.phongTH) && (
                                        <option value={form.phongTH}>{form.phongTH}</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    )}

                    {loaiDanhMuc === 'chung' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="medpro-label">
                                    {activeGeneralSubTab === 'donViTinh'
                                        ? 'Mã đơn vị tính (Mã ĐVT) *'
                                        : activeGeneralSubTab === 'khoanThu'
                                        ? 'Mã khoản thu viện phí *'
                                        : activeGeneralSubTab === 'phuongPhapTruDau'
                                        ? 'Mã phương pháp trừ đau *'
                                        : 'Mã ký hiệu / Mã gõ tắt *'}
                                </label>
                                <input
                                    type="text"
                                    value={form.ma || ''}
                                    onChange={(e) => setForm({ ...form, ma: e.target.value.toUpperCase() })}
                                    placeholder={
                                        activeGeneralSubTab === 'donViTinh'
                                            ? 'VD: VIEN, GOI, TEP, VI...'
                                            : activeGeneralSubTab === 'goTat'
                                            ? 'VD: THA, TNPL, BM...'
                                            : 'VD: MA01...'
                                    }
                                    className="medpro-input font-mono font-bold text-[#00B5F1]"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Thứ tự sắp xếp</label>
                                <input
                                    type="number"
                                    value={form.thuTu || 1}
                                    onChange={(e) => setForm({ ...form, thuTu: Number(e.target.value) })}
                                    className="medpro-input tabular-nums"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="medpro-label">
                                    {activeGeneralSubTab === 'donViTinh'
                                        ? 'Tên đơn vị tính (Đồng bộ sang Thuốc & Dịch vụ) *'
                                        : activeGeneralSubTab === 'khoanThu'
                                        ? 'Tên khoản thu viện phí *'
                                        : activeGeneralSubTab === 'phuongPhapTruDau'
                                        ? 'Tên phương pháp vô cảm / trừ đau *'
                                        : 'Tên / Nội dung diễn giải đầy đủ *'}
                                </label>
                                <input
                                    type="text"
                                    value={form.ten || form.noiDung || ''}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            ten: e.target.value,
                                            noiDung: e.target.value,
                                        })
                                    }
                                    placeholder={
                                        activeGeneralSubTab === 'donViTinh'
                                            ? 'VD: Viên, Vỉ, Tép, Chai, Lọ, Lần, Miếng...'
                                            : ''
                                    }
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            {activeGeneralSubTab === 'donViTinh' && (
                                <div className="sm:col-span-2">
                                    <label className="medpro-label">Phạm vi áp dụng ĐVT *</label>
                                    <select
                                        value={form.loai || form.phamVi || 'THUOC'}
                                        onChange={(e) => setForm({ ...form, loai: e.target.value, phamVi: e.target.value })}
                                        className="medpro-input bg-white font-medium"
                                    >
                                        <option value="THUOC">Thuốc & Dược phẩm kê đơn</option>
                                        <option value="DICH_VU">Dịch vụ kỹ thuật & Khám bệnh</option>
                                        <option value="CHUNG">Dùng chung (Cả Thuốc & Dịch vụ)</option>
                                    </select>
                                </div>
                            )}
                            {activeGeneralSubTab === 'khoanThu' && (
                                <div className="sm:col-span-2">
                                    <label className="medpro-label">Đơn giá mặc định (VNĐ)</label>
                                    <input
                                        type="number"
                                        value={form.donGiaMacDinh || 0}
                                        onChange={(e) => setForm({ ...form, donGiaMacDinh: Number(e.target.value) })}
                                        className="medpro-input tabular-nums font-bold"
                                    />
                                </div>
                            )}
                            <div className="sm:col-span-2">
                                <label className="medpro-label">Mô tả / Ghi chú áp dụng</label>
                                <textarea
                                    rows={3}
                                    value={form.moTa || ''}
                                    onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>
                    )}


                </div>
            </div>
        </div>
    )
}

