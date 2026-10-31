import { useEffect, useState } from 'react'
import { patientPortalService } from '../../../services/user/PatientPortalService'

export default function usePatientResults(kind) {
    const [page, setPage] = useState(1)
    const [retry, setRetry] = useState(0)
    const [state, setState] = useState({ items: [], meta: null, loading: true, error: '' })
    useEffect(() => {
        const controller = new AbortController()
        setState((current) => ({ ...current, loading: true, error: '' }))
        const load = kind === 'prescriptions'
            ? patientPortalService.getPrescriptionsPage.bind(patientPortalService)
            : patientPortalService.getLabResultsPage.bind(patientPortalService)
        load(page, controller.signal).then((result) => {
            if (!controller.signal.aborted) setState({ ...result, loading: false, error: '' })
        }).catch((error) => {
            if (!controller.signal.aborted) setState({ items: [], meta: null, loading: false, error: error.message || 'Không thể tải dữ liệu. Vui lòng thử lại.' })
        })
        return () => controller.abort()
    }, [kind, page, retry])
    return { ...state, setPage, reload: () => setRetry((current) => current + 1) }
}
