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
                            <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <Receipt size={16} weight="duotone" className="text-clinic-cta" />
                                <span>DANH SÁCH PHIẾU THU VIỆN PHÍ ({filteredVouchers.length})</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setForm(buildEmptyVoucher())}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-clinic-cta hover:underline cursor-pointer shrink-0 whitespace-nowrap"
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
                            <div className="col-span-6 relative">
                                <MagnifyingGlass
                                    size={14}
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                                />
                                <input
                                    type="text"
                                    aria-label="Tìm mã phiếu thu hoặc tên bệnh nhân"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Tìm Mã phiếu, Tên BN..."
                                    className="medpro-input !py-0 h-9 !pl-8 text-xs"
                                />
                            </div>
                            <div className="col-span-6 relative">
                                <Funnel
                                    size={13}
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                                />
                                <select
                                    aria-label="Lọc trạng thái phiếu thu"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="medpro-input !py-1.5 h-9 !pl-7 !pr-6 text-xs font-semibold truncate"
                                >
                                    <option value="ALL">Tất cả trạng thái</option>
                                    <option value="PAID">Đã thu tiền</option>
                                    <option value="PENDING">Chờ thu tiền</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 py-1 px-1 bg-clinic-bg rounded-[6px] border border-clinic-border text-xs tabular-nums">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setInvoiceViewMode('BY_PATIENT')}
                                    className={`px-2 py-1 rounded-[4px] font-semibold transition cursor-pointer ${
                                        invoiceViewMode === 'BY_PATIENT'
                                            ? 'bg-clinic-surface text-clinic-cta'
                                            : 'text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    Theo bệnh nhân ({groupedPatients.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInvoiceViewMode('FLAT_LIST')}
                                    className={`px-2 py-1 rounded-[4px] font-semibold transition cursor-pointer ${
                                        invoiceViewMode === 'FLAT_LIST'
                                            ? 'bg-clinic-surface text-clinic-cta'
                                            : 'text-clinic-text-secondary hover:text-clinic-navy'
                                    }`}
                                >
                                    Tất cả phiếu ({filteredVouchers.length})
                                </button>
                            </div>
                            {invoiceViewMode === 'BY_PATIENT' && groupedPatients.length > 0 && (
                                <button
                                    type="button"
                                    onClick={toggleExpandAll}
                                    className="text-[11px] text-clinic-text-secondary hover:text-clinic-cta font-medium px-1 cursor-pointer"
                                >
                                    {isAllExpanded ? 'Thu gọn' : 'Mở rộng'}
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto border border-clinic-border rounded-[6px]">
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

                        <div className="pt-2.5 grid grid-cols-2 gap-2 text-xs font-bold border-t border-clinic-border mt-2">
                            <div className="p-2 rounded-[6px] bg-clinic-success-bg text-clinic-success border border-clinic-success-border flex justify-between">
                                <span>Doanh thu:</span>
                                <span className="tabular-nums">{totalThu.toLocaleString('vi-VN')} đ</span>
                            </div>
                            <div className="p-2 rounded-[6px] bg-clinic-surface-alt text-clinic-navy border border-clinic-info-border flex justify-between">
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
