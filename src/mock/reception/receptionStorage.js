import {
    initialDepartments,
    initialDoctors,
    initialRooms,
    initialServices,
    initialPatients,
    initialAppointments,
    initialQueueEntries,
    initialTasks,
    initialAuditLogs,
    initialInvoices,
} from './seedData'

const STORAGE_KEYS = {
    DEPARTMENTS: 'clinic_reception_departments_v1',
    DOCTORS: 'clinic_reception_doctors_v1',
    ROOMS: 'clinic_reception_rooms_v1',
    SERVICES: 'clinic_reception_services_v1',
    PATIENTS: 'clinic_reception_patients_v1',
    APPOINTMENTS: 'clinic_reception_appointments_v1',
    QUEUE: 'clinic_reception_queue_v1',
    TASKS: 'clinic_reception_tasks_v1',
    AUDIT_LOGS: 'clinic_reception_audit_logs_v1',
    INVOICES: 'clinic_reception_invoices_v1',
    ACTIVE_ROLE: 'clinic_reception_active_role_v1',
}

function getStoredOrInitial(key, initialData) {
    try {
        const item = localStorage.getItem(key)
        if (item) {
            return JSON.parse(item)
        }
    } catch (e) {
        console.error(`Error reading ${key} from localStorage:`, e)
    }
    // Lưu lại dữ liệu mặc định vào localStorage
    try {
        localStorage.setItem(key, JSON.stringify(initialData))
    } catch (e) {
        console.error(`Error writing ${key} to localStorage:`, e)
    }
    return initialData
}

export function loadAllReceptionData() {
    return {
        departments: getStoredOrInitial(STORAGE_KEYS.DEPARTMENTS, initialDepartments),
        doctors: getStoredOrInitial(STORAGE_KEYS.DOCTORS, initialDoctors),
        rooms: getStoredOrInitial(STORAGE_KEYS.ROOMS, initialRooms),
        services: getStoredOrInitial(STORAGE_KEYS.SERVICES, initialServices),
        patients: getStoredOrInitial(STORAGE_KEYS.PATIENTS, initialPatients),
        appointments: getStoredOrInitial(STORAGE_KEYS.APPOINTMENTS, initialAppointments),
        queueEntries: getStoredOrInitial(STORAGE_KEYS.QUEUE, initialQueueEntries),
        tasks: getStoredOrInitial(STORAGE_KEYS.TASKS, initialTasks),
        auditLogs: getStoredOrInitial(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs),
        invoices: getStoredOrInitial(STORAGE_KEYS.INVOICES, initialInvoices),
        activeRole: localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE) || 'RECEPTIONIST',
    }
}

export function saveReceptionData(data) {
    try {
        if (data.patients) localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(data.patients))
        if (data.appointments) localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(data.appointments))
        if (data.queueEntries) localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(data.queueEntries))
        if (data.tasks) localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(data.tasks))
        if (data.auditLogs) localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(data.auditLogs))
        if (data.doctors) localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(data.doctors))
        if (data.rooms) localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(data.rooms))
        if (data.invoices) localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(data.invoices))
        if (data.activeRole) localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, data.activeRole)
    } catch (e) {
        console.error('Error saving data to localStorage:', e)
    }
}

export function resetReceptionData() {
    try {
        localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(initialDepartments))
        localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(initialDoctors))
        localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(initialRooms))
        localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(initialServices))
        localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(initialPatients))
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(initialAppointments))
        localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(initialQueueEntries))
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(initialTasks))
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(initialAuditLogs))
        localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(initialInvoices))
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, 'RECEPTIONIST')
    } catch (e) {
        console.error('Error resetting reception data:', e)
    }
    return loadAllReceptionData()
}
