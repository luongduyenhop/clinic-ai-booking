import { useEffect } from 'react'

/**
 * Hook quản lý phím tắt chuyên dụng cho Bác sĩ bàn khám (tClinic & SimpleClinic)
 * F2: Gọi số tiếp theo
 * F4: Nạp phác đồ mẫu
 * F5 / Ctrl+S: Lưu bệnh án / lưu nháp
 * F7: Nhảy đến Chỉ định Cận lâm sàng
 * F8: Xem lịch sử khám cũ
 * F9 / Ctrl+P: In đơn thuốc & QR
 * Esc: Đóng các cửa sổ popup
 */
export function useDoctorShortcuts({
    onCallNext,
    onOpenTemplates,
    onSave,
    onJumpToOrders,
    onOpenHistory,
    onPrint,
    onEscape,
    disabled = false,
}) {
    useEffect(() => {
        if (disabled || typeof window === 'undefined') return

        const handleKeyDown = (e) => {
            // Không chặn nếu người dùng đang gõ trong input text hoặc textarea, ngoại trừ các phím F-keys và Ctrl+S/Ctrl+P
            const isFKey = ['F2', 'F4', 'F5', 'F7', 'F8', 'F9'].includes(e.key)
            const isCtrlS = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'
            const isCtrlP = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p'
            const isAltN = e.altKey && e.key.toLowerCase() === 'n'
            const isEsc = e.key === 'Escape'

            if (!isFKey && !isCtrlS && !isCtrlP && !isAltN && !isEsc) return

            // Bắt và xử lý
            if (isCtrlS || e.key === 'F5') {
                e.preventDefault()
                onSave?.()
                return
            }

            if (isCtrlP || e.key === 'F9') {
                e.preventDefault()
                onPrint?.()
                return
            }

            if (isAltN || e.key === 'F2') {
                e.preventDefault()
                onCallNext?.()
                return
            }

            if (e.key === 'F4') {
                e.preventDefault()
                onOpenTemplates?.()
                return
            }

            if (e.key === 'F7') {
                e.preventDefault()
                onJumpToOrders?.()
                return
            }

            if (e.key === 'F8') {
                e.preventDefault()
                onOpenHistory?.()
                return
            }

            if (isEsc) {
                onEscape?.()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [disabled, onCallNext, onOpenTemplates, onSave, onJumpToOrders, onOpenHistory, onPrint, onEscape])
}
