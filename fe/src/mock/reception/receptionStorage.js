// Decoupled from static seedData - uses database initial state

const STORAGE_KEYS = {
    DEPARTMENTS: 'clinic_reception_departments_v2',
    DOCTORS: 'clinic_reception_doctors_v2',
    ROOMS: 'clinic_reception_rooms_v2',
    SERVICES: 'clinic_reception_services_v2',
    PATIENTS: 'clinic_reception_patients_v2',
    APPOINTMENTS: 'clinic_reception_appointments_v2',
    QUEUE: 'clinic_reception_queue_v2',
    TASKS: 'clinic_reception_tasks_v2',
    AUDIT_LOGS: 'clinic_reception_audit_logs_v2',
    INVOICES: 'clinic_reception_invoices_v2',
    ACTIVE_ROLE: 'clinic_reception_active_role_v2',
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
        departments: getStoredOrInitial(STORAGE_KEYS.DEPARTMENTS, []),
        doctors: getStoredOrInitial(STORAGE_KEYS.DOCTORS, []),
        rooms: getStoredOrInitial(STORAGE_KEYS.ROOMS, []),
        services: getStoredOrInitial(STORAGE_KEYS.SERVICES, []),
        patients: getStoredOrInitial(STORAGE_KEYS.PATIENTS, []),
        appointments: getStoredOrInitial(STORAGE_KEYS.APPOINTMENTS, []),
        queueEntries: getStoredOrInitial(STORAGE_KEYS.QUEUE, []),
        tasks: getStoredOrInitial(STORAGE_KEYS.TASKS, []),
        auditLogs: getStoredOrInitial(STORAGE_KEYS.AUDIT_LOGS, []),
        invoices: getStoredOrInitial(STORAGE_KEYS.INVOICES, []),
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
        localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify([]))
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, 'RECEPTIONIST')
    } catch (e) {
        console.error('Error resetting reception data:', e)
    }
    return loadAllReceptionData()
}
