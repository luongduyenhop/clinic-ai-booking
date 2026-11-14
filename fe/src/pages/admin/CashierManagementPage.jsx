import { printDocument } from '../../utils/helpers/exportUtils'
import { useState, useMemo, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import { AppToast } from '../../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../../utils/helpers/clinicConfigHelpers'
import VietQrModal from '../../components/common/VietQrModal'
import ReceiptModal from '../../components/common/ReceiptModal'
import { QrCode } from '@phosphor-icons/react'
import { cashierService } from '../../services/cashierService'
import {
    StatusBadge,
    EmptyState,
    Receipt,
    Plus,
    FloppyDisk,
    Printer,
    Trash,
    MagnifyingGlass,
    Funnel,
    CaretDown,
    CaretRight,
    User,
} from '../../components/common/ClinicIcon'
import {
    areVouchersMatching,
    mergeVoucherData,
    deduplicateVouchers,
    groupVouchersByPatient,
} from '../../utils/helpers/cashierInvoiceHelpers'

const getNextVoucherCode = (list) => {
    let max = 0
    ;(list || []).forEach((v) => {
        const m = String(v.maPhieu || v.id || '').match(/(\d+)/)
        if (m) {
            const num = parseInt(m[1], 10)
            if (num > max) max = num
        }
    })
    return 'PT' + String(max + 1).padStart(8, '0')
}

export default function CashierManagementPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)

    const vouchers = useMemo(() => {
        let list = [...(clinicData?.vouchers || [])]
        try {
            const raw = localStorage.getItem('CLINIC_AI_MANAGEMENT_DB_V3_CLINICAL')
            if (raw) {
                const parsed = JSON.parse(raw)
                const storedVouchers = parsed?.vouchers || []
                list = [...list, ...storedVouchers]
                if (Array.isArray(parsed?.vouchers)) {
                    parsed.vouchers = deduplicateVouchers(parsed.vouchers)
                    localStorage.setItem('CLINIC_AI_MANAGEMENT_DB_V3_CLINICAL', JSON.stringify(parsed))
                }
            }
        } catch {}
        return deduplicateVouchers(list.filter((v) => v.loaiPhieu !== 'Phiếu chi'))
    }, [clinicData])

    const patients = clinicData?.patients || []
    const registrations = clinicData?.registrations || []
    const khoanThuCatalog = clinicData?.catalogs?.khoanThu || []

    const pendingBillRegistrations = useMemo(() => {
        return (registrations || []).filter((r) => {
            const hasServices = Array.isArray(r.services) && r.services.length > 0
            const isPaid = vouchers.some(
                (v) => (v.maKCB === r.maKCB || (v.maBN === r.maBN && v.items?.length > 0)) && v.daThu
            )
            return hasServices && !isPaid
        })
    }, [registrations, vouchers])

    const masterOptions = getMasterOptions(clinicData)
    const defaults = getFormDefaults(clinicData)
    const paymentMethods = [
        { value: 'Tiền mặt', label: 'Tiền mặt' },
        { value: 'Chuyển khoản', label: 'Chuyển khoản QR (SePay / VietQR)' },
        { value: 'Thẻ POS', label: 'Thẻ POS' },
    ]

    const buildEmptyVoucher = () => ({
        id: '',
        maPhieu: getNextVoucherCode(vouchers),
        loaiPhieu: 'Phiếu thu',
        tenPhieu: '',
        maBN: '',
        hoTenBN: '',
        ngayThu: new Date().toISOString().replace('T', ' ').slice(0, 16),
        nguoiThu: defaults.defaultCashier || 'Trần Thu Ngân',
        hinhThuc: paymentMethods[0]?.value || 'Tiền mặt',
        daThu: true,
        ghiChu: '',
        items: [],
        tongTien: 0,
    })

    const queryTab = new URLSearchParams(location.search).get('tab')

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [isQrModalOpen, setIsQrModalOpen] = useState(false)
    const [qrInvoice, setQrInvoice] = useState(null)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [liveUnbilled, setLiveUnbilled] = useState([])
    const [livePendingBills, setLivePendingBills] = useState([])

    const fetchLiveCashierData = async () => {
        try {
            const unbilledRes = await cashierService.getUnbilledEncounters()
            if (unbilledRes?.items) {
                setLiveUnbilled(unbilledRes.items)
            }
            const pendingRes = await cashierService.getPendingBills()
            if (pendingRes?.items) {
                setLivePendingBills(pendingRes.items)
            }
        } catch {
        }
    }

    useEffect(() => {
        fetchLiveCashierData()
    }, [])

    const handleSelectUnbilledEncounter = async (enc) => {
        try {
            const preview = await cashierService.getInvoicePreview(enc.luot_kham_id)
            if (preview) {
                const lines = preview.cac_khoan_thu || preview.items || []
                const autoItems = lines.map((line, idx) => ({
                    id: `PREV-${idx}`,
                    muc_tham_chieu_id: line.muc_tham_chieu_id,
                    loai_muc: line.loai_muc,
                    tenKhoan: line.ten_khoan_thu,
                    soTien: Number(line.thanh_tien),
                    ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng'
                }))
                setForm({
                    ...form,
                    id: null,
                    invoiceId: null,
                    luotKhamId: enc.luot_kham_id,
                    maPhieu: 'DỰ KIẾN LẬP HÓA ĐƠN',
                    maKCB: preview.ma_kcb || enc.ma_kcb,
                    maBN: preview.benh_nhan?.mabn || enc.benh_nhan?.mabn || '',
                    hoTenBN: preview.benh_nhan?.ho_ten || enc.benh_nhan?.ho_ten || '',
                    tenPhieu: `Thu viện phí BN ${preview.benh_nhan?.ho_ten || enc.benh_nhan?.ho_ten || ''} (Mã KCB: ${preview.ma_kcb || enc.ma_kcb})`,
                    items: autoItems,
                    tongTien: Number(preview.thuc_thu_du_kien ?? preview.tong_tien ?? preview.tong_tam_tinh ?? 0),
                    daThu: false,
                    hinhThuc: 'Tiền mặt'
                })
                if (preview.canh_bao_gia) {
                    AppToast.warning(preview.canh_bao_gia)
                } else {
                    AppToast.info(`Xem trước chi phí ca khám ${enc.ma_kcb}. Bấm "Lưu phiếu" để lập hóa đơn!`)
                }
                return
            }
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Không thể xem trước hóa đơn')
        }
        handleSelectPatientAutoFill(enc.benh_nhan?.mabn, enc.ma_kcb)
    }

    const handleOpenQr = async (voucher) => {
        const target = voucher || form
        if (!target.invoiceId && target.luotKhamId) {
            try {
                const congKhamItem = (target.items || []).some((it) => it.loai_muc === 'cong_kham')
                const clsItemIds = (target.items || [])
                    .filter((it) => it.loai_muc === 'can_lam_sang' && it.muc_tham_chieu_id)
                    .map((it) => it.muc_tham_chieu_id)
                const created = await cashierService.createInvoice({
                    luot_kham_id: target.luotKhamId,
                    mien_giam: 0,
                    include_cong_kham: congKhamItem,
                    chi_dinh_ids: clsItemIds
                })
                const actualAmount = Number(created.thuc_thu ?? created.tong_tien ?? target.tongTien ?? 0)
                const updatedTarget = {
                    ...target,
                    id: created.id,
                    invoiceId: created.id,
                    maPhieu: created.ma_hoa_don,
                    tongTien: actualAmount,
                    thuc_thu: actualAmount
                }
                setForm(updatedTarget)
                setQrInvoice(updatedTarget)
                setIsQrModalOpen(true)
                fetchLiveCashierData()
                return
            } catch (err) {
                const existingBill = livePendingBills.find((pb) => pb.luot_kham_id === target.luotKhamId)
                if (existingBill) {
                    const fallbackTarget = {
                        ...target,
                        id: existingBill.id,
                        invoiceId: existingBill.id,
                        maPhieu: existingBill.ma_hoa_don,
                        tongTien: Number(existingBill.thuc_thu ?? existingBill.tong_tien ?? target.tongTien ?? 0)
                    }
                    setForm(fallbackTarget)
                    setQrInvoice(fallbackTarget)
                    setIsQrModalOpen(true)
                    return
                }
                if (!err?.response) {
                    AppToast.error(err?.message || 'Không thể lập hóa đơn để tạo mã VietQR')
                }
                return
            }
        }
        setQrInvoice(target)
        setIsQrModalOpen(true)
    }

    const [activeCashierTab, setActiveCashierTab] = useState(
        queryTab && ['THU_CHI', 'KHOA_SO'].includes(queryTab) ? queryTab : 'THU_CHI'
    )

    useEffect(() => {
        if (queryTab && ['THU_CHI', 'KHOA_SO'].includes(queryTab)) {
            setActiveCashierTab(queryTab)
        }
    }, [queryTab])

    const cashierClosings = clinicData?.cashierClosings || []

    const handleDailyClosing = async () => {
        const now = new Date()
        const totalThu = vouchers
            .filter((v) => v.daThu)
            .reduce((s, v) => s + (Number(v.tongTien) || 0), 0)

        const newClosing = {
            id: 'KS-' + Date.now(),
            maKyKhoaSo:
                'KS-' +
                now.getFullYear() +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') +
                '-' +
                String(cashierClosings.length + 1).padStart(2, '0'),
            ngayKhoaSo: now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN'),
            nguoiKhoaSo: defaults.defaultCashier || 'Trần Thu Ngân',
            tongThuDichVu: totalThu,
            tongChi: 0,
            tonQuyCuoiNgay: totalThu,
            cheDo: 'Chốt ca trực tiếp',
            trangThai: 'Đã khóa sổ (Hợp lệ)',
        }
        const updated = [newClosing, ...cashierClosings]
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'cashierClosings',
                items: updated,
                auditEntry: {
                    hanhDong: 'DAILY_CLOSING',
                    doiTuong: newClosing.maKyKhoaSo + ' - Doanh thu: ' + totalThu.toLocaleString('vi-VN') + ' đ',
                    mucDich: 'Khóa sổ ca thu ngân viện phí',
                },
            })
        )
        AppToast.success(
            'Đã khóa sổ ca thành công! Tổng doanh thu thu được: ' + totalThu.toLocaleString('vi-VN') + ' đ'
        )
    }

    const [form, setForm] = useState(() => vouchers[0] || buildEmptyVoucher())
    const [newItemName, setNewItemName] = useState(khoanThuCatalog[0]?.ten || 'Thu tiền công khám lâm sàng')
    const [newItemAmount, setNewItemAmount] = useState(khoanThuCatalog[0]?.donGiaMacDinh || 120000)
    const [newItemNote, setNewItemNote] = useState('')

    const allVouchers = useMemo(() => {
        const liveItems = (livePendingBills || []).map((pb) => ({
            id: pb.id,
            invoiceId: pb.id,
            luotKhamId: pb.luot_kham_id,
            maPhieu: pb.ma_hoa_don,
            maKCB: `KCB-${pb.luot_kham_id}`,
            maBN: pb.benh_nhan?.mabn || '',
            hoTenBN: pb.benh_nhan?.ho_ten || 'Chưa rõ',
            soDienThoai: pb.benh_nhan?.so_dien_thoai || '',
            tongTien: Number(pb.thuc_thu || pb.tong_tien || 0),
            daThu: false,
            ngayThu: pb.thoi_gian_tao ? new Date(pb.thoi_gian_tao).toLocaleString('vi-VN') : '',
            hinhThuc: 'Tiền mặt',
            tenPhieu: `Viện phí ca khám #${pb.luot_kham_id}`,
            items: (pb.cac_khoan_thu || []).map((line) => ({
                id: `LINE-${line.id}`,
                muc_tham_chieu_id: line.muc_tham_chieu_id,
                loai_muc: line.loai_muc,
                tenKhoan: line.ten_khoan_thu,
                soTien: Number(line.thanh_tien),
                ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng',
            })),
            daKhoaSo: false
        }))
        return deduplicateVouchers([...liveItems, ...vouchers])
    }, [vouchers, livePendingBills])

    const filteredVouchers = useMemo(() => {
        return allVouchers.filter((v) => {
            const matchText =
                !searchText ||
                v.maPhieu?.toLowerCase().includes(searchText.toLowerCase()) ||
                v.hoTenBN?.toLowerCase().includes(searchText.toLowerCase()) ||
                v.tenPhieu?.toLowerCase().includes(searchText.toLowerCase())
            const matchStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'PAID' && v.daThu) ||
                (statusFilter === 'PENDING' && !v.daThu)
            return matchText && matchStatus
        })
    }, [allVouchers, searchText, statusFilter])

    const [invoiceViewMode, setInvoiceViewMode] = useState('BY_PATIENT')

    const groupedPatients = useMemo(() => {
        return groupVouchersByPatient(filteredVouchers)
    }, [filteredVouchers])

    const [expandedPatients, setExpandedPatients] = useState(() => {
        const initial = new Set()
        if (form?.maBN || form?.hoTenBN) {
            const key = (form.maBN ? form.maBN.trim() : '') || (form.hoTenBN ? form.hoTenBN.trim().toLowerCase() : '')
            if (key) initial.add(key)
        }
        return initial
    })

    useEffect(() => {
        if (!form?.maBN && !form?.hoTenBN) return
        const key = (form.maBN ? form.maBN.trim() : '') || (form.hoTenBN ? form.hoTenBN.trim().toLowerCase() : '')
        if (key) {
            setExpandedPatients((prev) => new Set([...prev, key]))
        }
    }, [form?.id, form?.maBN, form?.hoTenBN])

    useEffect(() => {
        if (searchText.trim()) {
            setExpandedPatients(new Set(groupedPatients.map((g) => g.key)))
        }
    }, [searchText, groupedPatients])

    const togglePatient = (key) => {
        setExpandedPatients((prev) => {
            const next = new Set(prev)
            if (next.has(key)) {
                next.delete(key)
            } else {
                next.add(key)
            }
            return next
        })
    }

    const isAllExpanded = groupedPatients.length > 0 && groupedPatients.every((g) => expandedPatients.has(g.key))

    const toggleExpandAll = () => {
        if (isAllExpanded) {
            setExpandedPatients(new Set())
        } else {
            setExpandedPatients(new Set(groupedPatients.map((g) => g.key)))
        }
    }

    const handleSelectVoucher = async (v) => {
        setForm({ ...v })
        if (v.invoiceId && (!v.items || v.items.length === 0)) {
            try {
                const detail = await cashierService.getInvoiceDetail(v.invoiceId)
                if (detail?.chi_tiet_hoa_don) {
                    const lines = detail.chi_tiet_hoa_don.map((line) => ({
                        id: `LINE-${line.id}`,
                        tenKhoan: line.ten_khoan_thu,
                        soTien: Number(line.thanh_tien),
                        ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng'
                    }))
                    setForm((prev) => ({ ...prev, items: lines }))
                }
            } catch {}
        }
    }

    const handleSelectPatientCombined = async (group) => {
        let combinedItems = []
        let total = 0
        const unpaidVouchers = group.vouchers.filter((v) => !v.daThu)
        const targetList = unpaidVouchers.length > 0 ? unpaidVouchers : group.vouchers

        for (const v of targetList) {
            let lines = v.items || []
            if (v.invoiceId && (!lines || lines.length === 0)) {
                try {
                    const detail = await cashierService.getInvoiceDetail(v.invoiceId)
                    if (detail?.chi_tiet_hoa_don) {
                        lines = detail.chi_tiet_hoa_don.map((line) => ({
                            id: `LINE-${line.id}`,
                            tenKhoan: line.ten_khoan_thu,
                            soTien: Number(line.thanh_tien),
                            ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng'
                        }))
                    }
                } catch {}
            }
            if (lines.length > 0) {
                combinedItems = [...combinedItems, ...lines]
            } else {
                combinedItems.push({
                    id: `LINE-${v.id || v.maPhieu}`,
                    tenKhoan: v.tenPhieu || 'Khoản thu dịch vụ',
                    soTien: Number(v.tongTien || 0),
                    ghiChu: 'Viện phí'
                })
            }
            total += Number(v.tongTien || 0)
        }

        const combinedVoucher = {
            id: `GOP-${group.key}`,
            isCombined: true,
            combinedVoucherIds: targetList.map((v) => v.id),
            combinedInvoiceIds: targetList.map((v) => v.invoiceId || v.id).filter(Boolean),
            maPhieu: targetList.length === 1 ? targetList[0].maPhieu : `GOP-${group.maBN || 'BN'}-${targetList.length}HD`,
            maBN: group.maBN,
            hoTenBN: group.hoTenBN,
            soDienThoai: group.soDienThoai,
            tenPhieu: `Thu gộp toàn bộ dịch vụ BN ${group.hoTenBN} (${targetList.length} phiếu)`,
            items: combinedItems,
            tongTien: total,
            daThu: targetList.every((v) => v.daThu),
            hinhThuc: 'Tiền mặt',
            nguoiThu: defaults.defaultCashier || 'Trần Thu Ngân',
            ngayThu: new Date().toISOString().replace('T', ' ').slice(0, 16),
            ghiChu: `Gom thanh toán ${targetList.length} hóa đơn cho bệnh nhân ${group.hoTenBN}`
        }
        setForm(combinedVoucher)
    }

    const handlePayAllForPatient = async (group) => {
        const unpaidVouchers = group.vouchers.filter((v) => !v.daThu)
        if (unpaidVouchers.length === 0) {
            AppToast.info(`Tất cả hóa đơn của BN ${group.hoTenBN} đều đã được thu tiền!`)
            return
        }
        const methodMap = {
            'Tiền mặt': 'tien_mat',
            'Chuyển khoản': 'chuyen_khoan',
            'Thẻ POS': 'the_pos'
        }
        const selectedMethod = methodMap[form?.hinhThuc] || 'tien_mat'

        for (const v of unpaidVouchers) {
            const targetRef = v.invoiceId || v.id || v.maPhieu
            if (targetRef) {
                try {
                    await cashierService.payInvoice(targetRef, {
                        phuong_thuc_thanh_toan: selectedMethod,
                        so_tien_khach_tra: Number(v.tongTien || 0),
                        ghi_chu: `Thu gộp tất cả viện phí BN ${group.hoTenBN}`
                    })
                } catch {}
            }
        }

        const targetIds = new Set(unpaidVouchers.map((v) => String(v.id)))
        const targetCodes = new Set(unpaidVouchers.map((v) => v.maPhieu))
        const updated = vouchers.map((v) => {
            if (targetIds.has(String(v.id)) || targetCodes.has(v.maPhieu)) {
                return { ...v, daThu: true, hinhThuc: form?.hinhThuc || 'Tiền mặt' }
            }
            return v
        })

        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'vouchers',
                items: deduplicateVouchers(updated),
                auditEntry: {
                    hanhDong: 'BATCH_PAY_PATIENT_VOUCHERS',
                    doiTuong: `${group.hoTenBN} - ${group.totalAmount.toLocaleString('vi-VN')} đ`,
                    mucDich: 'Thu tất cả các dịch vụ cùng lúc cho bệnh nhân',
                },
            })
        )

        await fetchLiveCashierData()
        AppToast.success(`Đã thu toàn bộ ${group.totalAmount.toLocaleString('vi-VN')} đ cho BN ${group.hoTenBN} thành công!`)
        if (form.maBN === group.maBN || form.hoTenBN === group.hoTenBN) {
            setForm((prev) => ({ ...prev, daThu: true }))
        }
    }

    const totalThu = allVouchers
        .filter((v) => v.daThu)
        .reduce((sum, v) => sum + (Number(v.tongTien) || 0), 0)

    const paidCount = allVouchers.filter((v) => v.daThu).length

    const handleSelectPatientAutoFill = (maBN, specificKCB) => {
        if (!maBN && !specificKCB) return
        const matchedUnbilled = liveUnbilled.find(
            (u) => (specificKCB && u.ma_kcb === specificKCB) || (maBN && u.benh_nhan?.mabn === maBN)
        )
        if (matchedUnbilled) {
            handleSelectUnbilledEncounter(matchedUnbilled)
            return
        }
        const matchedPending = livePendingBills.find(
            (pb) => (specificKCB && `KCB-${pb.luot_kham_id}` === specificKCB) || (maBN && pb.benh_nhan?.mabn === maBN)
        )
        const patient = patients.find((p) => p.maBN === maBN)
        const reg = specificKCB
            ? registrations.find((r) => r.maKCB === specificKCB)
            : registrations.find((r) => r.maBN === maBN)
        const autoItems =
            matchedPending?.cac_khoan_thu?.length > 0
                ? matchedPending.cac_khoan_thu.map((line) => ({
                      id: `LINE-${line.id}`,
                      muc_tham_chieu_id: line.muc_tham_chieu_id,
                      loai_muc: line.loai_muc,
                      tenKhoan: line.ten_khoan_thu,
                      soTien: Number(line.thanh_tien),
                      ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng',
                  }))
                : reg?.services?.map((s, i) => ({
                      id: `VI-AUTO-${i + 1}`,
                      muc_tham_chieu_id: s.id || s.chiDinhId || null,
                      loai_muc: s.loai_muc || 'can_lam_sang',
                      tenKhoan: s.tenDV,
                      soTien: Number(s.thanhTien) || Number(s.donGia) || 0,
                      ghiChu: s.phongTH,
                  })) || []
        const sum = matchedPending
            ? Number(matchedPending.thuc_thu ?? matchedPending.tong_tien ?? 0)
            : autoItems.reduce((acc, it) => acc + it.soTien, 0)
        const nextCode = matchedPending ? matchedPending.ma_hoa_don : getNextVoucherCode(vouchers)
        const nextName = patient?.hoTen || matchedPending?.benh_nhan?.ho_ten || reg?.hoTen || form.hoTenBN

        setForm({
            ...form,
            id: matchedPending ? matchedPending.id : nextCode,
            invoiceId: matchedPending ? matchedPending.id : null,
            luotKhamId: matchedPending ? matchedPending.luot_kham_id : null,
            maPhieu: nextCode,
            maBN: maBN || matchedPending?.benh_nhan?.mabn || '',
            maKCB: reg?.maKCB || (matchedPending ? `KCB-${matchedPending.luot_kham_id}` : ''),
            hoTenBN: nextName,
            tenPhieu: `Thu viện phí BN ${nextName} ${reg ? `(Mã KCB: ${reg.maKCB})` : ''}`.trim(),
            items: autoItems.length > 0 ? autoItems : form.items,
            tongTien: autoItems.length > 0 ? sum : form.tongTien,
            daThu: false,
        })
        if (autoItems.length > 0) {
            AppToast.info(`Đã nạp thông tin dịch vụ của BN ${nextName}`)
        }
    }

    const handleAddLineItem = () => {
        const amount = Number(newItemAmount) || 0
        if (!newItemName.trim() || amount <= 0) {
            AppToast.warning('Vui lòng nhập tên khoản thu và số tiền hợp lệ!')
            return
        }
        const nextItems = [
            ...(form.items || []),
            {
                id: `VI-${Date.now().toString().slice(-4)}`,
                tenKhoan: newItemName,
                soTien: amount,
                ghiChu: newItemNote,
            },
        ]
        const nextTotal = nextItems.reduce((sum, i) => sum + (Number(i.soTien) || 0), 0)
        setForm({ ...form, items: nextItems, tongTien: nextTotal })
        setNewItemNote('')
    }

    const handleSaveVoucher = async () => {
        if (!form.tenPhieu?.trim()) {
            AppToast.error('Vui lòng nhập Tên phiếu thu viện phí!')
            return
        }

        if (form.isCombined && Array.isArray(form.combinedInvoiceIds)) {
            const methodMap = {
                'Tiền mặt': 'tien_mat',
                'Chuyển khoản': 'chuyen_khoan',
                'Thẻ POS': 'the_pos'
            }
            if (form.daThu) {
                for (const ref of form.combinedInvoiceIds) {
                    try {
                        await cashierService.payInvoice(ref, {
                            phuong_thuc_thanh_toan: methodMap[form.hinhThuc] || 'tien_mat',
                            so_tien_khach_tra: 0,
                            ghi_chu: form.ghiChu || 'Thu gộp viện phí'
                        })
                    } catch {}
                }
            }
            const targetIds = new Set((form.combinedVoucherIds || []).map(String))
            const updatedVouchers = vouchers.map((v) => {
                if (
                    targetIds.has(String(v.id)) ||
                    (form.combinedInvoiceIds || []).includes(v.invoiceId) ||
                    (form.combinedInvoiceIds || []).includes(v.id)
                ) {
                    return { ...v, daThu: Boolean(form.daThu), hinhThuc: form.hinhThuc }
                }
                return v
            })
            await dispatch(
                updateClinicCollectionAsync({
                    collectionKey: 'vouchers',
                    items: deduplicateVouchers(updatedVouchers),
                    auditEntry: {
                        hanhDong: 'BATCH_PAY_VOUCHERS',
                        doiTuong: `${form.maPhieu} - ${Number(form.tongTien || 0).toLocaleString('vi-VN')} đ`,
                        mucDich: 'Thu gộp tất cả dịch vụ cho bệnh nhân',
                    },
                })
            )
            AppToast.success(`Đã cập nhật thu gộp cho BN ${form.hoTenBN}!`)
            await fetchLiveCashierData()
            setForm((prev) => ({ ...prev, daThu: Boolean(form.daThu) }))
            return
        }
        let activeInvoiceId = form.invoiceId
        let activeMaPhieu = form.maPhieu
        let activeId = form.id

        if (!activeInvoiceId && form.luotKhamId) {
            try {
                const congKhamItem = (form.items || []).some((it) => it.loai_muc === 'cong_kham')
                const clsItemIds = (form.items || [])
                    .filter((it) => it.loai_muc === 'can_lam_sang' && it.muc_tham_chieu_id)
                    .map((it) => it.muc_tham_chieu_id)
                const created = await cashierService.createInvoice({
                    luot_kham_id: form.luotKhamId,
                    mien_giam: 0,
                    include_cong_kham: congKhamItem,
                    chi_dinh_ids: clsItemIds
                })
                activeInvoiceId = created.id
                activeMaPhieu = created.ma_hoa_don
                activeId = created.id
                setForm((prev) => ({
                    ...prev,
                    id: created.id,
                    invoiceId: created.id,
                    maPhieu: created.ma_hoa_don
                }))
                fetchLiveCashierData()
            } catch (err) {
                AppToast.error(err?.response?.data?.message || err?.message || 'Không thể lập hóa đơn viện phí!')
                return
            }
        }

        const calculatedTotal =
            (form.items || []).length > 0
                ? (form.items || []).reduce((sum, i) => sum + (Number(i.soTien) || 0), 0)
                : Number(form.tongTien || 0)

        const targetRef = activeInvoiceId || activeMaPhieu || form.id
        if (targetRef && form.daThu) {
            try {
                const methodMap = {
                    'Tiền mặt': 'tien_mat',
                    'Chuyển khoản': 'chuyen_khoan',
                    'Thẻ POS': 'the_pos'
                }
                const paid = await cashierService.payInvoice(targetRef, {
                    phuong_thuc_thanh_toan: methodMap[form.hinhThuc] || 'tien_mat',
                    so_tien_khach_tra: calculatedTotal,
                    ghi_chu: form.ghiChu || form.tenPhieu || 'Thanh toán tại quầy'
                })
                if (paid?.id) {
                    activeInvoiceId = paid.id
                }
                fetchLiveCashierData()
            } catch (err) {
                if (!err?.response) {
                    AppToast.error(err?.message || 'Thanh toán viện phí thất bại!')
                }
                return
            }
        }

        const payload = {
            ...form,
            id: activeId || form.id || activeMaPhieu,
            invoiceId: activeInvoiceId,
            maPhieu: activeMaPhieu,
            loaiPhieu: 'Phiếu thu',
            tongTien: calculatedTotal
        }

        const cleanedSource = vouchers.filter(
            (v) => !(v?.maPhieu === 'DỰ KIẾN LẬP HÓA ĐƠN' && payload.luotKhamId && v.luotKhamId === payload.luotKhamId)
        )
        const matchIdx = cleanedSource.findIndex((v) => areVouchersMatching(v, payload))
        let updated
        if (matchIdx >= 0) {
            updated = [...cleanedSource]
            updated[matchIdx] = mergeVoucherData(updated[matchIdx], payload)
            setForm(updated[matchIdx])
        } else {
            const newVoucher = { ...payload, id: payload.id || payload.maPhieu || `PT-${Date.now().toString().slice(-5)}` }
            updated = [newVoucher, ...cleanedSource]
            setForm(newVoucher)
        }
        updated = deduplicateVouchers(updated)
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'vouchers',
                items: updated,
                auditEntry: {
                    hanhDong: matchIdx >= 0 ? 'UPDATE_VOUCHER' : 'CREATE_VOUCHER',
                    doiTuong: `${payload.maPhieu} - ${payload.tongTien.toLocaleString('vi-VN')} đ`,
                    mucDich: 'Quản lý thu viện phí & biên lai thanh toán',
                },
            })
        )
        AppToast.success(matchIdx >= 0 ? 'Đã cập nhật phiếu thu viện phí!' : 'Đã lập phiếu thu viện phí mới thành công!')
    }

    const handleDeleteVoucher = async () => {
        if (!form.id && !form.maPhieu) return
        const updated = deduplicateVouchers(vouchers.filter((v) => !areVouchersMatching(v, form)))
        await dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'vouchers',
                items: updated,
                auditEntry: {
                    hanhDong: 'DELETE_VOUCHER',
                    doiTuong: `${form.maPhieu} - ${form.tenPhieu}`,
                    mucDich: 'Hủy phiếu thu viện phí',
                },
            })
        )
        setForm(updated[0] || buildEmptyVoucher())
        AppToast.info('Đã xóa phiếu thu viện phí!')
    }

    return (
        <div className="space-y-3.5">
            <div className="medpro-card p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveCashierTab('THU_CHI')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                            activeCashierTab === 'THU_CHI'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <Receipt size={15} weight="bold" />
                        <span>1. Quản lý Thu viện phí & Hóa đơn ({allVouchers.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveCashierTab('KHOA_SO')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                            activeCashierTab === 'KHOA_SO'
                                ? 'bg-[#00B5F1] text-white shadow-xs'
                                : 'text-[#003553] hover:bg-white/80'
                        }`}
                    >
                        <FloppyDisk size={15} weight="bold" />
                        <span>2. Quản lý Khóa sổ cuối ngày (/khoaso) ({cashierClosings.length})</span>
                    </button>
                </div>
                {activeCashierTab === 'KHOA_SO' && (
                    <button
                        type="button"
                        onClick={handleDailyClosing}
                        className="medpro-btn-primary text-xs"
                    >
                        <span>Khóa sổ ca hôm nay</span>
                    </button>
                )}
            </div>

            {activeCashierTab === 'KHOA_SO' ? (
                <div className="medpro-card p-4 space-y-4">
                    <div className="medpro-section-title">
                        <span>NHẬT KÝ KHÓA SỔ TỰ ĐỘNG & DOANH THU VIỆN PHÍ (/khoaso)</span>
                    </div>
                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table">
                            <thead>
                                <tr>
                                    <th>Mã kỳ khóa sổ</th>
                                    <th>Thời điểm khóa sổ</th>
                                    <th>Thu ngân phụ trách</th>
                                    <th>Thu dịch vụ kỹ thuật</th>
                                    <th>Tổng doanh thu ca</th>
                                    <th>Cơ chế</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cashierClosings.map((ks) => (
                                    <tr key={ks.id}>
                                        <td className="font-mono font-bold text-[#00B5F1]">{ks.maKyKhoaSo}</td>
                                        <td className="tabular-nums text-xs font-semibold">{ks.ngayKhoaSo}</td>
                                        <td className="font-bold text-[#003553]">{ks.nguoiKhoaSo}</td>
                                        <td className="tabular-nums font-mono">{(ks.tongThuDichVu || 0).toLocaleString('vi-VN')} đ</td>
                                        <td className="tabular-nums font-mono font-black text-[#003553]">
                                            {(ks.tonQuyCuoiNgay ?? ks.tongThuDichVu ?? 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="text-xs text-slate-500">{ks.cheDo}</td>
                                        <td>
                                            <span className={ks.trangThai?.includes('Đã khóa') ? 'medpro-badge-success' : 'medpro-badge-warning'}>
                                                {ks.trangThai}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    <div className="lg:col-span-4 medpro-card p-3.5 flex flex-col h-[calc(100vh-140px)]">
                        <div className="medpro-section-title">
                            <span className="inline-flex items-center gap-1.5">
                                <Receipt size={16} weight="duotone" className="text-[#00B5F1]" />
                                <span>DANH SÁCH PHIẾU THU VIỆN PHÍ ({filteredVouchers.length})</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setForm(buildEmptyVoucher())}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00B5F1] hover:underline cursor-pointer"
                            >
                                <Plus size={13} weight="bold" />
                                <span>Lập phiếu mới</span>
                            </button>
                        </div>

                        {liveUnbilled.length > 0 ? (
                            <div className="mb-3 p-2.5 rounded-xl bg-sky-50/90 border border-sky-200">
                                <div className="flex items-center justify-between text-xs font-bold text-sky-900 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Receipt size={14} weight="bold" className="text-sky-600" />
                                        <span>PHIẾU CHỈ ĐỊNH / DỊCH VỤ CHỜ THU ({liveUnbilled.length})</span>
                                    </span>
                                    <span className="text-[10px] text-sky-600 font-semibold">Tách riêng từng phiếu</span>
                                </div>
                                <div className="space-y-1 max-h-36 overflow-y-auto">
                                    {liveUnbilled.map((u) => (
                                        <div
                                            key={u.luot_kham_id}
                                            onClick={() => handleSelectUnbilledEncounter(u)}
                                            className="px-2 py-1.5 rounded-lg bg-white hover:bg-sky-100 text-xs flex items-center justify-between cursor-pointer transition border border-sky-100"
                                        >
                                            <div>
                                                <span className="font-bold text-[#003553]">{u.benh_nhan?.ho_ten}</span>
                                                <span className="ml-1.5 font-mono text-[10px] text-slate-500">({u.ma_kcb})</span>
                                                <div className="text-[10px] text-slate-500">
                                                    BS: {u.bac_si_kham || 'Phụ trách'} | {u.so_chi_dinh} CLS
                                                </div>
                                            </div>
                                            <span className="font-bold text-emerald-700 font-mono text-[11px]">
                                                {Number(u.tam_tinh || 0).toLocaleString('vi-VN')} đ
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (pendingBillRegistrations.length > 0 && (
                            <div className="mb-3 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200">
                                <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Receipt size={14} weight="bold" className="text-amber-600" />
                                        <span>CHỜ THU TIỀN VIỆN PHÍ ({pendingBillRegistrations.length})</span>
                                    </span>
                                    <span className="text-[10px] text-amber-600 font-semibold">Click nạp nhanh</span>
                                </div>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {pendingBillRegistrations.map((p) => {
                                        const total = (p.services || []).reduce((acc, s) => acc + (Number(s.thanhTien) || 0), 0)
                                        return (
                                            <div
                                                key={p.id}
                                                onClick={() => handleSelectPatientAutoFill(p.maBN, p.maKCB)}
                                                className="px-2 py-1.5 rounded-lg bg-white hover:bg-amber-100/70 text-xs flex items-center justify-between cursor-pointer transition border border-amber-100"
                                            >
                                                <div>
                                                    <span className="font-bold text-[#003553]">{p.hoTen}</span>
                                                    <span className="ml-1.5 font-mono text-[10px] text-slate-500">({p.maKCB})</span>
                                                </div>
                                                <span className="font-bold text-emerald-700 font-mono text-[11px]">
                                                    {total.toLocaleString('vi-VN')} đ
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="grid grid-cols-12 gap-2 mb-3">
                            <div className="col-span-7 relative">
                                <MagnifyingGlass
                                    size={14}
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Tìm Mã phiếu, Tên BN..."
                                    className="medpro-input !pl-8"
                                />
                            </div>
                            <div className="col-span-5 relative">
                                <Funnel
                                    size={13}
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="medpro-input !pl-7 text-xs font-semibold"
                                >
                                    <option value="ALL">Tất cả trạng thái</option>
                                    <option value="PAID">Đã thu tiền</option>
                                    <option value="PENDING">Chờ thu tiền</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 py-1 px-1 bg-slate-50 rounded-lg text-xs">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setInvoiceViewMode('BY_PATIENT')}
                                    className={`px-2 py-1 rounded-md font-semibold transition ${
                                        invoiceViewMode === 'BY_PATIENT'
                                            ? 'bg-white text-[#00B5F1] shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Theo bệnh nhân ({groupedPatients.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInvoiceViewMode('FLAT_LIST')}
                                    className={`px-2 py-1 rounded-md font-semibold transition ${
                                        invoiceViewMode === 'FLAT_LIST'
                                            ? 'bg-white text-[#00B5F1] shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Tất cả phiếu ({filteredVouchers.length})
                                </button>
                            </div>
                            {invoiceViewMode === 'BY_PATIENT' && groupedPatients.length > 0 && (
                                <button
                                    type="button"
                                    onClick={toggleExpandAll}
                                    className="text-[11px] text-slate-500 hover:text-[#00B5F1] font-medium px-1"
                                >
                                    {isAllExpanded ? 'Thu gọn' : 'Mở rộng'}
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto border border-[#E5EEF5] rounded-xl">
                            {invoiceViewMode === 'BY_PATIENT' ? (
                                <div className="divide-y divide-slate-100">
                                    {groupedPatients.map((group) => {
                                        const isExpanded = expandedPatients.has(group.key)
                                        return (
                                            <div key={group.key} className="bg-white">
                                                <div
                                                    onClick={() => handleSelectPatientCombined(group)}
                                                    className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition border-l-4 ${
                                                        form?.maBN === group.maBN || form?.hoTenBN === group.hoTenBN
                                                            ? 'bg-[#F0F9FF] border-l-[#00B5F1] font-semibold'
                                                            : 'border-l-transparent hover:border-l-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                togglePatient(group.key)
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                                                        >
                                                            {isExpanded ? (
                                                                <CaretDown size={14} weight="bold" />
                                                            ) : (
                                                                <CaretRight size={14} weight="bold" />
                                                            )}
                                                        </button>
                                                        <div className="w-7 h-7 rounded-full bg-sky-100 text-[#00B5F1] flex items-center justify-center shrink-0">
                                                            <User size={15} weight="bold" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-xs text-[#003553] truncate">
                                                                {group.hoTenBN}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 truncate">
                                                                {group.maBN ? `Mã: ${group.maBN}` : 'Vãng lai'}
                                                                {group.soDienThoai ? ` • ${group.soDienThoai}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-xs font-bold tabular-nums text-[#003553]">
                                                            {group.totalAmount.toLocaleString('vi-VN')} đ
                                                        </div>
                                                        <div className="flex items-center justify-end gap-1 mt-0.5">
                                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                                {group.vouchers.length} phiếu
                                                            </span>
                                                            {group.unpaidCount > 0 && (
                                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                    {group.unpaidCount} chờ thu
                                                                </span>
                                                            )}
                                                            {group.paidCount > 0 && (
                                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    {group.paidCount} đã thu
                                                                </span>
                                                            )}
                                                        </div>
                                                        {group.unpaidCount > 0 && (
                                                            <div className="mt-1 flex items-center justify-end gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleSelectPatientGroup(group)
                                                                        const unpaid = group.vouchers.filter((v) => !v.daThu)
                                                                        const combinedInv = {
                                                                            id: `GOP-${group.key}`,
                                                                            isCombined: true,
                                                                            combinedVoucherIds: unpaid.map((v) => v.id),
                                                                            combinedInvoiceIds: unpaid.map((v) => v.invoiceId || v.id).filter(Boolean),
                                                                            maPhieu: `GOP-${group.maBN || 'BN'}-${unpaid.length}HD`,
                                                                            maBN: group.maBN,
                                                                            hoTenBN: group.hoTenBN,
                                                                            tenPhieu: `Thu gộp toàn bộ dịch vụ BN ${group.hoTenBN}`,
                                                                            tongTien: unpaid.reduce((sum, v) => sum + Number(v.tongTien || 0), 0)
                                                                        }
                                                                        handleOpenQr(combinedInv)
                                                                    }}
                                                                    className="px-2 py-0.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold cursor-pointer transition shadow-xs flex items-center gap-1"
                                                                    title="Quét mã QR (SePay / VietQR) thu gộp toàn bộ"
                                                                >
                                                                    <QrCode size={11} weight="bold" />
                                                                    <span>QR gộp</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handlePayAllForPatient(group)
                                                                    }}
                                                                    className="px-2 py-0.5 rounded-md bg-[#00B5F1] hover:bg-[#0095c8] text-white text-[10px] font-bold cursor-pointer transition shadow-xs"
                                                                    title="Thu tiền toàn bộ các dịch vụ của bệnh nhân này cùng lúc"
                                                                >
                                                                    Thu tất cả ({group.unpaidCount})
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="bg-slate-50/70 pl-8 pr-2.5 py-1.5 space-y-1.5 border-t border-slate-100">
                                                        {group.vouchers.map((v) => {
                                                            const isSelected = form.id === v.id || (form.maPhieu && form.maPhieu === v.maPhieu)
                                                            return (
                                                                <div
                                                                    key={v.invoiceId ? `${v.invoiceId}-${v.maPhieu}` : (v.id || v.maPhieu)}
                                                                    onClick={() => handleSelectVoucher(v)}
                                                                    className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between border ${
                                                                        isSelected
                                                                            ? 'bg-[#E8F4FD] border-[#00B5F1] shadow-xs'
                                                                            : 'bg-white border-slate-200 hover:border-sky-300'
                                                                    }`}
                                                                >
                                                                    <div className="min-w-0 pr-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="font-mono text-[11px] font-bold text-[#00B5F1]">
                                                                                {v.maPhieu}
                                                                            </span>
                                                                            <span className="text-xs font-medium text-slate-700 truncate max-w-[140px]">
                                                                                {v.tenPhieu || 'Hóa đơn dịch vụ'}
                                                                            </span>
                                                                        </div>
                                                                        {v.ngayThu && (
                                                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                                                {v.ngayThu}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right shrink-0 flex items-center gap-1.5">
                                                                        <div>
                                                                            <div className="text-xs font-bold tabular-nums text-[#003553]">
                                                                                {Number(v.tongTien).toLocaleString('vi-VN')} đ
                                                                            </div>
                                                                            <div className="mt-0.5 flex justify-end">
                                                                                <StatusBadge status={v.daThu ? 'Đã thu' : 'Chờ thu'} showText={true} />
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleOpenQr(v)
                                                                            }}
                                                                            className="p-1 text-teal-600 hover:text-teal-900 transition cursor-pointer"
                                                                            title="Mã QR (SePay / VietQR)"
                                                                        >
                                                                            <QrCode size={14} weight="bold" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    {groupedPatients.length === 0 && (
                                        <div className="py-8">
                                            <EmptyState
                                                icon="Receipt"
                                                title="Không tìm thấy bệnh nhân hoặc phiếu thu nào"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <table className="medpro-table">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Mã phiếu</th>
                                            <th>Bệnh nhân / Người nộp</th>
                                            <th>Số tiền</th>
                                            <th className="text-center">TT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVouchers.map((v, idx) => (
                                            <tr
                                                key={v.invoiceId ? `${v.invoiceId}-${v.maPhieu}` : (v.id || v.maPhieu)}
                                                onClick={() => handleSelectVoucher(v)}
                                                className={`cursor-pointer ${
                                                    form.id === v.id ? '!bg-[#E8F4FD] font-semibold border-l-4 border-l-[#00B5F1]' : ''
                                                }`}
                                            >
                                                <td className="tabular-nums text-center font-bold">{idx + 1}</td>
                                                <td className="font-mono text-[11px] font-bold text-[#00B5F1]">{v.maPhieu}</td>
                                                <td className="font-semibold text-[#12263F]">{v.hoTenBN}</td>
                                                <td className="tabular-nums font-bold text-[#003553]">
                                                    {Number(v.tongTien).toLocaleString('vi-VN')} đ
                                                </td>
                                                <td className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <StatusBadge status={v.daThu ? 'Đã thu' : 'Chờ thu'} showText={false} />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleOpenQr(v)
                                                            }}
                                                            className="p-1 text-teal-600 hover:text-teal-900 transition cursor-pointer"
                                                            title="Mã QR (SePay / VietQR)"
                                                        >
                                                            <QrCode size={13} weight="bold" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredVouchers.length === 0 && (
                                            <tr>
                                                <td colSpan={5}>
                                                    <EmptyState
                                                        icon="Receipt"
                                                        title="Không tìm thấy phiếu thu nào"
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="pt-2.5 grid grid-cols-2 gap-2 text-xs font-bold border-t border-slate-100 mt-2">
                            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 flex justify-between">
                                <span>Doanh thu:</span>
                                <span className="tabular-nums">{totalThu.toLocaleString('vi-VN')} đ</span>
                            </div>
                            <div className="p-2 rounded-lg bg-sky-50 text-sky-700 flex justify-between">
                                <span>Đã thu tiền:</span>
                                <span className="tabular-nums">{paidCount} / {allVouchers.length} phiếu</span>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8 medpro-card p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8F4FD]">
                            <div>
                                <h2 className="font-display text-base font-extrabold text-[#003553] uppercase">
                                    QUẢN LÝ THU VIỆN PHÍ & BIÊN LAI PHÒNG KHÁM
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Lập phiếu thu viện phí tự động từ chỉ định dịch vụ & in biên lai thu tiền
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setForm(buildEmptyVoucher())}
                                    className="medpro-btn-outline text-xs"
                                >
                                    <Plus size={14} weight="bold" className="text-[#00B5F1]" />
                                    <span>Lập phiếu thu mới</span>
                                </button>
                                <button type="button" onClick={handleSaveVoucher} className="medpro-btn-primary text-xs">
                                    <FloppyDisk size={15} weight="bold" />
                                    <span>Lưu phiếu</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOpenQr(form)}
                                    className="medpro-btn-outline text-xs font-bold border-teal-500 text-teal-700 hover:bg-teal-50 flex items-center gap-1.5 cursor-pointer"
                                    title="Tạo mã QR thanh toán viện phí (SePay / VietQR)"
                                >
                                    <QrCode size={15} weight="bold" />
                                    <span>Mã QR SePay / VietQR</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsReceiptModalOpen(true)}
                                    className="medpro-btn-amber text-xs font-bold"
                                >
                                    <Printer size={15} weight="bold" />
                                    <span>In biên lai thu tiền</span>
                                </button>
                                {form.id && (
                                    <button type="button" onClick={handleDeleteVoucher} className="medpro-btn-danger text-xs">
                                        <Trash size={14} weight="bold" />
                                        <span>Xóa</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {form.isCombined && (
                            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-sky-800 font-semibold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#00B5F1] animate-pulse"></span>
                                    <span>Đang thu gộp toàn bộ {form.items?.length || 0} dịch vụ của BN {form.hoTenBN}. Bấm &quot;Lưu phiếu&quot; hoặc &quot;Mã VietQR&quot; để thanh toán tất cả cùng lúc!</span>
                                </div>
                                <div className="font-extrabold tabular-nums text-[#003553] text-sm bg-white px-2.5 py-1 rounded-lg border border-sky-100 shadow-xs">
                                    Tổng thu gộp: {Number(form.tongTien || 0).toLocaleString('vi-VN')} đ
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="medpro-label">Loại chứng từ</label>
                                <div className="h-[34px] flex items-center px-3 rounded-lg border border-sky-200 bg-sky-50 text-[#003553] font-bold text-xs select-none">
                                    Phiếu thu viện phí
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="medpro-label mb-0">Mã phiếu thu</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                        Hệ thống tự sinh
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={form.maPhieu || ''}
                                    readOnly
                                    disabled
                                    className="medpro-input font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                                    title="Mã phiếu thu do hệ thống tự sinh, không thể chỉnh sửa"
                                />
                            </div>
                            <div>
                                <label className="medpro-label">Chọn Bệnh nhân (Tự động lấy dịch vụ)</label>
                                <select
                                    value={form.maBN || ''}
                                    onChange={(e) => handleSelectPatientAutoFill(e.target.value)}
                                    className="medpro-input font-semibold"
                                >
                                    <option value="">-- Chọn BN hoặc nhập tay --</option>
                                    {patients.map((p) => (
                                        <option key={p.id} value={p.maBN}>
                                            {p.maBN} — {p.hoTen}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Họ tên người nộp / Bệnh nhân</label>
                                <input
                                    type="text"
                                    value={form.hoTenBN || ''}
                                    onChange={(e) => setForm({ ...form, hoTenBN: e.target.value })}
                                    className="medpro-input font-semibold"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="medpro-label">Tên phiếu / Nội dung thu viện phí *</label>
                                <input
                                    type="text"
                                    value={form.tenPhieu || ''}
                                    onChange={(e) => setForm({ ...form, tenPhieu: e.target.value })}
                                    placeholder="VD: Thu viện phí BN Nguyễn Thị B..."
                                    className="medpro-input font-semibold"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="medpro-label">Hình thức thanh toán</label>
                                    {(form.hinhThuc === 'Chuyển khoản' || form.hinhThuc === 'Chuyển khoản QR (SePay / VietQR)') && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenQr(form)}
                                            className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                                        >
                                            <QrCode size={14} weight="bold" />
                                            <span>Mở mã QR</span>
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={form.hinhThuc || paymentMethods[0]?.value}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setForm({ ...form, hinhThuc: val })
                                        if (val === 'Chuyển khoản') {
                                            handleOpenQr({ ...form, hinhThuc: val })
                                        }
                                    }}
                                    className="medpro-input"
                                >
                                    {paymentMethods.map((pm) => (
                                        <option key={pm.value} value={pm.value}>
                                            {pm.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="medpro-label">Trạng thái thanh toán</label>
                                <div className="h-[34px] flex items-center gap-2 px-3 rounded border border-[#CBD5E1] bg-[#F8FBFE]">
                                    <input
                                        id="chk-dathu"
                                        type="checkbox"
                                        checked={Boolean(form.daThu)}
                                        onChange={(e) => setForm({ ...form, daThu: e.target.checked })}
                                        className="w-4 h-4 accent-[#00B5F1]"
                                    />
                                    <label htmlFor="chk-dathu" className="text-xs font-bold text-[#003553] cursor-pointer">
                                        {form.daThu ? 'Đã thu tiền (Hợp lệ)' : 'Chưa thu (Chờ thanh toán)'}
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="medpro-section-title">
                                <span>CHI TIẾT CÁC KHOẢN VIỆN PHÍ TRONG PHIẾU ({form.items?.length || 0} KHOẢN)</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end mb-3 p-3 rounded-xl bg-[#F8FBFE] border border-[#CBE9FA]">
                                <div className="sm:col-span-5">
                                    <label className="medpro-label">Chọn hoặc nhập tên khoản thu</label>
                                    <input
                                        type="text"
                                        list="khoan-muc-datalist"
                                        value={newItemName}
                                        onChange={(e) => {
                                            setNewItemName(e.target.value)
                                            const matched = khoanThuCatalog.find((k) => k.ten === e.target.value)
                                            if (matched) setNewItemAmount(matched.donGiaMacDinh)
                                        }}
                                        className="medpro-input"
                                    />
                                    <datalist id="khoan-muc-datalist">
                                        {khoanThuCatalog.map((k) => (
                                            <option key={k.id} value={k.ten} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="medpro-label">Số tiền (VNĐ)</label>
                                    <input
                                        type="number"
                                        value={newItemAmount}
                                        onChange={(e) => setNewItemAmount(e.target.value)}
                                        className="medpro-input tabular-nums font-bold"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="medpro-label">Ghi chú</label>
                                    <input
                                        type="text"
                                        value={newItemNote}
                                        onChange={(e) => setNewItemNote(e.target.value)}
                                        className="medpro-input"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <button type="button" onClick={handleAddLineItem} className="medpro-btn-primary w-full text-xs">
                                        <Plus size={14} weight="bold" />
                                        <span>Thêm khoản</span>
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                                <table className="medpro-table">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Nội dung khoản thu</th>
                                            <th>Số tiền (VNĐ)</th>
                                            <th>Ghi chú</th>
                                            <th>Xóa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(form.items || []).map((it, idx) => (
                                            <tr key={it.id}>
                                                <td className="tabular-nums font-bold">{idx + 1}</td>
                                                <td className="font-semibold text-[#12263F]">{it.tenKhoan}</td>
                                                <td className="tabular-nums font-bold text-[#003553]">
                                                    {Number(it.soTien).toLocaleString('vi-VN')} đ
                                                </td>
                                                <td>{it.ghiChu}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const nextItems = form.items.filter((x) => x.id !== it.id)
                                                            const nextTotal = nextItems.reduce(
                                                                (sum, x) => sum + (Number(x.soTien) || 0),
                                                                0
                                                            )
                                                            setForm({ ...form, items: nextItems, tongTien: nextTotal })
                                                        }}
                                                        className="inline-flex items-center gap-1 text-rose-600 text-xs font-bold hover:underline cursor-pointer"
                                                    >
                                                        <Trash size={13} weight="bold" />
                                                        <span>Xóa</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!form.items || form.items.length === 0) && (
                                            <tr>
                                                <td colSpan={5}>
                                                    <EmptyState
                                                        icon="Receipt"
                                                        title="Chưa có khoản thu nào"
                                                        description="Chọn bệnh nhân để tự động lấy dịch vụ hoặc thêm khoản thu ở trên."
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-3 p-3.5 rounded-xl bg-[#003553] text-white flex items-center justify-between">
                                <span className="font-bold text-xs uppercase tracking-wider">
                                    TỔNG CỘNG TIỀN VIỆN PHÍ (PHIẾU THU):
                                </span>
                                <span className="font-display text-xl font-extrabold text-[#FFB54A] tabular-nums">
                                    {Number(form.tongTien || 0).toLocaleString('vi-VN')} VNĐ
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <VietQrModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
                invoice={qrInvoice || form}
                bankBin={clinicData?.clinicSettings?.bankInfo?.bankBin || '970422'}
                bankName={clinicData?.clinicSettings?.bankInfo?.bankName || 'MBBank (Ngân hàng TMCP Quân Đội)'}
                accountNumber={clinicData?.clinicSettings?.bankInfo?.accountNumber || '0901234567'}
                accountName={clinicData?.clinicSettings?.bankInfo?.accountName || clinicData?.clinicSettings?.tenPhongKham || 'PHONG KHAM CLINIC AI'}
                onConfirmPayment={async (inv) => {
                    const rawTargetAmount =
                        inv?.thuc_thu !== undefined
                            ? inv.thuc_thu
                            : inv?.thucThu !== undefined
                              ? inv.thucThu
                              : inv?.tong_tien !== undefined
                                ? inv.tong_tien
                                : inv?.tongTien ?? form.tongTien ?? 0
                    const targetAmount = Math.max(0, Number(rawTargetAmount || 0))

                    if (inv?.isCombined || form?.isCombined) {
                        const targetInvoices = inv?.combinedInvoiceIds || form?.combinedInvoiceIds || []
                        for (const ref of targetInvoices) {
                            try {
                                await cashierService.payInvoice(ref, {
                                    phuong_thuc_thanh_toan: 'chuyen_khoan',
                                    so_tien_khach_tra: 0,
                                    ghi_chu: 'Thanh toán qua quét mã VietQR gộp'
                                })
                            } catch {}
                        }
                        const targetVoucherIds = new Set((inv?.combinedVoucherIds || form?.combinedVoucherIds || []).map(String))
                        const nextVouchers = vouchers.map((v) => {
                            if (targetVoucherIds.has(String(v.id)) || targetInvoices.includes(v.invoiceId) || targetInvoices.includes(v.id)) {
                                return { ...v, daThu: true, hinhThuc: 'Chuyển khoản' }
                            }
                            return v
                        })
                        await dispatch(
                            updateClinicCollectionAsync({
                                collectionKey: 'vouchers',
                                items: deduplicateVouchers(nextVouchers),
                                auditEntry: {
                                    hanhDong: 'VIETQR_BATCH_PAYMENT_CONFIRMED',
                                    doiTuong: `${form.maPhieu} - ${targetAmount.toLocaleString('vi-VN')} đ`,
                                    mucDich: 'Xác nhận gạch nợ chuyển khoản VietQR gộp',
                                },
                            })
                        )
                        await fetchLiveCashierData()
                        setForm((prev) => ({ ...prev, daThu: true, hinhThuc: 'Chuyển khoản' }))
                        return
                    }

                    const targetRef = inv?.invoiceId || inv?.maPhieu || inv?.id || form?.invoiceId || form?.maPhieu || form?.id
                    if (!targetRef) return
                    const paid = await cashierService.payInvoice(targetRef, {
                        phuong_thuc_thanh_toan: 'chuyen_khoan',
                        so_tien_khach_tra: targetAmount,
                        ghi_chu: inv?.tenPhieu || form?.tenPhieu || 'Thanh toán qua quét mã VietQR'
                    })
                    const updatedVoucher = {
                        ...form,
                        ...(inv || {}),
                        id: inv?.id || form.id || targetRef,
                        invoiceId: paid?.id || inv?.invoiceId || form.invoiceId,
                        maPhieu: inv?.maPhieu || form.maPhieu || paid?.ma_hoa_don || String(targetRef),
                        loaiPhieu: 'Phiếu thu',
                        hinhThuc: 'Chuyển khoản',
                        daThu: true,
                        tongTien: targetAmount,
                    }
                    setForm(updatedVoucher)
                    const matchIdx = vouchers.findIndex((v) => areVouchersMatching(v, updatedVoucher))
                    let nextVouchers
                    if (matchIdx >= 0) {
                        nextVouchers = [...vouchers]
                        nextVouchers[matchIdx] = mergeVoucherData(nextVouchers[matchIdx], updatedVoucher)
                    } else {
                        nextVouchers = [updatedVoucher, ...vouchers]
                    }
                    nextVouchers = deduplicateVouchers(nextVouchers)
                    await dispatch(
                        updateClinicCollectionAsync({
                            collectionKey: 'vouchers',
                            items: nextVouchers,
                            auditEntry: {
                                hanhDong: 'VIETQR_PAYMENT_CONFIRMED',
                                doiTuong: `${updatedVoucher.maPhieu} - ${targetAmount.toLocaleString('vi-VN')} đ`,
                                mucDich: 'Xác nhận gạch nợ chuyển khoản VietQR',
                            },
                        })
                    )
                    await fetchLiveCashierData()
                }}
            />

            <ReceiptModal
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                voucher={form}
                clinicInfo={clinicData?.clinicSettings || {}}
            />
        </div>
    )
}
