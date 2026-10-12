import { Component } from 'react'

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    handleReload = () => {
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                            !
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Đã xảy ra sự cố</h2>
                        <p className="text-sm text-slate-500 mb-6">
                            Hệ thống gặp lỗi không mong muốn trong quá trình xử lý giao diện.
                        </p>
                        <button
                            onClick={this.handleReload}
                            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition duration-200 cursor-pointer shadow-sm"
                        >
                            Tải lại trang
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
