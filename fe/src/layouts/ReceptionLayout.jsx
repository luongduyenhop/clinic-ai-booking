import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import ReceptionSidebar from '../components/reception/ReceptionSidebar'
import ReceptionHeader from '../components/reception/ReceptionHeader'
import { loadClinicDataAsync } from '../redux/actions/admin/adminAction'

export default function ReceptionLayout() {
    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(loadClinicDataAsync())
    }, [dispatch])

    return (
        <div className="h-screen h-[100dvh] flex bg-clinic-bg text-clinic-text overflow-hidden antialiased">
            <ReceptionSidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <ReceptionHeader />

                <main className="flex-1 p-3 sm:p-4 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
