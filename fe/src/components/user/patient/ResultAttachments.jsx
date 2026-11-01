import { Image } from 'antd'

export default function ResultAttachments({ files = [] }) {
    return <Image.PreviewGroup><div className="mt-4 grid gap-3 sm:grid-cols-2">{files.map((file) => {
        const isImage = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(file.url)
        return <div key={file.url} className="rounded-xl border border-[#B8E6F7] p-3">
            <p className="mb-2 truncate text-xs font-bold text-[#003553]">{file.ten_tep}</p>
            {isImage && <Image width={160} src={file.url} alt={file.ten_tep} preview={{ src: file.url }} />}
            {isImage && <p className="mt-2 text-xs text-slate-500">Chạm ảnh để xem, phóng to hoặc chuyển ảnh.</p>}
            <a href={file.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-[#007EAD]">Mở / tải bản gốc</a>
        </div>
    })}</div></Image.PreviewGroup>
}
