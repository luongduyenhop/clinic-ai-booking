import { useSelector } from 'react-redux'
import { Spin } from 'antd'

export default function Loading() {
    const loadingCount = useSelector((state) => state.app.ui.loadingCount)

    if (loadingCount <= 0) return null

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200">
            <div className="bg-white/95 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3 border border-slate-100">
                <Spin size="large" />
                <span className="text-sm font-semibold text-slate-700 tracking-wide">
                    Đang tải dữ liệu...
                </span>
            </div>
        </div>
    )
}
