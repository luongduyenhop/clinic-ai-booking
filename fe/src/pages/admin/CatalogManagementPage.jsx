import { useCatalogManagementLogic } from '../../hooks/useCatalogManagementLogic'
import CatalogNavigationTabs from '../../components/admin/catalog/CatalogNavigationTabs'
import CatalogTableView from '../../components/admin/catalog/CatalogTableView'
import CatalogFormDetail from '../../components/admin/catalog/CatalogFormDetail'
import PriceHistoryModal from '../../components/admin/catalog/PriceHistoryModal'
import ExportServiceModal from '../../components/admin/catalog/ExportServiceModal'

export default function CatalogManagementPage() {
    const {
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
    } = useCatalogManagementLogic()

    return (
        <div className="space-y-3.5">
            <CatalogNavigationTabs
                catalogRouteMap={catalogRouteMap}
                loaiDanhMuc={loaiDanhMuc}
                catalogs={catalogs}
                activeGeneralSubTab={activeGeneralSubTab}
                generalSubTabs={generalSubTabs}
                setActiveGeneralSubTab={setActiveGeneralSubTab}
                activeKhoaPhongView={activeKhoaPhongView}
                setActiveKhoaPhongView={setActiveKhoaPhongView}
                handleSwitchCatalogView={handleSwitchCatalogView}
                fileInputRef={fileInputRef}
                handleImportFile={handleImportFile}
                handleExportCatalog={handleExportCatalog}
                handleOpenPriceHistory={handleOpenPriceHistory}
                handleOpenExportModal={handleOpenExportModal}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                <CatalogTableView
                    filteredList={filteredList}
                    searchText={searchText}
                    setSearchText={setSearchText}
                    loaiDanhMuc={loaiDanhMuc}
                    catalogRouteMap={catalogRouteMap}
                    activeCatalogKey={activeCatalogKey}
                    form={form}
                    setForm={setForm}
                />

                <CatalogFormDetail
                    form={form}
                    setForm={setForm}
                    handleNewItem={handleNewItem}
                    handleSaveItem={handleSaveItem}
                    handleDeleteItem={handleDeleteItem}
                    activeCatalogKey={activeCatalogKey}
                    activeKhoaPhongView={activeKhoaPhongView}
                    loaiDanhMuc={loaiDanhMuc}
                    activeGeneralSubTab={activeGeneralSubTab}
                />
            </div>

            <PriceHistoryModal
                isOpen={isPriceHistoryOpen}
                onClose={() => setIsPriceHistoryOpen(false)}
                loading={priceHistoryLoading}
                history={priceHistory}
                form={form}
            />

            <ExportServiceModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                loading={exportLoading}
                exportedServices={exportedServices}
                handleDownloadServicesCsv={handleDownloadServicesCsv}
            />
        </div>
    )
}
