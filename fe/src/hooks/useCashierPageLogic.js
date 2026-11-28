import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AppToast } from '../components/common/AppNotification'
import { getFormDefaults } from '../utils/helpers/clinicConfigHelpers'
import { cashierService } from '../services/cashierService'
import {
    getDateRangeForPreset,
    groupVouchersByPatient,
    matchesVoucherDateAndShift,
    resolveInvoicePayableAmount,
    resolveVoucherShift,
} from '../utils/helpers/cashierInvoiceHelpers'

const METHOD_LABEL_MAP = {
    tien_mat: 'Tiền mặt',
    chuyen_khoan: 'Chuyển khoản',
    vietqr: 'Chuyển khoản',
    qr: 'Chuyển khoản',
    the_pos: 'Thẻ POS',
}

const METHOD_API_MAP = {
    'Tiền mặt': 'tien_mat',
    'Chuyển khoản': 'chuyen_khoan',
    'Chuyển khoản QR (SePay / VietQR)': 'chuyen_khoan',
    'Thẻ POS': 'the_pos',
}

function mapInvoiceToVoucher(inv, defaultCashier) {
    const rawTime = inv.ngay_thanh_toan || inv.created_at
    const amount = resolveInvoicePayableAmount(inv)
    const methodKey = String(inv.phuong_thuc_thanh_toan || 'tien_mat').toLowerCase()
    const patientName = inv.benh_nhan?.ho_ten || 'Chưa rõ'
    const collectedAmount = inv.trang_thai === 'da_thu' ? (Number(inv.thuc_thu) || amount) : 0
    return {
        id: inv.id,
        invoiceId: inv.id,
        luotKhamId: inv.luot_kham_id || null,
        maPhieu: inv.ma_hoa_don,
        loaiPhieu: 'Phiếu thu',
        maKCB: inv.luot_kham_id ? `KCB-${inv.luot_kham_id}` : '',
        maBN: inv.benh_nhan?.mabn || '',
        hoTenBN: patientName,
        soDienThoai: inv.benh_nhan?.so_dien_thoai || '',
        tongTien: amount,
        thuc_thu: collectedAmount,
        daThu: inv.trang_thai === 'da_thu',
        trangThai: inv.trang_thai,
        ngayThu: rawTime ? new Date(rawTime).toLocaleString('vi-VN') : '',
        rawTimestamp: rawTime || null,
        ngayThanhToan: inv.ngay_thanh_toan || null,
        createdAt: inv.created_at || null,
        caThu: resolveVoucherShift(rawTime),
        nguoiThu: defaultCashier || 'Thu ngân phòng khám',
        hinhThuc: METHOD_LABEL_MAP[methodKey] || 'Tiền mặt',
        tenPhieu: inv.luot_kham_id
            ? `Viện phí ca khám #${inv.luot_kham_id} - BN ${patientName}`
            : inv.ghi_chu || `Phiếu thu ${inv.ma_hoa_don}`,
        ghiChu: inv.ghi_chu || '',
        items: (inv.cac_khoan_thu || []).map((line) => ({
            id: `LINE-${line.id}`,
            muc_tham_chieu_id: line.muc_tham_chieu_id,
            loai_muc: line.loai_muc,
            tenKhoan: line.ten_khoan_thu,
            soTien: Number(line.thanh_tien),
            ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng',
        })),
        daKhoaSo: false,
    }
}

export function useCashierPageLogic() {
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const currentUser = useSelector((state) => state.app?.auth?.user)

    const defaults = getFormDefaults(clinicData)
    const defaultCashierName =
        currentUser?.fullName ||
        currentUser?.ho_ten ||
        currentUser?.name ||
        defaults.defaultCashier ||
        'Thu ngân phòng khám'

    const khoanThuCatalog = clinicData?.catalogs?.khoanThu || []
    const paymentMethods = [
        { value: 'Tiền mặt', label: 'Tiền mặt' },
        { value: 'Chuyển khoản', label: 'Chuyển khoản QR (SePay / VietQR)' },
        { value: 'Thẻ POS', label: 'Thẻ POS' },
    ]

    const buildEmptyVoucher = useCallback(
        () => ({
            id: '',
            invoiceId: null,
            luotKhamId: null,
            maPhieu: 'HỆ THỐNG TỰ SINH',
            loaiPhieu: 'Phiếu thu',
            tenPhieu: '',
            maBN: '',
            hoTenBN: '',
            ngayThu: new Date().toLocaleString('vi-VN'),
            nguoiThu: defaultCashierName,
            hinhThuc: 'Tiền mặt',
            daThu: false,
            ghiChu: '',
            items: [],
            tongTien: 0,
        }),
        [defaultCashierName]
    )

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeCashierTab, setActiveCashierTab] = useState(
        queryTab && ['THU_CHI', 'KHOA_SO'].includes(queryTab) ? queryTab : 'THU_CHI'
    )
    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [datePreset, setDatePreset] = useState('ALL')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [shiftFilter, setShiftFilter] = useState('ALL')
    const [isQrModalOpen, setIsQrModalOpen] = useState(false)
    const [qrInvoice, setQrInvoice] = useState(null)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [liveUnbilled, setLiveUnbilled] = useState([])
    const [liveInvoices, setLiveInvoices] = useState([])
    const [cashierClosings, setCashierClosings] = useState([])
    const [invoiceViewMode, setInvoiceViewMode] = useState('BY_PATIENT')
    const fetchSeqRef = useRef(0)

    const [form, setForm] = useState(() => buildEmptyVoucher())
    const [newItemName, setNewItemName] = useState(khoanThuCatalog[0]?.ten || 'Thu tiền công khám lâm sàng')
    const [newItemAmount, setNewItemAmount] = useState(khoanThuCatalog[0]?.donGiaMacDinh || 150000)
    const [newItemNote, setNewItemNote] = useState('')

    const handleSelectDatePreset = useCallback((preset) => {
        setDatePreset(preset)
        const range = getDateRangeForPreset(preset)
        setFromDate(range.fromDate)
        setToDate(range.toDate)
    }, [])

    const handleFromDateChange = useCallback(
        (val) => {
            setDatePreset('CUSTOM')
            setFromDate(val)
            if (toDate && val && val > toDate) {
                setToDate(val)
            }
        },
        [toDate]
    )

    const handleToDateChange = useCallback(
        (val) => {
            setDatePreset('CUSTOM')
            setToDate(val)
            if (fromDate && val && val < fromDate) {
                setFromDate(val)
            }
        },
        [fromDate]
    )

    const handleResetFilters = useCallback(() => {
        setSearchText('')
        setStatusFilter('ALL')
        setDatePreset('ALL')
        setFromDate('')
        setToDate('')
        setShiftFilter('ALL')
    }, [])

    const fetchLiveCashierData = useCallback(async () => {
        const reqSeq = ++fetchSeqRef.current
        const [unbilledRes, invoicesRes] = await Promise.allSettled([
            cashierService.getUnbilledEncounters(),
            cashierService.getInvoices({
                tuNgay: fromDate || null,
                denNgay: toDate || null,
                caKham: shiftFilter !== 'ALL' ? shiftFilter : null,
                page: 1,
                pageSize: 200,
            }),
        ])
        if (reqSeq !== fetchSeqRef.current) {
            return { nextUnbilled: null, nextInvoices: null }
        }
        const nextUnbilled = unbilledRes.status === 'fulfilled' ? unbilledRes.value?.items || [] : []
        const nextInvoices = invoicesRes.status === 'fulfilled' ? invoicesRes.value?.items || [] : []
        setLiveUnbilled(nextUnbilled)
        setLiveInvoices(nextInvoices)
        return { nextUnbilled, nextInvoices }
    }, [fromDate, toDate, shiftFilter])

    useEffect(() => {
        fetchLiveCashierData()
    }, [fetchLiveCashierData])

    useEffect(() => {
        if (queryTab && ['THU_CHI', 'KHOA_SO'].includes(queryTab)) {
            setActiveCashierTab(queryTab)
        }
    }, [queryTab])

    const allVouchers = useMemo(
        () => liveInvoices.map((inv) => mapInvoiceToVoucher(inv, defaultCashierName)),
        [liveInvoices, defaultCashierName]
    )

    useEffect(() => {
        if (allVouchers.length === 0) return
        setForm((prev) => {
            if (prev?.invoiceId) {
                const refreshed = allVouchers.find((v) => String(v.invoiceId) === String(prev.invoiceId))
                return refreshed || prev
            }
            if (prev?.luotKhamId) return prev
            const firstUnpaid = allVouchers.find((v) => !v.daThu)
            return firstUnpaid || allVouchers[0]
        })
    }, [allVouchers])

    const patients = useMemo(() => {
        const byCode = new Map()
        allVouchers.forEach((v) => {
            if (v.maBN && !byCode.has(v.maBN)) {
                byCode.set(v.maBN, { id: v.maBN, maBN: v.maBN, hoTen: v.hoTenBN })
            }
        })
        liveUnbilled.forEach((u) => {
            const code = u.benh_nhan?.mabn
            if (code && !byCode.has(code)) {
                byCode.set(code, { id: code, maBN: code, hoTen: u.benh_nhan?.ho_ten || 'Bệnh nhân' })
            }
        })
        return Array.from(byCode.values())
    }, [allVouchers, liveUnbilled])

    const pendingBillRegistrations = useMemo(() => [], [])

    const filteredVouchers = useMemo(() => {
        return allVouchers.filter((voucher) => {
            const matchText =
                !searchText ||
                voucher.maPhieu?.toLowerCase().includes(searchText.toLowerCase()) ||
                voucher.maBN?.toLowerCase().includes(searchText.toLowerCase()) ||
                voucher.hoTenBN?.toLowerCase().includes(searchText.toLowerCase()) ||
                voucher.tenPhieu?.toLowerCase().includes(searchText.toLowerCase())
            const matchStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'PAID' && voucher.daThu) ||
                (statusFilter === 'PENDING' && !voucher.daThu)
            const matchDateAndShift = matchesVoucherDateAndShift(voucher, {
                fromDate,
                toDate,
                shiftFilter,
            })
            return matchText && matchStatus && matchDateAndShift
        })
    }, [allVouchers, searchText, statusFilter, fromDate, toDate, shiftFilter])

    const groupedPatients = useMemo(() => groupVouchersByPatient(filteredVouchers), [filteredVouchers])

    const [expandedPatients, setExpandedPatients] = useState(() => new Set())

    useEffect(() => {
        if (!form?.maBN && !form?.hoTenBN) return
        const key = (form.maBN ? form.maBN.trim() : '') || (form.hoTenBN ? form.hoTenBN.trim().toLowerCase() : '')
        if (key) {
            setExpandedPatients((prev) => new Set([...prev, key]))
        }
    }, [form?.id, form?.maBN, form?.hoTenBN])

    useEffect(() => {
        if (searchText.trim()) {
            setExpandedPatients(new Set(groupedPatients.map((group) => group.key)))
        }
    }, [searchText, groupedPatients])

    const togglePatient = (key) => {
        setExpandedPatients((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const isAllExpanded = groupedPatients.length > 0 && groupedPatients.every((group) => expandedPatients.has(group.key))

    const toggleExpandAll = () => {
        if (isAllExpanded) setExpandedPatients(new Set())
        else setExpandedPatients(new Set(groupedPatients.map((group) => group.key)))
    }

    const totalThu = filteredVouchers
        .filter((voucher) => voucher.daThu)
        .reduce((sum, voucher) => sum + (Number(voucher.tongTien) || 0), 0)

    const paidCount = filteredVouchers.filter((voucher) => voucher.daThu).length

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
                    ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng',
                }))
                setForm({
                    ...buildEmptyVoucher(),
                    id: null,
                    invoiceId: null,
                    luotKhamId: enc.luot_kham_id,
                    maPhieu: 'DỰ KIẾN LẬP HÓA ĐƠN',
                    maKCB: preview.ma_kcb || enc.ma_kcb,
                    maBN: preview.benh_nhan?.mabn || enc.benh_nhan?.mabn || '',
                    hoTenBN: preview.benh_nhan?.ho_ten || enc.benh_nhan?.ho_ten || '',
                    tenPhieu: `Thu viện phí BN ${preview.benh_nhan?.ho_ten || enc.benh_nhan?.ho_ten || ''} (Mã KCB: ${preview.ma_kcb || enc.ma_kcb})`,
                    items: autoItems,
                    tongTien: Number(preview.thuc_thu_du_kien ?? preview.tong_tien ?? 0),
                    daThu: true,
                    hinhThuc: 'Tiền mặt',
                })
                if (preview.canh_bao_gia) {
                    AppToast.warning(preview.canh_bao_gia)
                } else {
                    AppToast.info(`Xem trước chi phí ca khám ${enc.ma_kcb}. Bấm "Lưu phiếu" để lập và thu tiền!`)
                }
            }
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Không thể xem trước hóa đơn')
        }
    }

    const handleSelectPatientAutoFill = (maBN, specificKCB) => {
        if (!maBN && !specificKCB) return
        const matchedUnbilled = liveUnbilled.find(
            (item) => (specificKCB && item.ma_kcb === specificKCB) || (maBN && item.benh_nhan?.mabn === maBN)
        )
        if (matchedUnbilled) {
            handleSelectUnbilledEncounter(matchedUnbilled)
            return
        }
        const matchedVoucher = allVouchers.find(
            (v) => !v.daThu && ((specificKCB && v.maKCB === specificKCB) || (maBN && v.maBN === maBN))
        ) || allVouchers.find((v) => (specificKCB && v.maKCB === specificKCB) || (maBN && v.maBN === maBN))

        if (matchedVoucher) {
            setForm({ ...matchedVoucher })
            AppToast.info(`Đã nạp hóa đơn ${matchedVoucher.maPhieu} của BN ${matchedVoucher.hoTenBN}`)
        }
    }

    const handleOpenQr = async (voucher) => {
        const target = voucher || form
        if (!target.invoiceId && target.luotKhamId) {
            try {
                const congKhamItem = (target.items || []).some((item) => item.loai_muc === 'cong_kham')
                const clsItemIds = (target.items || [])
                    .filter((item) => item.loai_muc === 'can_lam_sang' && item.muc_tham_chieu_id)
                    .map((item) => item.muc_tham_chieu_id)
                const created = await cashierService.createInvoice({
                    luot_kham_id: target.luotKhamId,
                    mien_giam: 0,
                    include_cong_kham: congKhamItem,
                    chi_dinh_ids: clsItemIds,
                })
                const actualAmount = Number(created.thuc_thu ?? created.tong_tien ?? target.tongTien ?? 0)
                const updatedTarget = {
                    ...target,
                    id: created.id,
                    invoiceId: created.id,
                    maPhieu: created.ma_hoa_don,
                    tongTien: actualAmount,
                    thuc_thu: actualAmount,
                }
                setForm(updatedTarget)
                setQrInvoice(updatedTarget)
                setIsQrModalOpen(true)
                await fetchLiveCashierData()
                return
            } catch (err) {
                AppToast.error(err?.response?.data?.message || err?.message || 'Không thể lập hóa đơn để tạo mã VietQR')
                return
            }
        }
        if (!target.invoiceId && !target.isCombined) {
            AppToast.warning('Vui lòng chọn một hóa đơn từ danh sách trước khi mở mã QR!')
            return
        }
        setQrInvoice(target)
        setIsQrModalOpen(true)
    }

    const handleSelectVoucher = async (voucher) => {
        setForm({ ...voucher })
        if (voucher.invoiceId && (!voucher.items || voucher.items.length === 0)) {
            try {
                const detail = await cashierService.getInvoiceDetail(voucher.invoiceId)
                if (detail?.chi_tiet_hoa_don) {
                    const lines = detail.chi_tiet_hoa_don.map((line) => ({
                        id: `LINE-${line.id}`,
                        muc_tham_chieu_id: line.muc_tham_chieu_id,
                        loai_muc: line.loai_muc,
                        tenKhoan: line.ten_khoan_thu,
                        soTien: Number(line.thanh_tien),
                        ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng',
                    }))
                    setForm((prev) => ({ ...prev, items: lines }))
                }
            } catch {}
        }
    }

    const handleSelectPatientCombined = async (group) => {
        let combinedItems = []
        let total = 0
        const unpaidVouchers = group.vouchers.filter((voucher) => !voucher.daThu)
        const targetList = unpaidVouchers.length > 0 ? unpaidVouchers : group.vouchers

        for (const voucher of targetList) {
            let lines = voucher.items || []
            if (voucher.invoiceId && lines.length === 0) {
                try {
                    const detail = await cashierService.getInvoiceDetail(voucher.invoiceId)
                    if (detail?.chi_tiet_hoa_don) {
                        lines = detail.chi_tiet_hoa_don.map((line) => ({
                            id: `LINE-${line.id}`,
                            tenKhoan: line.ten_khoan_thu,
                            soTien: Number(line.thanh_tien),
                            ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng',
                        }))
                    }
                } catch {}
            }
            combinedItems = [...combinedItems, ...lines]
            total += Number(voucher.tongTien || 0)
        }

        setForm({
            id: `GOP-${group.key}`,
            isCombined: true,
            combinedVoucherIds: targetList.map((voucher) => voucher.id),
            combinedInvoiceIds: targetList.map((voucher) => voucher.invoiceId || voucher.id).filter(Boolean),
            maPhieu: targetList.length === 1 ? targetList[0].maPhieu : `GOP-${group.maBN || 'BN'}-${targetList.length}HD`,
            maBN: group.maBN,
            hoTenBN: group.hoTenBN,
            soDienThoai: group.soDienThoai,
            tenPhieu: `Thu gộp toàn bộ dịch vụ BN ${group.hoTenBN} (${targetList.length} phiếu)`,
            items: combinedItems,
            tongTien: total,
            daThu: targetList.every((voucher) => voucher.daThu),
            hinhThuc: 'Tiền mặt',
            nguoiThu: defaultCashierName,
            ngayThu: new Date().toLocaleString('vi-VN'),
            ghiChu: `Gom thanh toán ${targetList.length} hóa đơn cho bệnh nhân ${group.hoTenBN}`,
        })
    }

    const handlePayAllForPatient = async (group) => {
        const unpaidVouchers = group.vouchers.filter((voucher) => !voucher.daThu)
        if (unpaidVouchers.length === 0) {
            AppToast.info(`Tất cả hóa đơn của BN ${group.hoTenBN} đều đã được thu tiền!`)
            return
        }
        const selectedMethod = METHOD_API_MAP[form?.hinhThuc] || 'tien_mat'
        try {
            for (const voucher of unpaidVouchers) {
                const targetRef = voucher.invoiceId || voucher.id
                if (!targetRef) continue
                await cashierService.payInvoice(targetRef, {
                    phuong_thuc_thanh_toan: selectedMethod,
                    so_tien_khach_tra: Number(voucher.tongTien || 0),
                    ghi_chu: `Thu gộp tất cả viện phí BN ${group.hoTenBN}`,
                })
            }
            await fetchLiveCashierData()
            AppToast.success(`Đã thu toàn bộ ${group.totalAmount.toLocaleString('vi-VN')} đ cho BN ${group.hoTenBN} thành công!`)
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Không thể thu gộp hóa đơn!')
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
        const nextTotal = nextItems.reduce((sum, item) => sum + (Number(item.soTien) || 0), 0)
        setForm({ ...form, items: nextItems, tongTien: nextTotal })
        setNewItemNote('')
    }

    const handleRemoveLineItem = (itemId) => {
        const nextItems = (form.items || []).filter((item) => item.id !== itemId)
        const nextTotal = nextItems.reduce((sum, item) => sum + (Number(item.soTien) || 0), 0)
        setForm({ ...form, items: nextItems, tongTien: nextTotal })
    }

    const handleSaveVoucher = async () => {
        const selectedMethod = METHOD_API_MAP[form.hinhThuc] || 'tien_mat'

        if (form.isCombined && Array.isArray(form.combinedInvoiceIds)) {
            if (!form.daThu) {
                AppToast.warning('Vui lòng tích chọn "Đã thu tiền" trước khi xác nhận thu gộp!')
                return
            }
            try {
                for (const ref of form.combinedInvoiceIds) {
                    const matched = allVouchers.find((v) => String(v.invoiceId) === String(ref) || String(v.id) === String(ref))
                    if (matched?.daThu) continue
                    await cashierService.payInvoice(ref, {
                        phuong_thuc_thanh_toan: selectedMethod,
                        so_tien_khach_tra: Number(matched?.tongTien || form.tongTien || 0),
                        ghi_chu: form.ghiChu || 'Thu gộp viện phí',
                    })
                }
                await fetchLiveCashierData()
                setForm((prev) => ({ ...prev, daThu: true }))
                AppToast.success(`Đã thanh toán thu gộp cho BN ${form.hoTenBN} thành công!`)
            } catch (err) {
                AppToast.error(err?.response?.data?.message || err?.message || 'Thu gộp viện phí thất bại!')
            }
            return
        }

        let activeInvoiceId = form.invoiceId

        if (!activeInvoiceId && form.luotKhamId) {
            try {
                const congKhamItem = (form.items || []).some((item) => item.loai_muc === 'cong_kham')
                const clsItemIds = (form.items || [])
                    .filter((item) => item.loai_muc === 'can_lam_sang' && item.muc_tham_chieu_id)
                    .map((item) => item.muc_tham_chieu_id)
                const created = await cashierService.createInvoice({
                    luot_kham_id: form.luotKhamId,
                    mien_giam: 0,
                    include_cong_kham: congKhamItem,
                    chi_dinh_ids: clsItemIds,
                    ghi_chu: form.ghiChu || form.tenPhieu || null,
                })
                activeInvoiceId = created.id
            } catch (err) {
                AppToast.error(err?.response?.data?.message || err?.message || 'Không thể lập hóa đơn viện phí!')
                return
            }
        }

        if (!activeInvoiceId) {
            AppToast.warning('Vui lòng chọn ca khám chờ lập hóa đơn hoặc chọn hóa đơn có sẵn ở danh sách bên trái!')
            return
        }

        const existingVoucher = allVouchers.find((v) => String(v.invoiceId) === String(activeInvoiceId))
        const calculatedTotal =
            (form.items || []).length > 0
                ? (form.items || []).reduce((sum, item) => sum + (Number(item.soTien) || 0), 0)
                : Number(form.tongTien || 0)

        if (form.daThu && !existingVoucher?.daThu) {
            try {
                const paid = await cashierService.payInvoice(activeInvoiceId, {
                    phuong_thuc_thanh_toan: selectedMethod,
                    so_tien_khach_tra: calculatedTotal,
                    ghi_chu: form.ghiChu || form.tenPhieu || 'Thanh toán tại quầy',
                })
                const { nextInvoices } = await fetchLiveCashierData()
                const refreshed = (nextInvoices || []).find((inv) => String(inv.id) === String(paid?.id || activeInvoiceId))
                if (refreshed) {
                    setForm(mapInvoiceToVoucher(refreshed, defaultCashierName))
                } else {
                    setForm((prev) => ({ ...prev, invoiceId: activeInvoiceId, daThu: true }))
                }
                AppToast.success('Đã thu viện phí và lưu biên lai thành công!')
            } catch (err) {
                AppToast.error(err?.response?.data?.message || err?.message || 'Thanh toán viện phí thất bại!')
            }
            return
        }

        const { nextInvoices } = await fetchLiveCashierData()
        const refreshed = (nextInvoices || []).find((inv) => String(inv.id) === String(activeInvoiceId))
        if (refreshed) {
            setForm(mapInvoiceToVoucher(refreshed, defaultCashierName))
        }
        AppToast.success(existingVoucher?.daThu ? 'Hóa đơn này đã được thanh toán!' : 'Đã lưu hóa đơn chờ thu viện phí!')
    }

    const handleDeleteVoucher = async () => {
        if (!form.invoiceId) {
            setForm(buildEmptyVoucher())
            return
        }
        try {
            await cashierService.cancelInvoice(form.invoiceId, 'Thu ngân hủy hóa đơn chưa thu tại quầy')
            await fetchLiveCashierData()
            setForm(buildEmptyVoucher())
            AppToast.info('Đã hủy hóa đơn viện phí thành công!')
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Không thể hủy hóa đơn này!')
        }
    }

    const handleDailyClosing = async () => {
        try {
            const res = await cashierService.closeShift({
                ghi_chu: 'Khóa sổ ca thu ngân trực tiếp tại quầy',
            })
            const newClosing = {
                id: res?.khoa_so_id || `KS-${Date.now()}`,
                maKyKhoaSo: res?.ma_khoa_so || `KS-${Date.now()}`,
                ngayKhoaSo: res?.thoi_gian_dong_so
                    ? new Date(res.thoi_gian_dong_so).toLocaleString('vi-VN')
                    : new Date().toLocaleString('vi-VN'),
                nguoiKhoaSo: res?.tong_ket?.ten_thu_ngan || defaultCashierName,
                tongThuDichVu: Number(res?.tong_ket?.tong_doanh_thu || 0),
                tongChi: 0,
                tonQuyCuoiNgay: Number(res?.tien_mat_thuc_te ?? res?.tong_ket?.tong_doanh_thu ?? 0),
                cheDo: 'Chốt ca trực tiếp',
                trangThai: 'Đã khóa sổ (Hợp lệ)',
            }
            setCashierClosings((prev) => [newClosing, ...prev])
            await fetchLiveCashierData()
            AppToast.success(
                `Đã khóa sổ ca thành công! Mã khóa sổ: ${newClosing.maKyKhoaSo} — Doanh thu: ${newClosing.tongThuDichVu.toLocaleString('vi-VN')} đ`
            )
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Không thể khóa sổ ca trực!')
        }
    }

    const handleConfirmQrPayment = async (inv) => {
        if (inv?.isCombined || form?.isCombined) {
            const targetInvoices = inv?.combinedInvoiceIds || form?.combinedInvoiceIds || []
            for (const ref of targetInvoices) {
                const matched = allVouchers.find((v) => String(v.invoiceId) === String(ref) || String(v.id) === String(ref))
                if (matched?.daThu) continue
                await cashierService.payInvoice(ref, {
                    phuong_thuc_thanh_toan: 'chuyen_khoan',
                    so_tien_khach_tra: Number(matched?.tongTien || 0),
                    ghi_chu: 'Thanh toán qua quét mã VietQR gộp',
                })
            }
            await fetchLiveCashierData()
            setForm((prev) => ({ ...prev, daThu: true, hinhThuc: 'Chuyển khoản' }))
            setIsQrModalOpen(false)
            AppToast.success('Đã xác nhận thanh toán chuyển khoản VietQR gộp thành công!')
            return
        }

        const targetRef = inv?.invoiceId || inv?.id || form?.invoiceId || form?.id
        if (!targetRef) return
        const rawTargetAmount = inv?.thuc_thu ?? inv?.thucThu ?? inv?.tong_tien ?? inv?.tongTien ?? form.tongTien ?? 0
        const targetAmount = Math.max(0, Number(rawTargetAmount || 0))
        const paid = await cashierService.payInvoice(targetRef, {
            phuong_thuc_thanh_toan: 'chuyen_khoan',
            so_tien_khach_tra: targetAmount,
            ghi_chu: inv?.tenPhieu || form?.tenPhieu || 'Thanh toán qua quét mã VietQR',
        })
        const { nextInvoices } = await fetchLiveCashierData()
        const refreshed = (nextInvoices || []).find((item) => String(item.id) === String(paid?.id || targetRef))
        if (refreshed) {
            setForm(mapInvoiceToVoucher(refreshed, defaultCashierName))
        } else {
            setForm((prev) => ({ ...prev, daThu: true, hinhThuc: 'Chuyển khoản' }))
        }
        setIsQrModalOpen(false)
        AppToast.success('Đã xác nhận thanh toán chuyển khoản VietQR thành công!')
    }

    return {
        clinicData,
        patients,
        khoanThuCatalog,
        paymentMethods,
        activeCashierTab,
        setActiveCashierTab,
        cashierClosings,
        handleDailyClosing,
        allVouchers,
        filteredVouchers,
        totalThu,
        paidCount,
        searchText,
        setSearchText,
        statusFilter,
        setStatusFilter,
        datePreset,
        fromDate,
        toDate,
        shiftFilter,
        setShiftFilter,
        handleSelectDatePreset,
        handleFromDateChange,
        handleToDateChange,
        handleResetFilters,
        invoiceViewMode,
        setInvoiceViewMode,
        liveUnbilled,
        pendingBillRegistrations,
        handleSelectUnbilledEncounter,
        handleSelectPatientAutoFill,
        groupedPatients,
        expandedPatients,
        togglePatient,
        toggleExpandAll,
        isAllExpanded,
        form,
        setForm,
        buildEmptyVoucher,
        handleSelectVoucher,
        handleSelectPatientCombined,
        handlePayAllForPatient,
        handleOpenQr,
        isQrModalOpen,
        setIsQrModalOpen,
        qrInvoice,
        isReceiptModalOpen,
        setIsReceiptModalOpen,
        newItemName,
        setNewItemName,
        newItemAmount,
        setNewItemAmount,
        newItemNote,
        setNewItemNote,
        handleAddLineItem,
        handleRemoveLineItem,
        handleSaveVoucher,
        handleDeleteVoucher,
        handleConfirmQrPayment,
    }
}
