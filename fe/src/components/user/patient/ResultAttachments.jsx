import { useState, useEffect, useRef } from 'react'
import { Modal } from 'antd'
import { http } from '../../../services/BaseService'
import { Eye, DownloadSimple, Scan } from '../../common/ClinicIcon'

const stripQueryToken = (url) => {
    if (!url) return ''
    return String(url).split('?')[0]
}

export default function ResultAttachments({ files = [], serviceName = 'Chẩn đoán hình ảnh & Thăm dò chức năng' }) {
    const list = (files || [])
        .map((f, idx) => {
            const rawUrl = typeof f === 'string' ? f : f?.url
            return {
                url: stripQueryToken(rawUrl),
                label: `Ảnh kết quả #${idx + 1}`,
            }
        })
        .filter((f) => Boolean(f.url))

    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const [blobUrls, setBlobUrls] = useState({})
    const [loadingUrl, setLoadingUrl] = useState(null)
    const [errorUrl, setErrorUrl] = useState(null)
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const inFlightRef = useRef({})

    const fetchImageBlob = (targetUrl) => {
        if (!targetUrl || blobUrls[targetUrl] || inFlightRef.current[targetUrl]) return

        // Direct browser URLs (Blob URLs or Data URLs) don't need network fetch
        if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:')) {
            setBlobUrls((prev) => ({ ...prev, [targetUrl]: targetUrl }))
            return
        }

        // Direct HTTP/HTTPS external image URLs (e.g. Cloudinary, external CDN)
        if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
            setBlobUrls((prev) => ({ ...prev, [targetUrl]: targetUrl }))
            return
        }

        inFlightRef.current[targetUrl] = true
        setLoadingUrl(targetUrl)
        setErrorUrl(null)

        http.get(targetUrl, {
            responseType: 'blob',
            __skipGlobalLoading: true,
            __skipGlobalError: true,
        })
            .then((res) => {
                const objectUrl = URL.createObjectURL(res.data)
                setBlobUrls((prev) => ({ ...prev, [targetUrl]: objectUrl }))
            })
            .catch(() => {
                // Fallback direct url
                setBlobUrls((prev) => ({ ...prev, [targetUrl]: targetUrl }))
            })
            .finally(() => {
                inFlightRef.current[targetUrl] = false
                setLoadingUrl((prev) => (prev === targetUrl ? null : prev))
            })
    }

    useEffect(() => {
        if (!open) return
        const current = list[activeIndex]
        if (current?.url) {
            fetchImageBlob(current.url)
        }
        setZoom(1)
        setRotation(0)
    }, [open, activeIndex])

    if (!list.length) return null

    const currentFile = list[activeIndex] || list[0]
    const currentBlobUrl = currentFile ? blobUrls[currentFile.url] : null
    const isLoading = Boolean(currentFile && loadingUrl === currentFile.url && !currentBlobUrl)
    const hasError = Boolean(currentFile && errorUrl === currentFile.url)

    const handleDownload = () => {
        if (!currentBlobUrl) return
        const link = document.createElement('a')
        link.href = currentBlobUrl
        link.download = `anh-ket-qua-cls-${activeIndex + 1}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleZoomIn = () => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
    const handleZoomOut = () => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
    const handleResetZoom = () => { setZoom(1); setRotation(0) }
    const handleRotate = () => setRotation((r) => (r + 90) % 360)

    return (
        <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={() => {
                    setActiveIndex(0)
                    setOpen(true)
                    if (list[0]?.url) {
                        fetchImageBlob(list[0].url)
                    }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[#00B5F1]/60 bg-[#F0F9FF] px-3.5 py-2 text-xs font-bold text-[#003553] shadow-xs transition hover:bg-[#E0F2FE] hover:border-[#00B5F1] hover:shadow-sm cursor-pointer"
            >
                <Eye size={17} weight="bold" className="text-[#00B5F1]" />
                <span>Xem ảnh kết quả ({list.length})</span>
            </button>

            <Modal
                open={open}
                onCancel={() => { setOpen(false); setIsFullscreen(false) }}
                footer={null}
                width={1120}
                centered
                className="!max-w-[95vw]"
                style={{ top: 15 }}
                title={
                    <div className="flex flex-wrap items-center justify-between gap-3 pr-8 text-[#003553]">
                        <div className="flex items-center gap-2">
                            <Scan size={20} weight="duotone" className="text-[#00B5F1]" />
                            <span className="font-extrabold text-sm md:text-base text-[#003553]">
                                {serviceName} · <span className="text-[#0077B6] font-bold">{currentFile?.label}</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                            <button
                                type="button"
                                onClick={handleZoomOut}
                                className="px-2 py-1 rounded-lg hover:bg-white text-slate-700 font-bold transition cursor-pointer"
                                title="Thu nhỏ"
                            >
                                🔍-
                            </button>
                            <span className="px-1.5 font-bold text-[11px] text-slate-600 min-w-[42px] text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={handleZoomIn}
                                className="px-2 py-1 rounded-lg hover:bg-white text-slate-700 font-bold transition cursor-pointer"
                                title="Phóng to"
                            >
                                🔍+
                            </button>
                            <button
                                type="button"
                                onClick={handleRotate}
                                className="px-2 py-1 rounded-lg hover:bg-white text-slate-700 font-bold transition cursor-pointer"
                                title="Xoay ảnh 90°"
                            >
                                🔄
                            </button>
                            <button
                                type="button"
                                onClick={handleResetZoom}
                                className="px-2 py-1 rounded-lg hover:bg-white text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                                title="Đặt lại kích thước gốc"
                            >
                                100%
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                                    isFullscreen ? 'bg-[#003553] text-white' : 'hover:bg-white text-slate-700'
                                }`}
                                title={isFullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}
                            >
                                ⛶
                            </button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-4 pt-2">
                    <div
                        className={`relative flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-4 overflow-hidden select-none transition-all ${
                            isFullscreen
                                ? 'fixed inset-0 z-[2000] rounded-none h-screen min-h-screen'
                                : 'min-h-[520px] h-[68vh] max-h-[760px]'
                        }`}
                    >
                        {isFullscreen && (
                            <button
                                type="button"
                                onClick={() => setIsFullscreen(false)}
                                className="absolute top-4 right-4 z-50 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-xs font-bold transition shadow-lg"
                            >
                                ✕ Thoát toàn màn hình
                            </button>
                        )}

                        {isLoading && (
                            <div className="text-sm font-semibold text-sky-200 animate-pulse flex items-center gap-2">
                                <span className="animate-spin text-lg">⏳</span> Đang nạp hình ảnh chuẩn PACS y tế...
                            </div>
                        )}

                        {!isLoading && hasError && (
                            <div className="text-center space-y-3 p-6 bg-slate-900/80 rounded-2xl border border-rose-500/30">
                                <p className="text-sm text-rose-300 font-semibold">Không thể tải hình ảnh kết quả.</p>
                                <p className="text-xs text-slate-400">Đường dẫn tệp có thể đã hết hạn hoặc không truy cập được.</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (currentFile?.url) {
                                            setErrorUrl(null)
                                            inFlightRef.current[currentFile.url] = false
                                            fetchImageBlob(currentFile.url)
                                        }
                                    }}
                                    className="rounded-xl bg-sky-500 hover:bg-sky-600 px-4 py-2 text-xs font-bold text-white transition cursor-pointer"
                                >
                                    Thử tải lại ảnh
                                </button>
                            </div>
                        )}

                        {!isLoading && !hasError && currentBlobUrl && (
                            <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                                <img
                                    src={currentBlobUrl}
                                    alt={serviceName}
                                    className="max-h-full max-w-full w-auto h-auto rounded-xl object-contain shadow-2xl transition-transform duration-200"
                                    style={{
                                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                        transformOrigin: 'center center',
                                    }}
                                    onError={() => setErrorUrl(currentFile.url)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                            {list.length > 1 &&
                                list.map((item, idx) => (
                                    <button
                                        key={item.url}
                                        type="button"
                                        onClick={() => {
                                            setActiveIndex(idx)
                                            setZoom(1)
                                            setRotation(0)
                                        }}
                                        className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                                            idx === activeIndex
                                                ? 'bg-[#003553] text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                        </div>

                        <div className="flex items-center gap-2">
                            {currentBlobUrl && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#00B5F1] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#009ED4] cursor-pointer"
                                >
                                    <DownloadSimple size={16} weight="bold" />
                                    <span>Tải ảnh gốc</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { setOpen(false); setIsFullscreen(false) }}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
