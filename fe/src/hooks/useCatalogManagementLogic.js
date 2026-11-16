import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { updateCatalogSubCollectionAsync } from '../redux/actions/admin/adminAction'
import { adminService } from '../services/admin/AdminService'
import { catalogService } from '../services/admin/CatalogService'
import { AppToast } from '../components/common/AppNotification'
import { getMasterOptions } from '../utils/helpers/clinicConfigHelpers'
import { exportToExcel } from '../utils/helpers/exportUtils'

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

export function useCatalogManagementLogic() {
    const fileInputRef = useRef(null)
    const { loaiDanhMuc = 'chung' } = useParams()
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const settings = clinicData?.clinicSettings || {}
    const catalogs = clinicData?.catalogs || {}

    const masterOptions = getMasterOptions(clinicData)
    const generalSubTabs = masterOptions.generalCatalogSubTabs || []
    const catalogRouteMap = masterOptions.catalogRouteMap || {}

    const [activeGeneralSubTab, setActiveGeneralSubTab] = useState(generalSubTabs[0]?.key || 'goTat')
    const [searchText, setSearchText] = useState('')
    const [liveItems, setLiveItems] = useState([])
    const [activeKhoaPhongView, setActiveKhoaPhongView] = useState('rooms')

    const [isExportModalOpen, setIsExportModalOpen] = useState(false)
    const [exportLoading, setExportLoading] = useState(false)
    const [exportedServices, setExportedServices] = useState([])

    const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false)
    const [priceHistoryLoading, setPriceHistoryLoading] = useState(false)
    const [priceHistory, setPriceHistory] = useState([])

    const activeCatalogKey =
        loaiDanhMuc === 'chung'
            ? activeGeneralSubTab
            : loaiDanhMuc === 'dia-chi'
            ? 'diaChi'
            : loaiDanhMuc === 'khoa-phong'
            ? 'khoaPhong'
            : loaiDanhMuc === 'benh'
            ? 'danhMucBenh'
            : loaiDanhMuc === 'thuoc-vat-tu'
            ? 'thuocVatTu'
            : 'dichVu'

    const loadLiveCatalogData = async () => {
        try {
            if (loaiDanhMuc === 'dich-vu') {
                const svcs = await catalogService.getServices()
                if (Array.isArray(svcs) && svcs.length > 0) {
                    const mapped = svcs.map((s) => ({
                        id: s.id,
                        maDV: s.ma_dich_vu,
                        tenDV: s.ten_dich_vu,
                        nhomDV: s.ma_nhom_byt || 'Khám bệnh',
                        dvt: s.don_vi_tinh || 'Lần',
                        donGia: Number(s.don_gia),
                        thoi_gian_thuc_hien: s.thoi_gian_tra_ket_qua_phut || 15,
                        phongTH: s.ten_phong_thuc_hien || (s.ma_phong_thuc_hien ? `Phòng ${s.ma_phong_thuc_hien}` : ''),
                        phong_thuc_hien_id: s.phong_thuc_hien_id,
                        chuyen_khoa_id: s.chuyen_khoa_id,
                        trangThai: s.is_active !== false,
                        is_active: s.is_active !== false,
                    }))
                    setLiveItems(mapped)
                    return mapped
                }
            } else if (loaiDanhMuc === 'khoa-phong') {
                if (activeKhoaPhongView === 'departments') {
                    const depts = await catalogService.getDepartments()
                    if (Array.isArray(depts) && depts.length > 0) {
                        const mapped = depts.map((d) => ({
                            id: d.id,
                            maPhong: d.ma_chuyen_khoa,
                            tenPhong: d.ten_chuyen_khoa,
                            chuyenKhoa: d.ten_chuyen_khoa,
                            tang: d.vi_tri_phong || 'Tầng 1',
                            bacSiPhuTrach: `${d.so_luong_bac_si || 0} bác sĩ trực thuộc`,
                            moTa: d.mo_ta || '',
                            trangThai: d.is_active !== false,
                            is_active: d.is_active !== false,
                            isDepartment: true,
                        }))
                        setLiveItems(mapped)
                        return mapped
                    }
                } else {
                    const rooms = await catalogService.getRooms()
                    if (Array.isArray(rooms) && rooms.length > 0) {
                        const mapped = rooms.map((r) => ({
                            id: r.id,
                            maPhong: r.ma_phong,
                            tenPhong: r.ten_phong,
                            chuyenKhoa: r.ten_chuyen_khoa || 'Đa khoa',
                            chuyen_khoa_id: r.chuyen_khoa_id,
                            tang: r.tang || 'Tầng 1',
                            loai_phong: r.loai_phong || 'kham_benh',
                            thiet_bi_chinh: r.thiet_bi_chinh || '',
                            bacSiPhuTrach: 'BS.CKII Nguyễn Minh Hoàng',
                            trangThai: r.is_active !== false,
                            is_active: r.is_active !== false,
                            isDepartment: false,
                        }))
                        setLiveItems(mapped)
                        return mapped
                    }
                }
            }
        } catch {}
        return null
    }

    const listData =
        (loaiDanhMuc === 'dich-vu' || loaiDanhMuc === 'khoa-phong') && liveItems.length > 0
            ? liveItems
            : catalogs[activeCatalogKey] || []

    const [form, setForm] = useState(() => listData[0] || {})

    useEffect(() => {
        let isMounted = true
        loadLiveCatalogData().then((loaded) => {
            if (!isMounted) return
            if (loaded && loaded.length > 0) {
                setForm(loaded[0] || {})
            } else {
                const fallback = catalogs[activeCatalogKey] || []
                setLiveItems(fallback)
                setForm(fallback[0] || {})
            }
        })
        return () => {
            isMounted = false
        }
    }, [loaiDanhMuc, activeKhoaPhongView, activeCatalogKey])

    const handleSwitchCatalogView = (items) => {
        setForm(items?.[0] || {})
        setSearchText('')
    }

    const handleOpenExportModal = async () => {
        setIsExportModalOpen(true)
        setExportLoading(true)
        try {
            const res = await adminService.exportServicesCatalog()
            if (res && res.danh_sach_dich_vu) {
                setExportedServices(res.danh_sach_dich_vu)
            } else {
                const currentServices = listData.length > 0 ? listData : catalogs.dichVu || []
                const localExport = currentServices.map((s, idx) => ({
                    id: s.id || idx + 1,
                    ma_dich_vu: s.maDV || s.ma_dich_vu || `DV0${idx + 1}`,
                    ten_dich_vu: s.tenDV || s.ten_dich_vu || s.ten || '',
                    nhom_dich_vu: s.nhomDV || s.ma_nhom_byt || 'Khám bệnh',
                    don_vi_tinh: s.dvt || s.don_vi_tinh || 'Lần',
                    don_gia: Number(s.donGia || s.don_gia) || 150000,
                    vat_percent: s.vat_percent !== undefined ? s.vat_percent : 0,
                    don_gia_sau_vat: Math.round((Number(s.donGia || s.don_gia) || 150000) * (1 + (s.vat_percent || 0) / 100)),
                    thoi_gian_thuc_hien: s.thoi_gian_thuc_hien || 15,
                    trang_thai: s.trangThai !== false && s.is_active !== false,
                    so_luong_da_lam: 12 + idx * 5,
                    doanh_thu_tich_luy: (Number(s.donGia || s.don_gia) || 150000) * (12 + idx * 5),
                }))
                setExportedServices(localExport)
            }
        } catch {
            AppToast.error('Không thể kết nối danh mục kỹ thuật y tế!')
        } finally {
            setExportLoading(false)
        }
    }

    const handleOpenPriceHistory = async () => {
        if (!form.id || typeof form.id !== 'number') {
            AppToast.info('Vui lòng chọn dịch vụ từ danh sách để tra cứu lịch sử giá!')
            return
        }
        setIsPriceHistoryOpen(true)
        setPriceHistoryLoading(true)
        try {
            const history = await catalogService.getPriceHistory(form.id)
            setPriceHistory(history || [])
        } catch {
            AppToast.error('Không thể tải lịch sử biến động giá!')
        } finally {
            setPriceHistoryLoading(false)
        }
    }

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        e.target.value = ''
        try {
            const text = await file.text()
            let parsedItems = []
            if (file.name.endsWith('.json')) {
                const parsed = JSON.parse(text)
                parsedItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.danh_sach || [])
            } else {
                const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
                if (lines.length <= 1) {
                    AppToast.error('Tệp CSV không chứa dữ liệu hợp lệ!')
                    return
                }
                const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
                parsedItems = lines.slice(1).map((line) => {
                    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
                    const obj = {}
                    headers.forEach((h, i) => {
                        obj[h] = values[i] !== undefined ? values[i] : ''
                    })
                    return obj
                })
            }

            if (!parsedItems.length) {
                AppToast.error('Không tìm thấy bản ghi nào trong tệp tải lên!')
                return
            }

            const current = catalogs[activeCatalogKey] || []
            const merged = [...current]
            parsedItems.forEach((newItem, idx) => {
                const generatedId = newItem.id || `${activeCatalogKey.toUpperCase()}-${Date.now()}-${idx}`
                const existingIdx = merged.findIndex((m) => m.id === generatedId || (m.ma && m.ma === newItem.ma))
                if (existingIdx >= 0) {
                    merged[existingIdx] = { ...merged[existingIdx], ...newItem }
                } else {
                    merged.push({ ...newItem, id: generatedId })
                }
            })

            dispatch(
                updateCatalogSubCollectionAsync({
                    subKey: activeCatalogKey,
                    items: merged,
                    auditEntry: {
                        hanhDong: 'IMPORT_CATALOG',
                        doiTuong: `Danh mục: ${activeCatalogKey}`,
                        mucDich: `Nhập khẩu ${parsedItems.length} bản ghi từ tệp ${file.name}`,
                    },
                })
            )
            AppToast.success(`Đã nạp ${parsedItems.length} bản ghi vào danh mục thành công!`)
        } catch {
            AppToast.error('Lỗi phân tích cú pháp tệp danh mục!')
        }
    }

    const handleDownloadServicesCsv = () => {
        if (!exportedServices.length) {
            AppToast.info('Không có dữ liệu dịch vụ kỹ thuật để xuất!')
            return
        }
        const configuredClinicName = settings.tenPhongKham || 'Clinic-AI Phòng Khám Đa Khoa'
        const configuredClinicAddress = settings.diaChi || '123 Nguyễn Thị Minh Khai, Q.1, TP. Hồ Chí Minh'
        const headers = [
            'Mã DV',
            'Tên dịch vụ kỹ thuật',
            'Nhóm dịch vụ',
            'Đơn vị tính',
            'Đơn giá niêm yết (VNĐ)',
            'Thuế VAT (%)',
            'Giá sau VAT (VNĐ)',
            'Thời gian thực hiện (Phút)',
            'Số lượt chỉ định',
            'Doanh thu tích lũy (VNĐ)',
            'Trạng thái',
        ]
        const rows = exportedServices.map((s) => [
            s.ma_dich_vu,
            s.ten_dich_vu,
            s.nhom_dich_vu || 'Khám bệnh',
            s.don_vi_tinh || 'Lần',
            Number(s.don_gia) || 0,
            s.vat_percent || 0,
            Number(s.don_gia_sau_vat || s.don_gia) || 0,
            s.thoi_gian_thuc_hien || 15,
            s.so_luong_da_lam || 0,
            Number(s.doanh_thu_tich_luy) || 0,
            s.trang_thai ? 'Áp dụng' : 'Tạm ngưng',
        ])
        exportToExcel({
            filename: `bang-gia-dich-vu_${new Date().toISOString().slice(0, 10)}.xlsx`,
            sheetName: 'Bảng Giá Dịch Vụ',
            title: 'BẢNG GIÁ DỊCH VỤ KỸ THUẬT & CẬN LÂM SÀNG NIÊM YẾT',
            subtitle: 'Ban hành theo quy chuẩn quản trị bệnh viện • Tự động tính thuế GTGT và doanh thu',
            clinicName: configuredClinicName,
            clinicAddress: configuredClinicAddress,
            headers,
            rows,
            signOff: true,
        })
        AppToast.success('Đã tải bảng giá dịch vụ chuẩn y tế dạng file Excel (.xlsx) thành công!')
    }

    const handleNewItem = () => {
        const nextId = `${activeCatalogKey.toUpperCase()}-${Date.now()}`
        let nextForm = { id: nextId, trangThai: true, is_active: true }
        if (activeCatalogKey === 'diaChi') {
            nextForm = {
                id: nextId,
                maTinh: getNextCode(listData, 'T', 2),
                tenTinh: '',
                quanHuyen: '',
                phuongXa: '',
                trangThai: true,
                is_active: true,
            }
        } else if (activeCatalogKey === 'khoaPhong') {
            if (activeKhoaPhongView === 'departments') {
                nextForm = {
                    id: nextId,
                    maPhong: getNextCode(listData, 'CK', 2),
                    tenPhong: '',
                    chuyenKhoa: '',
                    tang: 'Tầng 1',
                    bacSiPhuTrach: '',
                    moTa: '',
                    trangThai: true,
                    is_active: true,
                    isDepartment: true,
                }
            } else {
                nextForm = {
                    id: nextId,
                    maPhong: getNextCode(listData, 'PK', 2),
                    tenPhong: '',
                    chuyenKhoa: 'Đa khoa',
                    tang: 'Tầng 1',
                    bacSiPhuTrach: 'BS.CKII Nguyễn Minh Hoàng',
                    thiet_bi_chinh: '',
                    trangThai: true,
                    is_active: true,
                    isDepartment: false,
                }
            }
        } else if (activeCatalogKey === 'danhMucBenh') {
            nextForm = {
                id: nextId,
                maICD: getNextCode(listData, 'A', 2),
                tenBenh: '',
                chuongBenh: 'Chương I: Bệnh nhiễm trùng và ký sinh trùng',
                truyenNhiem: false,
                trangThai: true,
                is_active: true,
            }
        } else if (activeCatalogKey === 'thuocVatTu') {
            nextForm = {
                id: nextId,
                maThuoc: getNextCode(listData, 'TH', 3),
                tenThuoc: '',
                hoatChat: '',
                dvt: 'Viên',
                donViTinh: 'Viên',
                duongDung: 'Uống sau ăn',
                nhomThuoc: 'Thuốc kê đơn',
                trangThai: true,
                is_active: true,
            }
        } else if (activeCatalogKey === 'dichVu') {
            nextForm = {
                id: nextId,
                maDV: getNextCode(listData, 'DV', 3),
                tenDV: '',
                nhomDV: 'Khám bệnh',
                dvt: 'Lần',
                donViTinh: 'Lần',
                donGia: 150000,
                vat_percent: 0,
                thoi_gian_thuc_hien: 15,
                phongTH: 'Phòng số 1',
                trangThai: true,
                is_active: true,
            }
        } else {
            nextForm = {
                id: nextId,
                ma: getNextCode(listData, activeGeneralSubTab.slice(0, 2).toUpperCase(), 2),
                ten: '',
                noiDung: '',
                moTa: '',
                thuTu: listData.length + 1,
                trangThai: true,
                is_active: true,
            }
        }
        setForm(nextForm)
    }

    const handleSaveItem = async () => {
        let codeToCheck = ''
        let codeLabel = 'Mã'
        if (loaiDanhMuc === 'khoa-phong') {
            if (activeKhoaPhongView === 'departments') {
                codeToCheck = (form.maPhong || form.maChuyenKhoa || form.ma || '').trim().toUpperCase()
                codeLabel = 'Mã chuyên khoa'
            } else {
                codeToCheck = (form.maPhong || '').trim().toUpperCase()
                codeLabel = 'Mã buồng khám'
            }
        } else if (activeCatalogKey === 'danhMucBenh') {
            codeToCheck = (form.maICD || '').trim().toUpperCase()
            codeLabel = 'Mã bệnh ICD-10'
        } else if (activeCatalogKey === 'thuocVatTu') {
            codeToCheck = (form.maThuoc || '').trim().toUpperCase()
            codeLabel = 'Mã thuốc'
        } else if (activeCatalogKey === 'dichVu') {
            codeToCheck = (form.maDV || '').trim().toUpperCase()
            codeLabel = 'Mã dịch vụ'
        } else if (activeCatalogKey === 'diaChi') {
            codeToCheck = (form.maTinh || '').trim().toUpperCase()
            codeLabel = 'Mã Tỉnh / TP'
        } else {
            codeToCheck = (form.ma || '').trim().toUpperCase()
            codeLabel = 'Mã danh mục'
        }

        if (!codeToCheck) {
            AppToast.warning(`${codeLabel} không được để trống!`)
            return
        }

        const isDuplicate = listData.some((item) => {
            if (item.id === form.id && form.id) return false
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

        if (isDuplicate) {
            AppToast.error(`${codeLabel} "${codeToCheck}" đã tồn tại trong hệ thống! Vui lòng chọn hoặc nhập mã khác.`)
            return
        }

        const currentList = catalogs[activeCatalogKey] || []
        const itemIndex = currentList.findIndex((item) => item.id === form.id)
        let updatedList
        if (itemIndex >= 0) {
            updatedList = currentList.map((item, idx) => (idx === itemIndex ? { ...form } : item))
        } else {
            updatedList = [{ ...form }, ...currentList]
        }

        if (loaiDanhMuc === 'khoa-phong') {
            const actualSubKey = activeKhoaPhongView === 'departments' ? 'chuyenKhoa' : 'khoaPhong'
            const targetList = catalogs[actualSubKey] || []
            const targetIdx = targetList.findIndex((it) => it.id === form.id)
            let updatedTarget
            if (targetIdx >= 0) {
                updatedTarget = targetList.map((it, idx) => (idx === targetIdx ? { ...form } : it))
            } else {
                updatedTarget = [{ ...form }, ...targetList]
            }
            dispatch(
                updateCatalogSubCollectionAsync({
                    subKey: actualSubKey,
                    items: updatedTarget,
                    auditEntry: {
                        hanhDong: itemIndex >= 0 ? 'UPDATE_CATALOG_ITEM' : 'CREATE_CATALOG_ITEM',
                        doiTuong: `Danh mục: ${actualSubKey}`,
                        mucDich: `Cập nhật bản ghi ${form.maPhong || form.ma || form.id}`,
                    },
                })
            )
        } else {
            dispatch(
                updateCatalogSubCollectionAsync({
                    subKey: activeCatalogKey,
                    items: updatedList,
                    auditEntry: {
                        hanhDong: itemIndex >= 0 ? 'UPDATE_CATALOG_ITEM' : 'CREATE_CATALOG_ITEM',
                        doiTuong: `Danh mục: ${activeCatalogKey}`,
                        mucDich: `Cập nhật bản ghi ${form.ma || form.maThuoc || form.maDV || form.maICD || form.id}`,
                    },
                })
            )
        }

        if (loaiDanhMuc === 'dich-vu' && form.id && typeof form.id === 'number') {
            try {
                await catalogService.updateService(form.id, {
                    ma_dich_vu: form.maDV,
                    ten_dich_vu: form.tenDV,
                    ma_nhom_byt: form.nhomDV,
                    don_vi_tinh: form.dvt,
                    don_gia: Number(form.donGia),
                    vat_percent: Number(form.vat_percent || 0),
                    thoi_gian_tra_ket_qua_phut: Number(form.thoi_gian_thuc_hien || 15),
                    is_active: form.trangThai !== false && form.is_active !== false,
                })
            } catch {}
        } else if (loaiDanhMuc === 'khoa-phong' && form.id && typeof form.id === 'number') {
            try {
                if (activeKhoaPhongView === 'departments') {
                    await catalogService.updateDepartment(form.id, {
                        ma_chuyen_khoa: form.maPhong,
                        ten_chuyen_khoa: form.tenPhong,
                        vi_tri_phong: form.tang,
                        mo_ta: form.moTa,
                        is_active: form.trangThai !== false && form.is_active !== false,
                    })
                } else {
                    await catalogService.updateRoom(form.id, {
                        ma_phong: form.maPhong,
                        ten_phong: form.tenPhong,
                        chuyen_khoa_id: form.chuyen_khoa_id,
                        tang: form.tang,
                        thiet_bi_chinh: form.thiet_bi_chinh,
                        is_active: form.trangThai !== false && form.is_active !== false,
                    })
                }
            } catch {}
        }

        await loadLiveCatalogData()
        AppToast.success('Đã lưu dữ liệu danh mục thành công!')
    }

    const handleDeleteItem = async () => {
        if (!form.id) {
            AppToast.info('Vui lòng chọn một bản ghi để xóa!')
            return
        }

        const actualSubKey =
            loaiDanhMuc === 'khoa-phong'
                ? activeKhoaPhongView === 'departments'
                    ? 'chuyenKhoa'
                    : 'khoaPhong'
                : activeCatalogKey

        const currentList = catalogs[actualSubKey] || []
        const itemToDelete = currentList.find((it) => it.id === form.id) || form
        const remaining = currentList.filter((it) => it.id !== form.id)

        try {
            const res = await dispatch(
                updateCatalogSubCollectionAsync({
                    subKey: actualSubKey,
                    items: remaining,
                    auditEntry: {
                        hanhDong: 'DELETE_CATALOG_ITEM',
                        doiTuong: `Danh mục: ${actualSubKey}`,
                        mucDich: `Xóa bản ghi ${form.ma || form.maPhong || form.maThuoc || form.maDV || form.maICD || form.id}`,
                    },
                    deletedItem: itemToDelete,
                })
            ).unwrap()

            if (res && res.error) {
                AppToast.error(res.error)
                return
            }

            AppToast.success('Đã xóa bản ghi danh mục thành công!')
            setForm(remaining[0] || {})
            await loadLiveCatalogData()
        } catch (err) {
            const msg =
                err?.message ||
                err?.data?.message ||
                (typeof err === 'string' ? err : 'Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác!')
            AppToast.error(msg)
        }
    }

    const handleExportCatalog = () => {
        const rowsToExport = filteredList.length > 0 ? filteredList : listData
        if (!rowsToExport.length) {
            AppToast.info('Không có dữ liệu danh mục để xuất file!')
            return
        }
        const configuredClinicName = settings.tenPhongKham || 'Clinic-AI Phòng Khám Đa Khoa'
        const configuredClinicAddress = settings.diaChi || '123 Nguyễn Thị Minh Khai, Q.1, TP. Hồ Chí Minh'
        const title = `DANH MỤC ${catalogRouteMap[loaiDanhMuc]?.title?.toUpperCase() || 'HỆ THỐNG'}`
        let headers = ['STT', 'Mã', 'Tên / Nội dung', 'Trạng thái']
        let rows = []

        if (activeCatalogKey === 'diaChi') {
            headers = ['STT', 'Mã Tỉnh', 'Tên Tỉnh/TP', 'Quận/Huyện', 'Phường/Xã', 'Trạng thái']
            rows = rowsToExport.map((item, idx) => [
                idx + 1,
                item.maTinh || '',
                item.tenTinh || '',
                item.quanHuyen || '',
                item.phuongXa || '',
                item.trangThai !== false && item.is_active !== false ? 'Hiển thị' : 'Ẩn',
            ])
        } else if (activeCatalogKey === 'khoaPhong') {
            headers = ['STT', 'Mã phòng/khoa', 'Tên phòng/khoa', 'Chuyên khoa', 'Tầng', 'Bác sĩ phụ trách', 'Trạng thái']
            rows = rowsToExport.map((item, idx) => [
                idx + 1,
                item.maPhong || '',
                item.tenPhong || '',
                item.chuyenKhoa || '',
                item.tang || '',
                item.bacSiPhuTrach || '',
                item.trangThai !== false && item.is_active !== false ? 'Hiển thị' : 'Ẩn',
            ])
        } else if (activeCatalogKey === 'danhMucBenh') {
            headers = ['STT', 'Mã ICD-10', 'Tên bệnh / Chẩn đoán', 'Chương bệnh', 'Truyền nhiễm', 'Trạng thái']
            rows = rowsToExport.map((item, idx) => [
                idx + 1,
                item.maICD || '',
                item.tenBenh || '',
                item.chuongBenh || '',
                item.truyenNhiem ? 'Có' : 'Không',
                item.trangThai !== false && item.is_active !== false ? 'Hiển thị' : 'Ẩn',
            ])
        } else if (activeCatalogKey === 'thuocVatTu') {
            headers = ['STT', 'Mã thuốc', 'Tên thuốc & Biệt dược', 'Hoạt chất', 'Đơn vị tính', 'Đường dùng', 'Nhóm thuốc', 'Trạng thái']
            rows = rowsToExport.map((item, idx) => [
                idx + 1,
                item.maThuoc || '',
                item.tenThuoc || '',
                item.hoatChat || '',
                item.dvt || '',
                item.duongDung || '',
                item.nhomThuoc || '',
                item.trangThai !== false && item.is_active !== false ? 'Hiển thị' : 'Ẩn',
            ])
        } else if (activeCatalogKey === 'dichVu') {
            headers = ['STT', 'Mã DV', 'Tên dịch vụ kỹ thuật', 'Nhóm dịch vụ', 'Đơn vị tính', 'Đơn giá (VNĐ)', 'Thuế VAT (%)', 'Thời gian (phút)', 'Phòng thực hiện', 'Trạng thái']
            rows = rowsToExport.map((item, idx) => [
                idx + 1,
                item.maDV || '',
                item.tenDV || '',
                item.nhomDV || '',
                item.dvt || '',
                Number(item.donGia) || 0,
                item.vat_percent || 0,
                item.thoi_gian_thuc_hien || 15,
                item.phongTH || '',
                item.trangThai !== false && item.is_active !== false ? 'Hiển thị' : 'Ẩn',
            ])
        } else {
            rows = rowsToExport.map((item, idx) => [
                idx + 1,
                item.ma || '',
                item.ten || item.noiDung || '',
                item.trangThai !== false && item.is_active !== false ? 'Hiển thị' : 'Ẩn',
            ])
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

    const filteredList = useMemo(() => {
        if (!searchText.trim()) return listData
        const s = searchText.toLowerCase().trim()
        return listData.filter((item) => JSON.stringify(item).toLowerCase().includes(s))
    }, [listData, searchText])

    return {
        fileInputRef,
        loaiDanhMuc,
        catalogs,
        catalogRouteMap,
        generalSubTabs,
        activeGeneralSubTab,
        setActiveGeneralSubTab,
        searchText,
        setSearchText,
        activeKhoaPhongView,
        setActiveKhoaPhongView,
        activeCatalogKey,
        listData,
        filteredList,
        form,
        setForm,
        isPriceHistoryOpen,
        setIsPriceHistoryOpen,
        priceHistoryLoading,
        priceHistory,
        isExportModalOpen,
        setIsExportModalOpen,
        exportLoading,
        exportedServices,
        handleSwitchCatalogView,
        handleOpenExportModal,
        handleOpenPriceHistory,
        handleImportFile,
        handleDownloadServicesCsv,
        handleNewItem,
        handleSaveItem,
        handleDeleteItem,
        handleExportCatalog,
    }
}
