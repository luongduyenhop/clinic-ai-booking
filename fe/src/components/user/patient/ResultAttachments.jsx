import { useState, useEffect, useRef } from 'react'
import { Modal } from 'antd'
import { http } from '../../../services/BaseService'
import { Eye, DownloadSimple, Scan } from '../../common/ClinicIcon'

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
    const inFlightRef = useRef({})

    const fetchImageBlob = (targetUrl) => {
        if (!targetUrl || blobUrls[targetUrl] || inFlightRef.current[targetUrl]) return
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
                setErrorUrl(targetUrl)
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
    }, [open, activeIndex])

    if (!list.length) return null

    const currentFile = list[activeIndex] || list[0]
    const currentBlobUrl = currentFile ? blobUrls[currentFile.url] : null
    const isLoading = Boolean(currentFile && loadingUrl === currentFile.url && !currentBlobUrl)
    const hasError = Boolean(currentFile && errorUrl === currentFile.url && !currentBlobUrl)

    const handleDownload = () => {
        if (!currentBlobUrl) return
        const link = document.createElement('a')
        link.href = currentBlobUrl
        link.download = `anh-ket-qua-cls-${activeIndex + 1}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
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
                <Eye size={16} weight="bold" className="text-clinic-cta" />
                <span className="tabular-nums">Xem ảnh kết quả ({list.length})</span>
            </button>

            <Modal
                open={open}
                onCancel={() => setOpen(false)}
                footer={null}
                width={760}
                centered
                title={
                    <div className="flex items-center gap-2 text-clinic-navy">
                        <Scan size={18} weight="duotone" className="text-clinic-cta" />
                        <span className="font-bold text-sm tabular-nums">
                            {serviceName} · {currentFile?.label}
                        </span>
                    </div>
                }
            >
                <div className="space-y-4 pt-2">
                    <div className="flex min-h-[340px] items-center justify-center rounded-[8px] bg-clinic-navy-dark p-4">
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
                                            fetchImageBlob(currentFile.url)
                                        }
                                    }}
                                    className="medpro-btn-primary text-xs px-3 py-1.5 cursor-pointer"
                                >
                                    Thử tải lại
                                </button>
                            </div>
                        )}
                        {!isLoading && !hasError && currentBlobUrl && (
                            <img
                                src={currentBlobUrl}
                                width={720}
                                height={480}
                                alt={serviceName}
                                className="max-h-[480px] w-auto rounded-[6px] object-contain"
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
                            {currentBlobUrl && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="medpro-btn-primary text-xs px-3.5 py-2 cursor-pointer"
                                >
                                    <DownloadSimple size={15} weight="bold" />
                                    <span>Tải ảnh gốc</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
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
