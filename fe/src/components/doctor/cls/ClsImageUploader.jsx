import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CaretLeft, CaretRight, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { clinicalService } from '../../../services/doctor/ClinicalService'
import { AppToast } from '../../common/AppNotification'
import { ClinicIcon } from '../../common/ClinicIcon'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGES = 10
const ACCEPTED = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] }
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4]

const apiError = (e) => e?.response?.data?.message || e?.message || 'Tải ảnh lên thất bại'

// Kiểm tra sơ bộ trên trình duyệt; máy chủ vẫn kiểm tra lại cả đuôi tệp, content-type và magic bytes
const validateFile = (file) => {
    const ext = `.${file.name.split('.').pop()}`.toLowerCase()
    if (!ACCEPTED[file.type]?.includes(ext)) return 'sai định dạng (chỉ nhận JPG, PNG; ảnh DICOM cần xuất sang JPG/PNG)'
    if (file.size > MAX_IMAGE_BYTES) return `vượt quá ${MAX_IMAGE_BYTES / 1024 / 1024} MB`
    if (file.size === 0) return 'tệp rỗng'
    return null
}

// Ảnh y tế cần Bearer token: tải về dạng blob rồi hiển thị bằng object URL, thu hồi khi không dùng nữa
function useAuthImage(url) {
    const [state, setState] = useState({ src: null, error: false })
    useEffect(() => {
        if (!url) return undefined
        let objectUrl = null
        let cancelled = false
        clinicalService
            .fetchClsImageBlob(url)
            .then((blob) => {
                if (cancelled) return
                objectUrl = URL.createObjectURL(blob)
                setState({ src: objectUrl, error: false })
            })
            .catch(() => !cancelled && setState({ src: null, error: true }))
        return () => {
            cancelled = true
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [url])
    return state
}

function AuthImage({ url, alt, className }) {
    const { src, error } = useAuthImage(url)
    if (error) {
        return (
            <div className={`flex items-center justify-center bg-slate-100 text-[11px] text-slate-500 ${className}`}>
                Không tải được ảnh
            </div>
        )
    }
    if (!src) return <div className={`animate-pulse bg-slate-200 ${className}`} />
    return <img src={src} alt={alt} className={className} draggable={false} />
}

// Xem ảnh toàn màn hình: phóng to/thu nhỏ (nút, cuộn chuột, phím +/-), kéo để di chuyển, chuyển ảnh trước/sau
function ImageLightbox({ urls, index, onIndex, onClose }) {
    const [zoom, setZoom] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const drag = useRef(null)
    const url = urls[index]

    const step = useCallback((dir) => {
        setZoom((z) => {
            const i = ZOOM_STEPS.findIndex((s) => s >= z - 0.001)
            const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))]
            if (next <= 1) setOffset({ x: 0, y: 0 })
            return next
        })
    }, [])

    const go = useCallback(
        (dir) => {
            if (urls.length < 2) return
            setZoom(1)
            setOffset({ x: 0, y: 0 })
            onIndex((index + dir + urls.length) % urls.length)
        },
        [index, onIndex, urls.length]
    )

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === '+' || e.key === '=') step(1)
            else if (e.key === '-') step(-1)
            else if (e.key === 'ArrowRight') go(1)
            else if (e.key === 'ArrowLeft') go(-1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [go, onClose, step])

    const startDrag = (e) => {
        if (zoom <= 1) return
        drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    }
    const moveDrag = (e) => {
        if (drag.current) setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })
    }

    const btn = 'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 cursor-pointer disabled:opacity-40'

    // Portal ra body để lớp phủ không bị transform/overflow của card cha giới hạn
    return createPortal(
        <div role="dialog" aria-modal="true" aria-label="Xem ảnh kết quả" className="fixed inset-0 z-[1000] flex flex-col bg-black/95">
            <div className="flex items-center gap-2 px-4 py-3 text-white">
                <span className="flex-1 text-[13px]">
                    Ảnh {index + 1}/{urls.length} · {Math.round(zoom * 100)}%
                </span>
                <button type="button" className={btn} onClick={() => step(-1)} disabled={zoom <= ZOOM_STEPS[0]} aria-label="Thu nhỏ">
                    <MagnifyingGlassMinus size={20} />
                </button>
                <button
                    type="button"
                    className="rounded-full bg-white/10 px-3 py-2 text-[12px] font-semibold text-white hover:bg-white/25 cursor-pointer"
                    onClick={() => {
                        setZoom(1)
                        setOffset({ x: 0, y: 0 })
                    }}
                >
                    Vừa khung
                </button>
                <button type="button" className={btn} onClick={() => step(1)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="Phóng to">
                    <MagnifyingGlassPlus size={20} />
                </button>
                <button type="button" className={btn} onClick={onClose} aria-label="Đóng">
                    <ClinicIcon name="X" size={20} />
                </button>
            </div>
            <div
                className={`relative flex flex-1 items-center justify-center overflow-hidden ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                onWheel={(e) => step(e.deltaY < 0 ? 1 : -1)}
                onMouseDown={startDrag}
                onMouseMove={moveDrag}
                onMouseUp={() => (drag.current = null)}
                onMouseLeave={() => (drag.current = null)}
            >
                <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }} className="transition-transform duration-100">
                    <AuthImage key={url} url={url} alt={`Ảnh kết quả ${index + 1}`} className="max-h-[80vh] max-w-[90vw] min-h-[200px] min-w-[200px] select-none object-contain" />
                </div>
                {urls.length > 1 && (
                    <>
                        <button type="button" className={`${btn} absolute left-4`} onClick={() => go(-1)} aria-label="Ảnh trước">
                            <CaretLeft size={20} />
                        </button>
                        <button type="button" className={`${btn} absolute right-4`} onClick={() => go(1)} aria-label="Ảnh sau">
                            <CaretRight size={20} />
                        </button>
                    </>
                )}
            </div>
        </div>,
        document.body
    )
}

// Lưới ảnh thu nhỏ, bấm để xem phóng to; dùng cả ở bàn KTV và màn xem kết quả của bác sĩ
export function ClsImageGallery({ urls, onDelete, deleting, className = '' }) {
    const [viewing, setViewing] = useState(null)
    if (!urls?.length) return null
    return (
        <>
            <ul className={`grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 ${className}`}>
                {urls.map((url, i) => (
                    <li key={url} className="group relative">
                        <button
                            type="button"
                            onClick={() => setViewing(i)}
                            className="block w-full overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-200 cursor-zoom-in"
                            aria-label={`Xem phóng to ảnh ${i + 1}`}
                        >
                            <AuthImage url={url} alt={`Ảnh kết quả ${i + 1}`} className="aspect-square w-full object-cover" />
                        </button>
                        {onDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(url)}
                                disabled={deleting === url}
                                aria-label={`Xóa ảnh ${i + 1}`}
                                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rose-600 shadow transition hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                            >
                                <ClinicIcon name="Trash" size={14} />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            {viewing !== null && <ImageLightbox urls={urls} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />}
        </>
    )
}

// Kéo-thả / chọn nhiều ảnh JPG/PNG, tải lên ngay từng ảnh có thanh tiến trình
export default function ClsImageUploader({ orderId, urls, onChange, disabled, disabledHint }) {
    const [dragOver, setDragOver] = useState(false)
    const [uploads, setUploads] = useState([])
    const [errors, setErrors] = useState([])
    const [deleting, setDeleting] = useState(null)
    const inputRef = useRef(null)
    // Nhiều ảnh tải lên song song: giữ danh sách mới nhất để mỗi ảnh xong thì nối thêm, không ghi đè nhau
    const urlsRef = useRef(urls)
    useEffect(() => {
        urlsRef.current = urls
    }, [urls])

    const remaining = MAX_IMAGES - urls.length - uploads.length

    const handleFiles = async (fileList) => {
        if (disabled) return
        const files = Array.from(fileList || [])
        if (!files.length) return
        const problems = []
        const valid = []
        files.forEach((f) => {
            const err = validateFile(f)
            if (err) problems.push(`${f.name}: ${err}`)
            else valid.push(f)
        })
        if (valid.length > remaining) {
            valid.splice(Math.max(remaining, 0)).forEach((f) => problems.push(`${f.name}: vượt quá tối đa ${MAX_IMAGES} ảnh/ca`))
        }
        setErrors(problems)

        const jobs = valid.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, progress: 0 }))
        setUploads((u) => [...u, ...jobs])
        await Promise.all(
            jobs.map(async (job) => {
                try {
                    const res = await clinicalService.uploadClsImage(orderId, job.file, (progress) =>
                        setUploads((u) => u.map((x) => (x.key === job.key ? { ...x, progress } : x)))
                    )
                    const url = res?.data?.data?.url
                    if (url) {
                        urlsRef.current = [...urlsRef.current, url]
                        onChange(urlsRef.current)
                    }
                } catch (e) {
                    setErrors((errs) => [...errs, `${job.file.name}: ${apiError(e)}`])
                } finally {
                    setUploads((u) => u.filter((x) => x.key !== job.key))
                }
            })
        )
    }

    const handleDelete = async (url) => {
        if (!window.confirm('Xóa ảnh này khỏi kết quả?')) return
        setDeleting(url)
        try {
            await clinicalService.deleteClsImage(url)
            urlsRef.current = urlsRef.current.filter((u) => u !== url)
            onChange(urlsRef.current)
        } catch (e) {
            AppToast.error(apiError(e))
        } finally {
            setDeleting(null)
        }
    }

    const onDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
    }

    const blocked = disabled || remaining <= 0

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
                <span className="medpro-label !mb-0">Ảnh kết quả</span>
                <span className="text-[11px] text-slate-500">
                    {urls.length}/{MAX_IMAGES} ảnh
                </span>
            </div>

            <div
                role="button"
                tabIndex={blocked ? -1 : 0}
                aria-disabled={blocked}
                aria-label="Kéo thả hoặc chọn ảnh kết quả để tải lên"
                onClick={() => !blocked && inputRef.current?.click()}
                onKeyDown={(e) => {
                    if (blocked || (e.key !== 'Enter' && e.key !== ' ')) return
                    e.preventDefault()
                    inputRef.current?.click()
                }}
                onDragOver={(e) => {
                    e.preventDefault()
                    if (!blocked) setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center text-[12px] transition ${
                    blocked
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                        : dragOver
                          ? 'cursor-copy border-[#00B5F1] bg-[#E8F4FD] text-[#003553]'
                          : 'cursor-pointer border-slate-300 text-slate-500 hover:border-[#00B5F1] hover:bg-[#F5F9FC]'
                }`}
            >
                <ClinicIcon name="UploadSimple" size={24} />
                <span className="font-semibold">
                    {disabled ? disabledHint : remaining <= 0 ? `Đã đủ ${MAX_IMAGES} ảnh` : 'Kéo thả ảnh vào đây hoặc bấm để chọn'}
                </span>
                <span>JPG, PNG (ảnh xem trước xuất từ máy siêu âm / X-quang) · tối đa 10 MB/ảnh</span>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                        handleFiles(e.target.files)
                        e.target.value = ''
                    }}
                />
            </div>

            {errors.length > 0 && (
                <div role="alert" className="flex flex-col gap-1 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                    <span className="flex items-center gap-1.5 font-semibold">
                        <ClinicIcon name="WarningCircle" size={14} /> Không tải lên được {errors.length} tệp
                    </span>
                    {errors.map((msg) => (
                        <span key={msg}>· {msg}</span>
                    ))}
                </div>
            )}

            {uploads.length > 0 && (
                <ul className="flex flex-col gap-2" aria-label="Ảnh đang tải lên">
                    {uploads.map((u) => (
                        <li key={u.key} className="flex flex-col gap-1 text-[12px]">
                            <span className="flex justify-between gap-2">
                                <span className="truncate">{u.file.name}</span>
                                <span className="text-slate-500">{u.progress}%</span>
                            </span>
                            <span className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                <span className="block h-full rounded-full bg-[#00B5F1] transition-all" style={{ width: `${u.progress}%` }} />
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <ClsImageGallery urls={urls} onDelete={disabled ? null : handleDelete} deleting={deleting} />
        </div>
    )
}
