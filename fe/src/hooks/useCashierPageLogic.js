import { useState, useMemo, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { updateClinicCollectionAsync } from '../redux/actions/admin/adminAction'
import { AppToast } from '../components/common/AppNotification'
import { getMasterOptions, getFormDefaults } from '../utils/helpers/clinicConfigHelpers'
import { cashierService } from '../services/cashierService'
import {
    areVouchersMatching,
    mergeVoucherData,
    deduplicateVouchers,
    groupVouchersByPatient,
} from '../utils/helpers/cashierInvoiceHelpers'

const getNextVoucherCode = (list) => {
    let max = 0
    ;(list || []).forEach((voucher) => {
        const match = String(voucher.maPhieu || voucher.id || '').match(/(\d+)/)
        if (match) {
            const num = parseInt(match[1], 10)
            if (num > max) max = num
        }
    })
    return 'PT' + String(max + 1).padStart(8, '0')
}

export function useCashierPageLogic() {
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
        return deduplicateVouchers(list.filter((voucher) => voucher.loaiPhieu !== 'Phiếu chi'))
    }, [clinicData])

    const patients = clinicData?.patients || []
    const registrations = clinicData?.registrations || []
    const khoanThuCatalog = clinicData?.catalogs?.khoanThu || []
    const cashierClosings = clinicData?.cashierClosings || []

    const pendingBillRegistrations = useMemo(() => {
        return (registrations || []).filter((reg) => {
            const hasServices = Array.isArray(reg.services) && reg.services.length > 0
            const isPaid = vouchers.some(
                (voucher) =>
                    (voucher.maKCB === reg.maKCB || (voucher.maBN === reg.maBN && voucher.items?.length > 0)) &&
                    voucher.daThu
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

    const [activeCashierTab, setActiveCashierTab] = useState(
        queryTab && ['THU_CHI', 'KHOA_SO'].includes(queryTab) ? queryTab : 'THU_CHI'
    )
    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [isQrModalOpen, setIsQrModalOpen] = useState(false)
    const [qrInvoice, setQrInvoice] = useState(null)
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
    const [liveUnbilled, setLiveUnbilled] = useState([])
    const [livePendingBills, setLivePendingBills] = useState([])
    const [invoiceViewMode, setInvoiceViewMode] = useState('BY_PATIENT')

    const [form, setForm] = useState(() => vouchers[0] || buildEmptyVoucher())
    const [newItemName, setNewItemName] = useState(khoanThuCatalog[0]?.ten || 'Thu tiền công khám lâm sàng')
    const [newItemAmount, setNewItemAmount] = useState(khoanThuCatalog[0]?.donGiaMacDinh || 120000)
    const [newItemNote, setNewItemNote] = useState('')

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
        } catch {}
    }

    useEffect(() => {
        fetchLiveCashierData()
    }, [])

    useEffect(() => {
        if (queryTab && ['THU_CHI', 'KHOA_SO'].includes(queryTab)) {
            setActiveCashierTab(queryTab)
        }
    }, [queryTab])

    const allVouchers = useMemo(() => {
        const liveItems = (livePendingBills || []).map((pendingBill) => ({
            id: pendingBill.id,
            invoiceId: pendingBill.id,
            luotKhamId: pendingBill.luot_kham_id,
            maPhieu: pendingBill.ma_hoa_don,
            maKCB: `KCB-${pendingBill.luot_kham_id}`,
            maBN: pendingBill.benh_nhan?.mabn || '',
            hoTenBN: pendingBill.benh_nhan?.ho_ten || 'Chưa rõ',
            soDienThoai: pendingBill.benh_nhan?.so_dien_thoai || '',
            tongTien: Number(pendingBill.thuc_thu || pendingBill.tong_tien || 0),
            daThu: false,
            ngayThu: pendingBill.thoi_gian_tao ? new Date(pendingBill.thoi_gian_tao).toLocaleString('vi-VN') : '',
            hinhThuc: 'Tiền mặt',
            tenPhieu: `Viện phí ca khám #${pendingBill.luot_kham_id}`,
            items: (pendingBill.cac_khoan_thu || []).map((line) => ({
                id: `LINE-${line.id}`,
                muc_tham_chieu_id: line.muc_tham_chieu_id,
                loai_muc: line.loai_muc,
                tenKhoan: line.ten_khoan_thu,
                soTien: Number(line.thanh_tien),
                ghiChu: line.loai_muc === 'cong_kham' ? 'Công khám' : 'Cận lâm sàng',
            })),
            daKhoaSo: false,
        }))
        return deduplicateVouchers([...liveItems, ...vouchers])
    }, [vouchers, livePendingBills])

    const filteredVouchers = useMemo(() => {
        return allVouchers.filter((voucher) => {
            const matchText =
                !searchText ||
                voucher.maPhieu?.toLowerCase().includes(searchText.toLowerCase()) ||
                voucher.hoTenBN?.toLowerCase().includes(searchText.toLowerCase()) ||
                voucher.tenPhieu?.toLowerCase().includes(searchText.toLowerCase())
            const matchStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'PAID' && voucher.daThu) ||
                (statusFilter === 'PENDING' && !voucher.daThu)
            return matchText && matchStatus
        })
    }, [allVouchers, searchText, statusFilter])

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
            setExpandedPatients(new Set(groupedPatients.map((group) => group.key)))
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

    const isAllExpanded = groupedPatients.length > 0 && groupedPatients.every((group) => expandedPatients.has(group.key))

    const toggleExpandAll = () => {
        if (isAllExpanded) {
            setExpandedPatients(new Set())
        } else {
            setExpandedPatients(new Set(groupedPatients.map((group) => group.key)))
        }
    }

    const totalThu = allVouchers
        .filter((voucher) => voucher.daThu)
        .reduce((sum, voucher) => sum + (Number(voucher.tongTien) || 0), 0)

    const paidCount = allVouchers.filter((voucher) => voucher.daThu).length

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
                    hinhThuc: 'Tiền mặt',
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

    const handleSelectPatientAutoFill = (maBN, specificKCB) => {
        if (!maBN && !specificKCB) return
        const matchedUnbilled = liveUnbilled.find(
            (item) => (specificKCB && item.ma_kcb === specificKCB) || (maBN && item.benh_nhan?.mabn === maBN)
        )
        if (matchedUnbilled) {
            handleSelectUnbilledEncounter(matchedUnbilled)
            return
        }
        const matchedPending = livePendingBills.find(
            (pendingBill) =>
                (specificKCB && `KCB-${pendingBill.luot_kham_id}` === specificKCB) ||
                (maBN && pendingBill.benh_nhan?.mabn === maBN)
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
                : reg?.services?.map((serv, idx) => ({
                      id: `VI-AUTO-${idx + 1}`,
                      muc_tham_chieu_id: serv.id || serv.chiDinhId || null,
                      loai_muc: serv.loai_muc || 'can_lam_sang',
                      tenKhoan: serv.tenDV,
                      soTien: Number(serv.thanhTien) || Number(serv.donGia) || 0,
                      ghiChu: serv.phongTH,
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
                        tongTien: Number(existingBill.thuc_thu ?? existingBill.tong_tien ?? target.tongTien ?? 0),
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

    const handleSelectVoucher = async (voucher) => {
        setForm({ ...voucher })
        if (voucher.invoiceId && (!voucher.items || voucher.items.length === 0)) {
            try {
                const detail = await cashierService.getInvoiceDetail(voucher.invoiceId)
                if (detail?.chi_tiet_hoa_don) {
                    const lines = detail.chi_tiet_hoa_don.map((line) => ({
                        id: `LINE-${line.id}`,
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
            if (voucher.invoiceId && (!lines || lines.length === 0)) {
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
            if (lines.length > 0) {
                combinedItems = [...combinedItems, ...lines]
            } else {
                combinedItems.push({
                    id: `LINE-${voucher.id || voucher.maPhieu}`,
                    tenKhoan: voucher.tenPhieu || 'Khoản thu dịch vụ',
                    soTien: Number(voucher.tongTien || 0),
                    ghiChu: 'Viện phí',
                })
            }
            total += Number(voucher.tongTien || 0)
        }

        const combinedVoucher = {
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
            nguoiThu: defaults.defaultCashier || 'Trần Thu Ngân',
            ngayThu: new Date().toISOString().replace('T', ' ').slice(0, 16),
            ghiChu: `Gom thanh toán ${targetList.length} hóa đơn cho bệnh nhân ${group.hoTenBN}`,
        }
        setForm(combinedVoucher)
    }

    const handlePayAllForPatient = async (group) => {
        const unpaidVouchers = group.vouchers.filter((voucher) => !voucher.daThu)
        if (unpaidVouchers.length === 0) {
            AppToast.info(`Tất cả hóa đơn của BN ${group.hoTenBN} đều đã được thu tiền`)
            return
        }
        const methodMap = {
            'Tiền mặt': 'tien_mat',
            'Chuyển khoản': 'chuyen_khoan',
            'Thẻ POS': 'the_pos',
        }
        const selectedMethod = methodMap[form?.hinhThuc] || 'tien_mat'

        for (const voucher of unpaidVouchers) {
            const targetRef = voucher.invoiceId || voucher.id || voucher.maPhieu
            if (targetRef) {
                try {
                    await cashierService.payInvoice(targetRef, {
                        phuong_thuc_thanh_toan: selectedMethod,
                        so_tien_khach_tra: Number(voucher.tongTien || 0),
                        ghi_chu: `Thu gộp tất cả viện phí BN ${group.hoTenBN}`,
                    })
                } catch {}
            }
        }

        const targetIds = new Set(unpaidVouchers.map((voucher) => String(voucher.id)))
        const targetCodes = new Set(unpaidVouchers.map((voucher) => voucher.maPhieu))
        const updated = vouchers.map((voucher) => {
            if (targetIds.has(String(voucher.id)) || targetCodes.has(voucher.maPhieu)) {
                return { ...voucher, daThu: true, hinhThuc: form?.hinhThuc || 'Tiền mặt' }
            }
            return voucher
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

    const handleAddLineItem = () => {
        const amount = Number(newItemAmount) || 0
        if (!newItemName.trim() || amount <= 0) {
            AppToast.warning('Vui lòng nhập tên khoản thu và số tiền hợp lệ')
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
        if (!form.tenPhieu?.trim()) {
            AppToast.error('Vui lòng nhập Tên phiếu thu viện phí')
            return
        }

        if (form.isCombined && Array.isArray(form.combinedInvoiceIds)) {
            const methodMap = {
                'Tiền mặt': 'tien_mat',
                'Chuyển khoản': 'chuyen_khoan',
                'Thẻ POS': 'the_pos',
            }
            if (form.daThu) {
                for (const ref of form.combinedInvoiceIds) {
                    try {
                        await cashierService.payInvoice(ref, {
                            phuong_thuc_thanh_toan: methodMap[form.hinhThuc] || 'tien_mat',
                            so_tien_khach_tra: 0,
                            ghi_chu: form.ghiChu || 'Thu gộp viện phí',
                        })
                    } catch {}
                }
            }
            const targetIds = new Set((form.combinedVoucherIds || []).map(String))
            const updatedVouchers = vouchers.map((voucher) => {
                if (
                    targetIds.has(String(voucher.id)) ||
                    (form.combinedInvoiceIds || []).includes(voucher.invoiceId) ||
                    (form.combinedInvoiceIds || []).includes(voucher.id)
                ) {
                    return { ...voucher, daThu: Boolean(form.daThu), hinhThuc: form.hinhThuc }
                }
                return voucher
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
            AppToast.success(`Đã cập nhật thu gộp cho BN ${form.hoTenBN}`)
            await fetchLiveCashierData()
            setForm((prev) => ({ ...prev, daThu: Boolean(form.daThu) }))
            return
        }

        let activeInvoiceId = form.invoiceId
        let activeMaPhieu = form.maPhieu
        let activeId = form.id

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
                })
                activeInvoiceId = created.id
                activeMaPhieu = created.ma_hoa_don
                activeId = created.id
                setForm((prev) => ({
                    ...prev,
                    id: created.id,
                    invoiceId: created.id,
                    maPhieu: created.ma_hoa_don,
                }))
                fetchLiveCashierData()
            } catch (err) {
                AppToast.error(err?.response?.data?.message || err?.message || 'Không thể lập hóa đơn viện phí')
                return
            }
        }

        const calculatedTotal =
            (form.items || []).length > 0
                ? (form.items || []).reduce((sum, item) => sum + (Number(item.soTien) || 0), 0)
                : Number(form.tongTien || 0)

        const targetRef = activeInvoiceId || activeMaPhieu || form.id
        if (targetRef && form.daThu) {
            try {
                const methodMap = {
                    'Tiền mặt': 'tien_mat',
                    'Chuyển khoản': 'chuyen_khoan',
                    'Thẻ POS': 'the_pos',
                }
                const paid = await cashierService.payInvoice(targetRef, {
                    phuong_thuc_thanh_toan: methodMap[form.hinhThuc] || 'tien_mat',
                    so_tien_khach_tra: calculatedTotal,
                    ghi_chu: form.ghiChu || form.tenPhieu || 'Thanh toán tại quầy',
                })
                if (paid?.id) {
                    activeInvoiceId = paid.id
                }
                fetchLiveCashierData()
            } catch (err) {
                if (!err?.response) {
                    AppToast.error(err?.message || 'Thanh toán viện phí thất bại')
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
            tongTien: calculatedTotal,
        }

        const cleanedSource = vouchers.filter(
            (voucher) =>
                !(voucher?.maPhieu === 'DỰ KIẾN LẬP HÓA ĐƠN' && payload.luotKhamId && voucher.luotKhamId === payload.luotKhamId)
        )
        const matchIdx = cleanedSource.findIndex((voucher) => areVouchersMatching(voucher, payload))
        let updated
        if (matchIdx >= 0) {
            updated = [...cleanedSource]
            updated[matchIdx] = mergeVoucherData(updated[matchIdx], payload)
            setForm(updated[matchIdx])
        } else {
            const newVoucher = {
                ...payload,
                id: payload.id || payload.maPhieu || `PT-${Date.now().toString().slice(-5)}`,
            }
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
        AppToast.success(matchIdx >= 0 ? 'Đã cập nhật phiếu thu viện phí' : 'Đã lập phiếu thu viện phí mới thành công')
    }

    const handleDeleteVoucher = async () => {
        if (!form.id && !form.maPhieu) return
        const updated = deduplicateVouchers(vouchers.filter((voucher) => !areVouchersMatching(voucher, form)))
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
        AppToast.info('Đã xóa phiếu thu viện phí')
    }

    const handleDailyClosing = async () => {
        const now = new Date()
        const totalThuClosing = vouchers
            .filter((voucher) => voucher.daThu)
            .reduce((sum, voucher) => sum + (Number(voucher.tongTien) || 0), 0)

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
            tongThuDichVu: totalThuClosing,
            tongChi: 0,
            tonQuyCuoiNgay: totalThuClosing,
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
                    doiTuong: newClosing.maKyKhoaSo + ' - Doanh thu: ' + totalThuClosing.toLocaleString('vi-VN') + ' đ',
                    mucDich: 'Khóa sổ ca thu ngân viện phí',
                },
            })
        )
        AppToast.success(
            'Đã khóa sổ ca thành công. Tổng doanh thu thu được: ' + totalThuClosing.toLocaleString('vi-VN') + ' đ'
        )
    }

    const handleConfirmQrPayment = async (inv) => {
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
                        ghi_chu: 'Thanh toán qua quét mã VietQR gộp',
                    })
                } catch {}
            }
            const targetVoucherIds = new Set((inv?.combinedVoucherIds || form?.combinedVoucherIds || []).map(String))
            const nextVouchers = vouchers.map((voucher) => {
                if (
                    targetVoucherIds.has(String(voucher.id)) ||
                    targetInvoices.includes(voucher.invoiceId) ||
                    targetInvoices.includes(voucher.id)
                ) {
                    return { ...voucher, daThu: true, hinhThuc: 'Chuyển khoản' }
                }
                return voucher
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
            ghi_chu: inv?.tenPhieu || form?.tenPhieu || 'Thanh toán qua quét mã VietQR',
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
        const matchIdx = vouchers.findIndex((voucher) => areVouchersMatching(voucher, updatedVoucher))
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
