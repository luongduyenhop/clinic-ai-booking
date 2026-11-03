import { Outlet } from 'react-router-dom'
import ReceptionSidebar from '../components/reception/ReceptionSidebar'
import ReceptionHeader from '../components/reception/ReceptionHeader'

export default function ReceptionLayout() {
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
