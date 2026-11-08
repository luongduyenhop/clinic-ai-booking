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
                className="inline-flex items-center gap-2 rounded-xl border border-[#00B5F1]/40 bg-[#F0F9FF] px-3.5 py-2 text-xs font-bold text-[#003553] shadow-2xs transition hover:bg-[#E0F2FE] hover:border-[#00B5F1] cursor-pointer"
            >
                <Eye size={16} weight="bold" className="text-[#00B5F1]" />
                <span>Xem ảnh kết quả ({list.length})</span>
            </button>

            <Modal
                open={open}
                onCancel={() => setOpen(false)}
                footer={null}
                width={760}
                centered
                title={
                    <div className="flex items-center gap-2 text-[#003553]">
                        <Scan size={18} weight="duotone" className="text-[#00B5F1]" />
                        <span className="font-bold text-sm">{serviceName} · {currentFile?.label}</span>
                    </div>
                }
            >
                <div className="space-y-4 pt-2">
                    <div className="flex min-h-[340px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-950/95 p-4">
                        {isLoading && (
                            <div className="text-xs font-semibold text-sky-200 animate-pulse">
                                Đang tải hình ảnh chuẩn PACS...
                            </div>
                        )}
                        {!isLoading && hasError && (
                            <div className="text-center space-y-2">
                                <p className="text-xs text-rose-300 font-semibold">Không thể tải hình ảnh kết quả.</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (currentFile?.url) {
                                            inFlightRef.current[currentFile.url] = false
                                            fetchImageBlob(currentFile.url)
                                        }
                                    }}
                                    className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                                >
                                    Thử tải lại
                                </button>
                            </div>
                        )}
                        {!isLoading && !hasError && currentBlobUrl && (
                            <img
                                src={currentBlobUrl}
                                alt={serviceName}
                                className="max-h-[480px] w-auto rounded-lg object-contain shadow-lg"
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
                                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                                            idx === activeIndex
                                                ? 'bg-[#003553] text-white'
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
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#00B5F1] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#009ED4] cursor-pointer"
                                >
                                    <DownloadSimple size={15} weight="bold" />
                                    <span>Tải ảnh gốc</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
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
