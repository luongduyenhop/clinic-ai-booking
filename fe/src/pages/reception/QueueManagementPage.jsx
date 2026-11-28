import React from 'react'
import { useQueuePageLogic } from '../../hooks/useQueuePageLogic'
import QueueHeaderBar from '../../components/reception/queue/QueueHeaderBar'
import RoomDepartmentFilter from '../../components/reception/queue/RoomDepartmentFilter'
import QueueFilterToolbar from '../../components/reception/queue/QueueFilterToolbar'
import QueueRoomActiveBanner from '../../components/reception/queue/QueueRoomActiveBanner'
import QueueMainTable from '../../components/reception/queue/QueueMainTable'
import QueueWaitlistTable from '../../components/reception/queue/QueueWaitlistTable'
import QueueAuditHistoryModal from '../../components/reception/queue/QueueAuditHistoryModal'
import QueueActionModal from '../../components/reception/QueueActionModal'
import PatientDetailDrawer from '../../components/reception/PatientDetailDrawer'
import CheckInReceiptModal from '../../components/reception/CheckInReceiptModal'

export default function QueueManagementPage() {
    const {
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        selectedDepartmentTab,
        setSelectedDepartmentTab,
        selectedRoomId,
        selectedDate,
        setSelectedDate,
        selectedShift,
        setSelectedShift,
        actionModal,
        setActionModal,
        historyModal,
        setHistoryModal,
        historyLogs,
        setHistoryLogs,
        isLoadingHistory,
        patientDrawerId,
        setPatientDrawerId,
        receiptEntry,
        setReceiptEntry,
        isRefreshing,
        displayRooms,
        departmentTabs,
        knownDepIds,
        getRoomsForTab,
        roomWaitingCounts,
        totalWaitingCount,
        visibleRooms,
        filteredQueue,
        tabCounts,
        filteredWaitlist,
        patients,
        queueLoading,
        waitlistLoading,
        selectedRoomObject,
        handleRefreshQueue,
        handleOpenHistoryModal,
        handleSelectRoom,
        handleSelectAllRooms,
        handleCallNumber,
        handleResume,
        handleMarkAbsent,
        handleCheckInWaitlist,
        handleCancelWaitlist,
        handleResetAllFilters,
    } = useQueuePageLogic()

    return (
        <div className="space-y-4">
            <QueueHeaderBar
                totalWaitingCount={totalWaitingCount}
                isRefreshing={isRefreshing}
                onRefresh={handleRefreshQueue}
            />

            <RoomDepartmentFilter
                departmentTabs={departmentTabs}
                selectedDepartmentTab={selectedDepartmentTab}
                onSelectDepartmentTab={setSelectedDepartmentTab}
                selectedRoomId={selectedRoomId}
                onSelectAllRooms={handleSelectAllRooms}
                displayRooms={displayRooms}
                visibleRooms={visibleRooms}
                roomWaitingCounts={roomWaitingCounts}
                getRoomsForTab={getRoomsForTab}
                onSelectRoom={handleSelectRoom}
            />

            <div className="medpro-card p-4 space-y-3">
                <QueueFilterToolbar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    tabCounts={tabCounts}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    selectedShift={selectedShift}
                    onShiftChange={setSelectedShift}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />

                <QueueRoomActiveBanner
                    selectedRoomObject={selectedRoomObject}
                    selectedDepartmentTab={selectedDepartmentTab}
                    departmentTabs={departmentTabs}
                    queueCount={filteredQueue.length}
                    onClearRoomFilter={handleSelectAllRooms}
                />

                {activeTab === 'WAITLIST' ? (
                    <QueueWaitlistTable
                        dataSource={filteredWaitlist}
                        loading={waitlistLoading}
                        selectedRoomId={selectedRoomId}
                        selectedRoomObject={selectedRoomObject}
                        onSelectAllRooms={handleSelectAllRooms}
                        onCheckInWaitlist={handleCheckInWaitlist}
                        onCancelWaitlist={handleCancelWaitlist}
                    />
                ) : (
                    <QueueMainTable
                        dataSource={filteredQueue}
                        loading={queueLoading}
                        patients={patients}
                        selectedRoomObject={selectedRoomObject}
                        selectedRoomId={selectedRoomId}
                        searchQuery={searchQuery}
                        activeTab={activeTab}
                        onCallNumber={handleCallNumber}
                        onResume={handleResume}
                        onMarkAbsent={handleMarkAbsent}
                        onOpenPatientDrawer={setPatientDrawerId}
                        onPrintReceipt={setReceiptEntry}
                        onOpenActionModal={(entry, mode) => setActionModal({ open: true, entry, mode })}
                        onOpenHistoryModal={handleOpenHistoryModal}
                        onResetAllFilters={handleResetAllFilters}
                    />
                )}
            </div>

            <QueueActionModal
                queueEntry={actionModal.entry}
                mode={actionModal.mode}
                open={actionModal.open}
                onClose={() => setActionModal({ open: false, entry: null, mode: 'DEFER' })}
                onSuccess={() => handleRefreshQueue()}
            />

            <QueueAuditHistoryModal
                open={historyModal.open}
                entry={historyModal.entry}
                logs={historyLogs}
                isLoading={isLoadingHistory}
                onClose={() => {
                    setHistoryModal({ open: false, entry: null })
                    setHistoryLogs([])
                }}
            />

            <PatientDetailDrawer
                patientId={patientDrawerId}
                open={Boolean(patientDrawerId)}
                onClose={() => setPatientDrawerId(null)}
            />

            <CheckInReceiptModal
                open={Boolean(receiptEntry)}
                onClose={() => setReceiptEntry(null)}
                queueEntry={receiptEntry}
            />
        </div>
    )
}
