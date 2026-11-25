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
    Plus,
    MagnifyingGlass,
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
        <div className="space-y-3">
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                    <div className="lg:col-span-5 xl:col-span-4 medpro-card flex flex-col h-[calc(100vh-132px)] overflow-hidden">
                        <div className="px-3.5 pt-3 pb-2.5 border-b border-clinic-border space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-xs font-semibold text-clinic-navy tabular-nums">
                                    Danh sách hóa đơn ({filteredVouchers.length})
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setForm(buildEmptyVoucher())}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-clinic-cta hover:underline cursor-pointer shrink-0 whitespace-nowrap"
                                >
                                    <Plus size={13} weight="bold" />
                                    <span>Phiếu mới</span>
                                </button>
                            </div>

                            <UnbilledEncounterList
                                liveUnbilled={liveUnbilled}
                                pendingBillRegistrations={pendingBillRegistrations}
                                onSelectUnbilledEncounter={handleSelectUnbilledEncounter}
                                onSelectPatientAutoFill={handleSelectPatientAutoFill}
                            />

                            <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-7 relative">
                                    <MagnifyingGlass
                                        size={14}
                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none"
                                    />
                                    <input
                                        type="text"
                                        aria-label="Tìm mã phiếu thu hoặc tên bệnh nhân"
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        placeholder="Tìm tên BN, mã phiếu..."
                                        className="medpro-input !py-0 h-8 !pl-8 text-xs"
                                    />
                                </div>
                                <div className="col-span-5">
                                    <select
                                        aria-label="Lọc trạng thái phiếu thu"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="medpro-input !py-0 h-8 !px-2.5 text-xs font-medium"
                                    >
                                        <option value="ALL">Mọi trạng thái</option>
                                        <option value="PENDING">Chờ thu</option>
                                        <option value="PAID">Đã thu</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                                <div className="inline-flex items-center gap-0.5 p-0.5 bg-clinic-bg-muted rounded-[6px] border border-clinic-border">
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceViewMode('BY_PATIENT')}
                                        className={`px-2.5 py-1 rounded-[4px] font-medium transition cursor-pointer whitespace-nowrap ${
                                            invoiceViewMode === 'BY_PATIENT'
                                                ? 'bg-clinic-surface text-clinic-navy font-semibold'
                                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        Theo BN ({groupedPatients.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceViewMode('FLAT_LIST')}
                                        className={`px-2.5 py-1 rounded-[4px] font-medium transition cursor-pointer whitespace-nowrap ${
                                            invoiceViewMode === 'FLAT_LIST'
                                                ? 'bg-clinic-surface text-clinic-navy font-semibold'
                                                : 'text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        Tất cả ({filteredVouchers.length})
                                    </button>
                                </div>
                                {invoiceViewMode === 'BY_PATIENT' && groupedPatients.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={toggleExpandAll}
                                        className="text-[11px] text-clinic-text-secondary hover:text-clinic-cta font-medium cursor-pointer whitespace-nowrap shrink-0"
                                    >
                                        {isAllExpanded ? 'Thu gọn' : 'Mở hết'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
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

                        <div className="px-3.5 py-2.5 bg-clinic-bg-muted/70 border-t border-clinic-border flex items-center justify-between gap-2 text-xs tabular-nums">
                            <span className="text-clinic-text-secondary">
                                Đã thu <strong className="text-clinic-navy">{paidCount}/{allVouchers.length}</strong> phiếu
                            </span>
                            <span className="font-semibold text-clinic-navy">
                                Thực thu: <strong className="text-clinic-success">{totalThu.toLocaleString('vi-VN')} đ</strong>
                            </span>
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
