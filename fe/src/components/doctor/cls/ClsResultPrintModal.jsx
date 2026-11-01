import { useEffect, useRef, useState } from 'react'
import { Modal } from 'antd'
import { clinicalService } from '../../../services/doctor/ClinicalService'
import { ClinicIcon } from '../../common/ClinicIcon'
import { LoadingBlock, ErrorBlock } from '../clinical/StateBlocks'

const PAPER_SIZES = [
    { key: 'A4', label: 'A4 (210 × 297 mm)', width: '210mm', margin: '12mm 14mm' },
    { key: 'A5', label: 'A5 (148 × 210 mm)', width: '148mm', margin: '8mm 9mm' },
]

const TITLE_BY_GROUP = {
    XET_NGHIEM: 'PHIẾU KẾT QUẢ XÉT NGHIỆM',
    CDHA: 'PHIẾU KẾT QUẢ CHẨN ĐOÁN HÌNH ẢNH',
    TDCN: 'PHIẾU KẾT QUẢ THĂM DÒ CHỨC NĂNG',
    NOI_SOI: 'PHIẾU KẾT QUẢ NỘI SOI',
}

const PHAN_LOAI_LABEL = { BINH_THUONG: 'Bình thường', BAT_THUONG: 'Bất thường', NGUY_KICH: 'Nguy kịch' }
const ARROW = { CAO: '↑', THAP: '↓' }

// CSS riêng của phiếu (không dùng Tailwind) để bản xem trước và bản in trong iframe giống hệt nhau
const SHEET_CSS = `
.cls-sheet { box-sizing: border-box; background: #fff; color: #111; font-family: 'Times New Roman', Times, serif; font-size: 12.5px; line-height: 1.4; }
.cls-sheet * { box-sizing: border-box; }
.cls-sheet.a5 { font-size: 10.5px; }
.cls-sheet .hdr { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 6px; }
.cls-sheet .hdr .org { text-transform: uppercase; }
.cls-sheet .hdr .org .agency { font-size: .85em; }
.cls-sheet .hdr .org .name { font-weight: 700; font-size: 1.05em; }
.cls-sheet .hdr .org .addr { text-transform: none; font-size: .85em; }
.cls-sheet .hdr .code { text-align: right; font-size: .9em; white-space: nowrap; }
.cls-sheet .hdr .code b { font-family: 'Courier New', monospace; }
.cls-sheet h1 { text-align: center; font-size: 1.45em; margin: 10px 0 0; letter-spacing: .5px; }
.cls-sheet .svc { text-align: center; font-style: italic; margin: 2px 0 8px; }
.cls-sheet .info { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 14px; margin-bottom: 8px; }
.cls-sheet .info .full { grid-column: 1 / -1; }
.cls-sheet .info .k { color: #333; }
.cls-sheet .pname { text-transform: uppercase; font-weight: 700; }
.cls-sheet table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
.cls-sheet th, .cls-sheet td { border: 1px solid #555; padding: 3px 5px; text-align: left; vertical-align: top; }
.cls-sheet th { background: #eee; font-weight: 700; }
.cls-sheet td.num { text-align: center; width: 2.2em; }
.cls-sheet td.val { text-align: right; white-space: nowrap; }
.cls-sheet tr.abn td.val, .cls-sheet tr.abn td.flag { font-weight: 700; }
.cls-sheet td.flag { text-align: center; width: 3em; }
.cls-sheet .legend { font-size: .85em; font-style: italic; }
.cls-sheet .sec { margin: 6px 0; }
.cls-sheet .sec .lbl { font-weight: 700; text-transform: uppercase; font-size: .92em; }
.cls-sheet .sec p { margin: 2px 0 0; white-space: pre-line; }
.cls-sheet .concl p { font-weight: 700; }
.cls-sheet .imgs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 6px 0; }
.cls-sheet .imgs img { width: 100%; height: 62mm; object-fit: contain; background: #000; border: 1px solid #555; }
.cls-sheet.a5 .imgs img { height: 40mm; }
.cls-sheet .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; text-align: center; page-break-inside: avoid; }
.cls-sheet .sign .role { font-weight: 700; text-transform: uppercase; }
.cls-sheet .sign .hint { font-style: italic; font-size: .85em; }
.cls-sheet .sign .stamp { margin: 6px auto; display: inline-block; border: 1.5px solid #0b6b3a; color: #0b6b3a; border-radius: 4px; padding: 2px 8px; font-size: .85em; font-weight: 700; }
.cls-sheet .sign .who { font-weight: 700; margin-top: 4px; }
.cls-sheet .foot { margin-top: 10px; border-top: 1px dashed #777; padding-top: 3px; font-size: .8em; color: #444; display: flex; justify-content: space-between; gap: 8px; }
`

const pageCss = (paper) => `@page { size: ${paper.key}; margin: ${paper.margin}; } html, body { margin: 0; background: #fff; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`

const fmtDateTime = (value) =>
    value
        ? new Intl.DateTimeFormat('vi-VN', {
              timeZone: 'Asia/Ho_Chi_Minh',
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
          }).format(new Date(value))
        : '—'

const signDateLine = (value) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
            .formatToParts(new Date(value))
            .map((p) => [p.type, p.value])
    )
    return `${parts.hour}:${parts.minute}, ngày ${parts.day} tháng ${parts.month} năm ${parts.year}`
}

const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })

function LabTable({ rows }) {
    return (
        <>
            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Tên xét nghiệm</th>
                        <th style={{ textAlign: 'right' }}>Kết quả</th>
                        <th>Cờ</th>
                        <th>Đơn vị</th>
                        <th>Khoảng tham chiếu</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r.ma} className={r.bat_thuong ? 'abn' : ''}>
                            <td className="num">{i + 1}</td>
                            <td>
                                {r.ten} ({r.ma})
                            </td>
                            <td className="val">{r.gia_tri}</td>
                            <td className="flag">
                                {r.bat_thuong ? `${ARROW[r.huong] || ''}${r.danh_gia === 'NGUY_HIEM' ? ' (!)' : ''}` : ''}
                            </td>
                            <td>{r.don_vi}</td>
                            <td>{r.khoang_tham_chieu || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="legend">Giá trị in đậm: ngoài khoảng tham chiếu; ↑ cao hơn, ↓ thấp hơn; (!) vượt ngưỡng nguy hiểm.</div>
        </>
    )
}

// Phiếu kết quả CLS theo mẫu phiếu y tế: tiêu đề cơ sở, hành chính bệnh nhân, kết quả, chân ký KTV + thời gian
function ReportSheet({ report: r, images, paper, printedAt }) {
    const lab = r.loai_phieu === 'XET_NGHIEM'
    const bn = r.benh_nhan
    const namSinh = bn.ngay_sinh ? new Date(bn.ngay_sinh).getFullYear() : null
    return (
        <div className={`cls-sheet ${paper.key === 'A5' ? 'a5' : ''}`}>
            <div className="hdr">
                <div className="org">
                    <div className="agency">{r.phong_kham.co_quan_chu_quan}</div>
                    <div className="name">{r.phong_kham.ten}</div>
                    <div className="addr">
                        {r.phong_kham.dia_chi} · ĐT: {r.phong_kham.dien_thoai}
                    </div>
                </div>
                <div className="code">
                    <div>
                        Số phiếu: <b>{r.ma_phieu}</b>
                    </div>
                    <div>Mã BN: {bn.ma_benh_nhan || '—'}</div>
                    <div>Mã chỉ định: {r.chi_dinh_id}</div>
                </div>
            </div>

            <h1>{TITLE_BY_GROUP[r.nhom_dich_vu] || 'PHIẾU KẾT QUẢ CẬN LÂM SÀNG'}</h1>
            <div className="svc">{r.ten_dich_vu}</div>

            <div className="info">
                <div>
                    <span className="k">Họ và tên: </span>
                    <span className="pname">{bn.ho_ten}</span>
                </div>
                <div>
                    <span className="k">Năm sinh: </span>
                    {namSinh || '—'}
                    {bn.tuoi != null && ` (${bn.tuoi} tuổi)`}
                    <span className="k"> · Giới tính: </span>
                    {bn.gioi_tinh || '—'}
                </div>
                <div className="full">
                    <span className="k">Địa chỉ: </span>
                    {bn.dia_chi || '—'}
                    {bn.so_dien_thoai && <span className="k"> · SĐT: </span>}
                    {bn.so_dien_thoai}
                </div>
                <div>
                    <span className="k">Bác sĩ chỉ định: </span>
                    {r.bac_si_chi_dinh || '—'}
                </div>
                <div>
                    <span className="k">Thời gian chỉ định: </span>
                    {fmtDateTime(r.thoi_gian_chi_dinh)}
                </div>
                <div className="full">
                    <span className="k">Chẩn đoán sơ bộ: </span>
                    {r.chan_doan_so_bo || r.ly_do_vao_kham || '—'}
                </div>
                <div>
                    <span className="k">{lab ? 'Thời gian lấy mẫu: ' : 'Thời gian thực hiện: '}</span>
                    {fmtDateTime(lab ? r.thoi_gian_lay_mau : r.thoi_gian_thuc_hien)}
                </div>
                <div>
                    <span className="k">Phân loại: </span>
                    {PHAN_LOAI_LABEL[r.ket_qua_phan_loai] || '—'}
                </div>
                {!lab && r.thiet_bi_thuc_hien && (
                    <div className="full">
                        <span className="k">Thiết bị: </span>
                        {r.thiet_bi_thuc_hien}
                    </div>
                )}
            </div>

            {lab ? (
                <LabTable rows={r.chi_tiet} />
            ) : (
                <>
                    {images.length > 0 && (
                        <div className="imgs">
                            {images.map((src, i) => (
                                <img key={i} src={src} alt={`Ảnh kết quả ${i + 1}`} />
                            ))}
                        </div>
                    )}
                    <div className="sec">
                        <div className="lbl">Mô tả</div>
                        <p>{r.mo_ta_hinh_anh || '—'}</p>
                    </div>
                </>
            )}

            <div className="sec concl">
                <div className="lbl">Kết luận</div>
                <p>{r.ket_luan || '—'}</p>
            </div>
            {r.de_nghi && (
                <div className="sec">
                    <div className="lbl">Đề nghị</div>
                    <p>{r.de_nghi}</p>
                </div>
            )}
            {r.ghi_chu && (
                <div className="sec">
                    <div className="lbl">Ghi chú</div>
                    <p>{r.ghi_chu}</p>
                </div>
            )}

            <div className="sign">
                <div>
                    <div className="hint">&nbsp;</div>
                    <div className="role">Người thực hiện</div>
                    <div className="hint">(Ký, ghi rõ họ tên)</div>
                    <div style={{ height: paper.key === 'A5' ? '10mm' : '16mm' }} />
                    <div className="who">{r.ky_thuat_vien_thuc_hien || '—'}</div>
                </div>
                <div>
                    <div className="hint">{signDateLine(r.thoi_gian_duyet)}</div>
                    <div className="role">Kỹ thuật viên duyệt kết quả</div>
                    <div className="hint">(Ký, ghi rõ họ tên)</div>
                    <div className="stamp">ĐÃ DUYỆT ĐIỆN TỬ · {fmtDateTime(r.thoi_gian_duyet)}</div>
                    <div className="who">{r.nguoi_duyet.ho_ten || '—'}</div>
                </div>
            </div>

            <div className="foot">
                <span>{lab ? 'Kết quả chỉ có giá trị trên mẫu bệnh phẩm được xét nghiệm.' : 'Kết quả cần được bác sĩ đối chiếu lâm sàng.'}</span>
                <span>In lúc {fmtDateTime(printedAt)}</span>
            </div>
        </div>
    )
}

// Modal in phiếu kết quả CLS đã duyệt, chọn khổ A4/A5; in qua iframe riêng để chỉ có phiếu trên giấy
export default function ClsResultPrintModal({ orderId, open, onClose }) {
    const [paperKey, setPaperKey] = useState('A4')
    const [report, setReport] = useState(null)
    const [images, setImages] = useState([])
    const [error, setError] = useState(null)
    const [reloadKey, setReloadKey] = useState(0)
    const [printedAt] = useState(() => new Date().toISOString())
    const sheetRef = useRef(null)
    const paper = PAPER_SIZES.find((p) => p.key === paperKey)

    useEffect(() => {
        if (!open || !orderId) return undefined
        let cancelled = false
        clinicalService
            .getClsReport(orderId)
            .then(async (data) => {
                // Ảnh y tế cần token nên tải blob rồi nhúng dạng data URL (iframe in không gửi được Bearer token)
                const urls = data.loai_phieu === 'XET_NGHIEM' ? [] : data.tep_dinh_kem_urls || []
                const embedded = await Promise.all(
                    urls.map((u) =>
                        clinicalService
                            .fetchClsImageBlob(u)
                            .then(blobToDataUrl)
                            .catch(() => null)
                    )
                )
                if (cancelled) return
                setImages(embedded.filter(Boolean))
                setReport(data)
            })
            .catch((e) => !cancelled && setError(e?.response?.data?.message || e?.message || 'Không tải được phiếu kết quả'))
        return () => {
            cancelled = true
        }
    }, [open, orderId, reloadKey])

    const print = () => {
        const sheet = sheetRef.current
        if (!sheet) return
        const iframe = document.createElement('iframe')
        iframe.setAttribute('aria-hidden', 'true')
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
        document.body.appendChild(iframe)
        const doc = iframe.contentDocument
        doc.open()
        doc.write(
            `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${report.ma_phieu}</title>` +
                `<style>${SHEET_CSS}${pageCss(paper)}</style></head><body>${sheet.outerHTML}</body></html>`
        )
        doc.close()
        const cleanup = () => setTimeout(() => iframe.remove(), 500)
        iframe.contentWindow.addEventListener('afterprint', cleanup)
        const pending = [...doc.images].filter((img) => !img.complete)
        const loaded = pending.map(
            (img) =>
                new Promise((resolve) => {
                    img.onload = resolve
                    img.onerror = resolve
                })
        )
        Promise.all(loaded).then(() => {
            iframe.contentWindow.focus()
            iframe.contentWindow.print()
        })
    }

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={980}
            title={
                <span className="flex items-center gap-2">
                    <ClinicIcon name="Printer" size={18} /> In phiếu kết quả cận lâm sàng
                </span>
            }
            footer={
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" className="medpro-btn-outline" onClick={onClose}>
                        Đóng
                    </button>
                    <button type="button" className="medpro-btn-primary" onClick={print} disabled={!report}>
                        <ClinicIcon name="Printer" size={16} weight="bold" /> In khổ {paperKey}
                    </button>
                </div>
            }
            destroyOnHidden
        >
            <div className="mb-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Khổ giấy">
                <span className="text-[13px] text-slate-600">Khổ giấy:</span>
                {PAPER_SIZES.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        role="radio"
                        aria-checked={paperKey === p.key}
                        onClick={() => setPaperKey(p.key)}
                        className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition cursor-pointer ${
                            paperKey === p.key ? 'bg-[#003553] text-white' : 'bg-[#E8F4FD] text-[#003553]'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            {error && (
                <ErrorBlock
                    message={error}
                    onRetry={() => {
                        setError(null)
                        setReloadKey((k) => k + 1)
                    }}
                />
            )}
            {!error && !report && <LoadingBlock />}
            {report && (
                <div className="max-h-[70vh] overflow-auto rounded-xl bg-slate-200 p-4">
                    <style>{SHEET_CSS}</style>
                    <div
                        className="mx-auto bg-white shadow-md"
                        style={{ width: paper.width, minHeight: paperKey === 'A4' ? '297mm' : '210mm', padding: paper.margin }}
                    >
                        <div ref={sheetRef}>
                            <ReportSheet report={report} images={images} paper={paper} printedAt={printedAt} />
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    )
}
