import { useCashierPageLogic } from '../../hooks/useCashierPageLogic'
import CashierStatsHeader from '../../components/cashier/CashierStatsHeader'
import CashierClosingTab from '../../components/cashier/CashierClosingTab'
import UnbilledEncounterList from '../../components/cashier/UnbilledEncounterList'
import PatientVoucherGroups from '../../components/cashier/PatientVoucherGroups'
import AllVouchersTable from '../../components/cashier/AllVouchersTable'
import VoucherEditorForm from '../../components/cashier/VoucherEditorForm'
import VietQrModal from '../../components/common/VietQrModal'
import ReceiptModal from '../../components/common/ReceiptModal'
import {
    Receipt,
    Plus,
    MagnifyingGlass,
    Funnel,
} from '../../components/common/ClinicIcon'

export default function CashierManagementPage() {
    const {
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
    } = useCashierPageLogic()

    return (
        <div className="space-y-3.5">
            <CashierStatsHeader
                activeCashierTab={activeCashierTab}
                setActiveCashierTab={setActiveCashierTab}
                allVouchersCount={allVouchers.length}
                cashierClosingsCount={cashierClosings.length}
                onDailyClosing={handleDailyClosing}
            />

            {activeCashierTab === 'KHOA_SO' ? (
                <CashierClosingTab cashierClosings={cashierClosings} />
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

                        <UnbilledEncounterList
                            liveUnbilled={liveUnbilled}
                            pendingBillRegistrations={pendingBillRegistrations}
                            onSelectUnbilledEncounter={handleSelectUnbilledEncounter}
                            onSelectPatientAutoFill={handleSelectPatientAutoFill}
                        />

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
                                <PatientVoucherGroups
                                    groupedPatients={groupedPatients}
                                    expandedPatients={expandedPatients}
                                    togglePatient={togglePatient}
                                    form={form}
                                    onSelectPatientCombined={handleSelectPatientCombined}
                                    onSelectVoucher={handleSelectVoucher}
                                    onOpenQr={handleOpenQr}
                                    onPayAllForPatient={handlePayAllForPatient}
                                />
                            ) : (
                                <AllVouchersTable
                                    filteredVouchers={filteredVouchers}
                                    form={form}
                                    onSelectVoucher={handleSelectVoucher}
                                    onOpenQr={handleOpenQr}
                                />
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

                    <VoucherEditorForm
                        form={form}
                        setForm={setForm}
                        patients={patients}
                        paymentMethods={paymentMethods}
                        khoanThuCatalog={khoanThuCatalog}
                        newItemName={newItemName}
                        setNewItemName={setNewItemName}
                        newItemAmount={newItemAmount}
                        setNewItemAmount={setNewItemAmount}
                        newItemNote={newItemNote}
                        setNewItemNote={setNewItemNote}
                        onSelectPatientAutoFill={handleSelectPatientAutoFill}
                        onAddLineItem={handleAddLineItem}
                        onRemoveLineItem={handleRemoveLineItem}
                        onSaveVoucher={handleSaveVoucher}
                        onDeleteVoucher={handleDeleteVoucher}
                        onOpenQr={handleOpenQr}
                        onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
                        onResetForm={() => setForm(buildEmptyVoucher())}
                    />
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
                onConfirmPayment={handleConfirmQrPayment}
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
