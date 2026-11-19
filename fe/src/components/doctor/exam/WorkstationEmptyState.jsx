import React from 'react'

export default function WorkstationEmptyState({ queue }) {
    const waitingCount = queue.filter((ticket) =>
        ['cho_kham', 'dang_kham'].includes(ticket.trang_thai)
    ).length
    const pendingClsCount = queue.filter((ticket) => ticket.trang_thai === 'tam_hoan').length
    const clsReadyCount = queue.filter(
        (ticket) =>
            ticket.trang_thai === 'co_ket_qua_cls' ||
            (ticket.ghi_chu && ticket.ghi_chu.toLowerCase().includes('kết quả'))
    ).length

    return (
        <div className="medpro-card p-6 bg-clinic-surface rounded-[6px] border border-clinic-border space-y-5">
            <div className="border-b border-clinic-border pb-3">
                <h2 className="text-base font-extrabold text-clinic-navy">
                    Thông tin Ca trực &amp; Quy trình Bàn khám ngoại trú
                </h2>
                <p className="text-xs text-clinic-text-secondary mt-1">
                    Chưa có hồ sơ bệnh án đang mở. Chọn một lượt khám ở cột Hàng đợi bên trái hoặc nhấn phím F2 để tiếp nhận ca kế tiếp.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-clinic-border border border-clinic-border rounded-[6px] tabular-nums">
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">
                        Chờ khám lâm sàng
                    </span>
                    <p className="text-2xl font-display font-extrabold text-clinic-navy mt-1">
                        {waitingCount} lượt
                    </p>
                </div>
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">
                        Đang chờ kết quả CLS
                    </span>
                    <p className={`text-2xl font-display font-extrabold mt-1 ${pendingClsCount > 0 ? 'text-clinic-warning' : 'text-clinic-navy'}`}>
                        {pendingClsCount} lượt
                    </p>
                </div>
                <div className="p-4">
                    <span className="text-xs font-semibold text-clinic-text-secondary">
                        Đã có kết quả CLS
                    </span>
                    <p className={`text-2xl font-display font-extrabold mt-1 ${clsReadyCount > 0 ? 'text-clinic-success' : 'text-clinic-navy'}`}>
                        {clsReadyCount} lượt
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
                <div className="rounded-[6px] bg-clinic-bg border border-clinic-border p-4 space-y-2">
                    <h3 className="font-bold text-clinic-navy">Phím tắt thao tác bàn khám</h3>
                    <dl className="space-y-1.5 text-clinic-text-secondary">
                        <div className="flex items-center justify-between gap-3">
                            <dt>Gọi bệnh nhân ưu tiên kế tiếp</dt>
                            <dd>
                                <kbd className="px-2 py-0.5 rounded-[4px] bg-clinic-surface border border-clinic-border-strong font-mono text-[11px] font-bold text-clinic-navy">
                                    F2
                                </kbd>
                            </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <dt>Đóng hồ sơ bệnh án đang mở</dt>
                            <dd>
                                <kbd className="px-2 py-0.5 rounded-[4px] bg-clinic-surface border border-clinic-border-strong font-mono text-[11px] font-bold text-clinic-navy">
                                    Esc
                                </kbd>
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="rounded-[6px] bg-clinic-bg border border-clinic-border p-4 space-y-1.5">
                    <h3 className="font-bold text-clinic-navy">Quy chuẩn Bệnh án điện tử TT 32/2023/TT-BYT</h3>
                    <p className="text-clinic-text-secondary leading-5">
                        Sau khi hoàn tất chẩn đoán ICD-10 và phát hành đơn thuốc điện tử, hồ sơ tự động khóa để bảo toàn dữ liệu; mọi bổ sung phát sinh được lập qua biên bản đính chính.
                    </p>
                </div>
            </div>
        </div>
    )
}
