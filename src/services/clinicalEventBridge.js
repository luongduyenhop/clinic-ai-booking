/**
 * Central Clinical Event Bridge for Clinic-AI
 * Cầu nối phát và nhận sự kiện thời gian thực giữa các phân hệ:
 * Tiếp đón -> Bàn khám Bác sĩ -> Phòng Cận lâm sàng -> Quầy Thu ngân -> Cổng Bệnh nhân
 */

export const CLINICAL_EVENTS = {
    PATIENT_CHECKED_IN: 'CLINIC_PATIENT_CHECKED_IN',
    CLS_ORDERED: 'CLINIC_CLS_ORDERED',
    CLS_RESULT_RETURNED: 'CLINIC_CLS_RESULT_RETURNED',
    ENCOUNTER_COMPLETED: 'CLINIC_ENCOUNTER_COMPLETED',
    BILL_PAID: 'CLINIC_BILL_PAID',
}

class ClinicalEventBridge {
    constructor() {
        this.listeners = new Map()

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (event) => {
                if (event.key === 'clinic_cross_tab_event' && event.newValue) {
                    try {
                        const { eventName, payload } = JSON.parse(event.newValue)
                        this._dispatchLocal(eventName, payload, false)
                    } catch (e) {
                        console.warn('Failed to parse cross tab event:', e)
                    }
                }
            })
        }
    }

    _dispatchLocal(eventName, payload, broadcast = true) {
        const handlers = this.listeners.get(eventName)
        if (handlers && handlers.size > 0) {
            handlers.forEach((handler) => {
                try {
                    handler(payload)
                } catch (err) {
                    console.error(`Error in clinical event handler for ${eventName}:`, err)
                }
            })
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent(`clinic_${eventName}`, {
                    detail: payload,
                })
            )

            if (broadcast) {
                try {
                    localStorage.setItem(
                        'clinic_cross_tab_event',
                        JSON.stringify({
                            eventName,
                            payload,
                            timestamp: Date.now(),
                        })
                    )
                } catch {
                    // Storage quota exceeded or disabled
                }
            }
        }
    }

    emit(eventName, payload = {}) {
        this._dispatchLocal(eventName, payload, true)
    }

    on(eventName, handler) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set())
        }
        this.listeners.get(eventName).add(handler)

        return () => this.off(eventName, handler)
    }

    off(eventName, handler) {
        const handlers = this.listeners.get(eventName)
        if (handlers) {
            handlers.delete(handler)
        }
    }
}

export const clinicalEventBridge = new ClinicalEventBridge()
export default clinicalEventBridge
