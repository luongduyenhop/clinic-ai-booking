import { useEffect } from 'react'
import { toast } from 'react-toastify'
import { startSignalRConnection, stopSignalRConnection } from '../../services/signalrService'

export default function RealtimeNotificationHandler() {
    useEffect(() => {
        startSignalRConnection((data) => {
            if (data?.message) {
                toast.info(`🔔 ${data.message}`)
            }
        })

        return () => {
            stopSignalRConnection()
        }
    }, [])

    return null
}
