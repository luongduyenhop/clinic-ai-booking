import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Spin } from 'antd'
import { fetchReceptionDataAsync } from '../redux/slices/reception/receptionSlice'
import ReceptionSidebar from '../components/reception/ReceptionSidebar'
import ReceptionHeader from '../components/reception/ReceptionHeader'

export default function ReceptionLayout() {
    const dispatch = useDispatch()
    const { isInitialized, loading } = useSelector((state) => state.reception)

    useEffect(() => {
        if (!isInitialized) {
            dispatch(fetchReceptionDataAsync())
        }
    }, [dispatch, isInitialized])

    if (!isInitialized && loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <Spin size="large" />
                <span className="text-sm font-semibold text-slate-600">Đang chuẩn bị dữ liệu Cổng Lễ Tân...</span>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex bg-slate-100/80 font-sans text-slate-800 antialiased selection:bg-sky-200 selection:text-sky-900">
            {/* Sidebar */}
            <ReceptionSidebar />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <ReceptionHeader />

                <main className="flex-1 p-5 md:p-6 overflow-y-auto no-scrollbar bg-slate-100/60">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
