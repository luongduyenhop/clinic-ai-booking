import { useState, useEffect, useRef } from 'react'
import { Modal } from 'antd'
import { http } from '../../../services/BaseService'
import { ClinicIcon } from '../../common/ClinicIcon'

const stripQueryToken = (url) => {
    if (!url) return ''
    return String(url).split('?')[0]
}

export default function ResultAttachments({
    files = [],
    serviceName = 'Chẩn đoán hình ảnh & Thăm dò chức năng',
}) {
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

    const fetchImageBlob = (targetUrl, forceReload = false) => {
        if (!targetUrl || (!forceReload && blobUrls[targetUrl]) || inFlightRef.current[targetUrl]) return

        if (/^(blob|data|https?):/i.test(targetUrl)) {
            setErrorUrl(null)
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
    const handleResetView = () => {
        setZoom(1)
        setRotation(0)
    }
    const handleRotate = () => setRotation((r) => (r + 90) % 360)

    return (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={() => {
                    setActiveIndex(0)
                    setOpen(true)
                    if (list[0]?.url) {
                        fetchImageBlob(list[0].url)
                    }
                }}
                className="inline-flex items-center gap-2 rounded-[6px] border border-clinic-info-border bg-clinic-surface-alt px-3.5 py-2 text-xs font-bold text-clinic-navy transition-colors hover:bg-clinic-surface-tint cursor-pointer"
            >
                <ClinicIcon name="Eye" size={16} weight="bold" className="text-clinic-cta" />
                <span className="tabular-nums">Xem ảnh kết quả ({list.length})</span>
            </button>

            <Modal
                open={open}
                onCancel={() => {
                    setOpen(false)
                    setIsFullscreen(false)
                }}
                footer={null}
                width={isFullscreen ? '98vw' : 1120}
                centered
                className="!max-w-[95vw]"
                title={
                    <div className="flex flex-wrap items-center justify-between gap-3 pr-8 text-clinic-navy">
                        <div className="flex items-center gap-2">
                            <ClinicIcon name="Scan" size={18} weight="duotone" className="text-clinic-cta" />
                            <span className="font-bold text-sm tabular-nums">
                                {serviceName} · {currentFile?.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 rounded-[6px] border border-clinic-border bg-clinic-bg p-1 text-xs">
                            <button
                                type="button"
                                onClick={handleZoomOut}
                                className="inline-flex items-center justify-center rounded-[4px] px-2 py-1 text-clinic-navy hover:bg-clinic-surface transition cursor-pointer"
                                title="Thu nhỏ"
                                aria-label="Thu nhỏ ảnh"
                            >
                                <ClinicIcon name="MinusCircle" size={14} weight="bold" />
                            </button>
                            <span className="min-w-[44px] text-center text-[11px] font-bold text-clinic-text-secondary tabular-nums">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={handleZoomIn}
                                className="inline-flex items-center justify-center rounded-[4px] px-2 py-1 text-clinic-navy hover:bg-clinic-surface transition cursor-pointer"
                                title="Phóng to"
                                aria-label="Phóng to ảnh"
                            >
                                <ClinicIcon name="Plus" size={14} weight="bold" />
                            </button>
                            <button
                                type="button"
                                onClick={handleRotate}
                                className="inline-flex items-center justify-center rounded-[4px] px-2 py-1 text-clinic-navy hover:bg-clinic-surface transition cursor-pointer"
                                title="Xoay 90 độ"
                                aria-label="Xoay ảnh 90 độ"
                            >
                                <ClinicIcon name="ArrowsClockwise" size={14} weight="bold" />
                            </button>
                            <button
                                type="button"
                                onClick={handleResetView}
                                className="inline-flex items-center justify-center rounded-[4px] px-2 py-1 text-clinic-navy hover:bg-clinic-surface transition cursor-pointer"
                                title="Đặt lại kích thước 100%"
                                aria-label="Đặt lại ảnh 100%"
                            >
                                <ClinicIcon name="ArrowCounterClockwise" size={14} weight="bold" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsFullscreen((prev) => !prev)}
                                className="inline-flex items-center justify-center rounded-[4px] px-2 py-1 text-clinic-navy hover:bg-clinic-surface transition cursor-pointer"
                                title={isFullscreen ? 'Thu gọn khung xem' : 'Toàn màn hình'}
                                aria-label={isFullscreen ? 'Thu gọn khung xem' : 'Xem toàn màn hình'}
                            >
                                <ClinicIcon name={isFullscreen ? 'ArrowsIn' : 'ArrowsOut'} size={14} weight="bold" />
                            </button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-4 pt-2">
                    <div
                        className={`flex items-center justify-center overflow-auto rounded-[8px] bg-clinic-navy-dark p-4 ${
                            isFullscreen ? 'min-h-[75vh] max-h-[82vh]' : 'min-h-[420px] max-h-[68vh]'
                        }`}
                    >
                        {isLoading && (
                            <div className="text-xs font-semibold text-clinic-on-navy-muted">
                                Đang tải hình ảnh chuẩn PACS...
                            </div>
                        )}
                        {!isLoading && hasError && (
                            <div className="text-center space-y-2">
                                <p className="text-xs text-clinic-danger font-semibold">
                                    Không thể tải hình ảnh kết quả.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (currentFile?.url) {
                                            inFlightRef.current[currentFile.url] = false
                                            setErrorUrl(null)
                                            setBlobUrls((prev) => {
                                                const next = { ...prev }
                                                delete next[currentFile.url]
                                                return next
                                            })
                                            fetchImageBlob(currentFile.url, true)
                                        }
                                    }}
                                    className="medpro-btn-primary text-xs px-3 py-1.5 cursor-pointer"
                                >
                                    Thử tải lại ảnh
                                </button>
                            </div>
                        )}
                        {!isLoading && !hasError && currentBlobUrl && (
                            <img
                                src={currentBlobUrl}
                                alt={serviceName}
                                onError={() => setErrorUrl(currentFile.url)}
                                style={{
                                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                }}
                                className="max-h-[64vh] w-auto rounded-[6px] object-contain transition-transform duration-150"
                            />
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {list.length > 1 &&
                                list.map((item, idx) => (
                                    <button
                                        key={item.url}
                                        type="button"
                                        onClick={() => setActiveIndex(idx)}
                                        className={`rounded-[6px] px-3 py-1.5 text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                                            idx === activeIndex
                                                ? 'bg-clinic-navy text-clinic-surface'
                                                : 'bg-clinic-bg-muted text-clinic-text-secondary hover:text-clinic-navy'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                        </div>

                        <div className="flex items-center gap-2">
                            {currentBlobUrl && !hasError && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="medpro-btn-primary text-xs px-3.5 py-2 cursor-pointer inline-flex items-center gap-1.5"
                                >
                                    <ClinicIcon name="DownloadSimple" size={15} weight="bold" />
                                    <span>Tải ảnh gốc</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false)
                                    setIsFullscreen(false)
                                }}
                                className="medpro-btn-outline text-xs px-3.5 py-2 cursor-pointer"
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
