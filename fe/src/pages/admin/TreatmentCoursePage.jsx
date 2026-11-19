import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import {
    StatusBadge,
    ClipboardText,
    PlusCircle,
    MagnifyingGlass,
    CheckCircle,
} from '../../components/common/ClinicIcon'

export default function TreatmentCoursePage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const treatmentCourses = clinicData?.treatmentCourses || []

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeTab, setActiveTab] = useState(
        queryTab && ['LIEU_TRINH', 'LICH', 'BAI_TAP', 'BAO_CAO', 'HOA_DON'].includes(queryTab)
            ? queryTab
            : 'LIEU_TRINH'
    )

    useEffect(() => {
        if (queryTab && ['LIEU_TRINH', 'LICH', 'BAI_TAP', 'BAO_CAO', 'HOA_DON'].includes(queryTab)) {
            setActiveTab(queryTab)
        }
    }, [queryTab])

    const [searchText, setSearchText] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [selectedCourse, setSelectedCourse] = useState(treatmentCourses[0] || null)

    const exercisesList = useMemo(() => [
        {
            id: 'BT-01',
            maBT: 'BT_COT_SONG_01',
            tenBaiTap: 'Kéo giãn cột sống thắt lưng tư thế nằm',
            chuyenKhoa: 'Cột sống & Đĩa đệm',
            nhomCo: 'Cơ dựng sống thắt lưng, cơ mông lớn',
            thoiGian: '15 phút / lần',
            soLanNgay: '2 lần / ngày',
            mucDo: 'Cơ bản',
            huongDan: 'Nằm ngửa trên đệm cứng, hai gối gập 90 độ, dùng hai tay ôm sát hai đầu gối kéo nhẹ nhàng về phía ngực, giữ trong 10-15 giây rồi hạ từ từ.',
        },
        {
            id: 'BT-02',
            maBT: 'BT_KHOP_VAI_02',
            tenBaiTap: 'Tập vận động khớp vai con lắc Codman',
            chuyenKhoa: 'Khớp vai & Viêm chu vai',
            nhomCo: 'Cơ delta, chóp xoay vai',
            thoiGian: '10 phút / lần',
            soLanNgay: '3 lần / ngày',
            mucDo: 'Nhẹ nhàng',
            huongDan: 'Cúi gập người về phía trước 90 độ, tay đau buông thõng tự nhiên, đung đưa tay theo hình tròn từ nhỏ đến lớn giúp giải phóng chèn ép khoang dưới mỏm cùng.',
        },
        {
            id: 'BT-03',
            maBT: 'BT_KHOP_GOI_03',
            tenBaiTap: 'Gồng cơ tứ đầu đùi đẳng trường',
            chuyenKhoa: 'Thoái hóa khớp gối',
            nhomCo: 'Cơ tứ đầu đùi, gân bánh chè',
            thoiGian: '20 phút / lần',
            soLanNgay: '2 lần / ngày',
            mucDo: 'Trung bình',
            huongDan: 'Đặt khăn cuộn dưới khoeo chân, siết chặt cơ đùi ấn gối xuống khăn giữ 6 giây rồi thả lỏng. Giúp tăng độ vững khớp gối mà không gây ma sát sụn.',
        },
        {
            id: 'BT-04',
            maBT: 'BT_DOT_SONG_CO_04',
            tenBaiTap: 'Kéo giãn cơ cổ bên & Nghiêng đầu kháng lực',
            chuyenKhoa: 'Cột sống cổ & Hội chứng vai gáy',
            nhomCo: 'Cơ ức đòn chũm, cơ thang trên',
            thoiGian: '10 phút / lần',
            soLanNgay: '3 lần / ngày',
            mucDo: 'Cơ bản',
            huongDan: 'Ngồi thẳng lưng, một tay ôm đầu kéo nhẹ sang phía vai cùng bên cho đến khi căng cơ cổ, giữ 15 giây. Đổi bên lặp lại 5 hiệp.',
        },
    ], [])

    const courseSessions = useMemo(() => {
        if (!selectedCourse) return []
        const total = selectedCourse.tongSoBuoi || 10
        const completed = selectedCourse.soBuoiDaTap || 3
        return Array.from({ length: total }, (_, i) => {
            const buoiSo = i + 1
            const isDone = buoiSo <= completed
            const isNext = buoiSo === completed + 1
            return {
                buoiSo,
                ngayTap: `Buổi ${buoiSo} (Ngày ${10 + buoiSo}/10/2026)`,
                gioTap: '08:30 - 09:30',
                ktv: 'KTV. Trần Văn Long',
                trangThai: isDone ? 'Đã hoàn thành' : isNext ? 'Sắp diễn ra' : 'Chưa đến lịch',
                danhGia: isDone ? 'Đáp ứng tốt, giảm đau 40%' : '-',
            }
        })
    }, [selectedCourse])

    const filteredCourses = useMemo(() => {
        return treatmentCourses.filter((c) => {
            const matchSearch =
                !searchText ||
                c.tenBN?.toLowerCase().includes(searchText.toLowerCase()) ||
                c.maDangKy?.toLowerCase().includes(searchText.toLowerCase()) ||
                c.tenLieuTrinh?.toLowerCase().includes(searchText.toLowerCase())
            const matchStatus = statusFilter === 'ALL' || c.trangThai === statusFilter
            return matchSearch && matchStatus
        })
    }, [treatmentCourses, searchText, statusFilter])

    const handleCheckInSession = (course) => {
        if (course.soBuoiDaTap >= course.tongSoBuoi) {
            AppToast.warning(`Liệu trình của BN ${course.tenBN} đã hoàn thành toàn bộ ${course.tongSoBuoi} buổi!`)
            return
        }
        const updated = treatmentCourses.map((c) => {
            if (c.id === course.id) {
                const newCount = c.soBuoiDaTap + 1
                return {
                    ...c,
                    soBuoiDaTap: newCount,
                    trangThai: newCount === c.tongSoBuoi ? 'Hoàn thành' : 'Đang điều trị',
                }
            }
            return c
        })
        dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'treatmentCourses',
                items: updated,
                auditEntry: {
                    hanhDong: 'CHECKIN_TREATMENT_SESSION',
                    doiTuong: `${course.maLT || course.id} - ${course.tenBN}`,
                    mucDich: `Điểm danh buổi ${course.soBuoiDaTap + 1}/${course.tongSoBuoi}`,
                },
            })
        )
        AppToast.success(`Điểm danh thành công buổi ${course.soBuoiDaTap + 1}/${course.tongSoBuoi} cho BN ${course.tenBN}!`)
    }

    return (
        <div className="space-y-4">
            <div className="medpro-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-[6px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-cta flex items-center justify-center shrink-0">
                        <ClipboardText size={22} weight="duotone" />
                    </span>
                    <div>
                        <h1 className="font-display text-base font-extrabold text-clinic-navy tracking-tight flex flex-wrap items-center gap-2">
                            <span>Liệu trình Điều trị &amp; Phục hồi chức năng</span>
                            <span className="medpro-badge-info">
                                Vật lý trị liệu dài ngày
                            </span>
                        </h1>
                        <p className="text-xs text-clinic-text-secondary mt-0.5">
                            Quản lý phác đồ điều trị nhiều buổi, điểm danh ca tập, theo dõi lịch liệu trình và danh mục bài tập PHCN
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => AppToast.info('Vui lòng chọn bệnh nhân để chỉ định liệu trình!')}
                        className="medpro-btn-primary !py-2 !px-3.5 text-xs"
                    >
                        <PlusCircle size={15} weight="bold" />
                        <span>Kê đơn liệu trình mới</span>
                    </button>
                </div>
            </div>

            <div className="medpro-card p-2.5">
                <div className="inline-flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
                    {[
                        { id: 'LIEU_TRINH', label: '1. Danh sách liệu trình' },
                        { id: 'LICH', label: '2. Lịch liệu trình theo buổi' },
                        { id: 'BAI_TAP', label: '3. Danh mục bài tập PHCN' },
                        { id: 'BAO_CAO', label: '4. Báo cáo tiến độ hồi phục' },
                        { id: 'HOA_DON', label: '5. Hóa đơn liệu trình' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors duration-75 cursor-pointer whitespace-nowrap ${
                                activeTab === t.id
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'bg-transparent text-clinic-text-secondary hover:text-clinic-navy'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'LIEU_TRINH' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs font-extrabold text-clinic-navy uppercase tabular-nums">
                            CÁC CA ĐIỀU TRỊ LIỆU TRÌNH HIỆN HỮU ({filteredCourses.length})
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="medpro-input !py-1.5 h-9 !w-44 text-xs font-semibold truncate"
                            >
                                <option value="ALL">Tất cả trạng thái</option>
                                <option value="Đang điều trị">Đang điều trị</option>
                                <option value="Hoàn thành">Hoàn thành</option>
                            </select>
                            <div className="relative w-72">
                                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Tìm bệnh nhân, mã liệu trình..."
                                    className="medpro-input !py-1.5 h-9 !pl-8 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                            <thead>
                                <tr>
                                    <th>Mã ĐK</th>
                                    <th>Tên bệnh nhân</th>
                                    <th>Phác đồ / Liệu trình</th>
                                    <th>Bác sĩ chỉ định</th>
                                    <th>Tiến độ số buổi</th>
                                    <th>Lịch lặp lại</th>
                                    <th>Thành tiền</th>
                                    <th>Thanh toán</th>
                                    <th>Trạng thái</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCourses.map((c) => {
                                    const percent = Math.round(((c.soBuoiDaTap || 0) / (c.tongSoBuoi || 1)) * 100)
                                    return (
                                        <tr key={c.id}>
                                            <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">{c.maDangKy}</td>
                                            <td>
                                                <div className="font-bold text-clinic-navy">{c.tenBN}</div>
                                                <div className="text-[11px] text-clinic-text-muted font-mono">
                                                    {c.dienThoai} &bull; {c.tuoi}
                                                </div>
                                            </td>
                                            <td className="font-semibold text-clinic-text">
                                                <div>{c.tenLieuTrinh}</div>
                                                <div className="text-[11px] text-clinic-text-secondary font-normal mt-0.5">{c.baiTap}</div>
                                            </td>
                                            <td className="font-medium text-clinic-text-secondary">{c.bacSi}</td>
                                            <td>
                                                <div className="font-extrabold text-xs text-clinic-navy tabular-nums">
                                                    {c.soBuoiDaTap} / {c.tongSoBuoi} buổi ({percent}%)
                                                </div>
                                                <div className="w-28 bg-clinic-bg-muted rounded-[4px] h-1.5 mt-1 overflow-hidden border border-clinic-border">
                                                    <div
                                                        className="h-1.5 bg-clinic-cta rounded-[4px] transition-all"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    {(c.lichLapLai || []).map((day) => (
                                                        <span
                                                            key={day}
                                                            className="medpro-badge-info !px-1.5 !py-0.5 !text-[10px]"
                                                        >
                                                            {day}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="font-mono font-extrabold text-clinic-navy whitespace-nowrap">
                                                {(c.thanhTien || 0).toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="whitespace-nowrap">
                                                <span className="medpro-badge-success">
                                                    {c.thanhToan}
                                                </span>
                                            </td>
                                            <td>
                                                <StatusBadge status={c.trangThai} compact />
                                            </td>
                                            <td className="whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCheckInSession(c)}
                                                    className="medpro-btn-primary !py-1 !px-2.5 text-[11px]"
                                                >
                                                    Điểm danh buổi
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'LICH' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 medpro-card p-3.5 space-y-3">
                        <div className="text-xs font-extrabold text-clinic-navy uppercase pb-2 border-b border-clinic-border">
                            CHỌN CA BỆNH NHÂN
                        </div>
                        <div className="space-y-2 tabular-nums">
                            {treatmentCourses.map((c) => {
                                const isSel = selectedCourse?.id === c.id
                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => setSelectedCourse(c)}
                                        className={`p-3 rounded-[6px] border transition-colors cursor-pointer ${
                                            isSel
                                                ? 'bg-clinic-surface-alt border-clinic-cta'
                                                : 'bg-clinic-surface border-clinic-border hover:border-clinic-border-strong'
                                        }`}
                                    >
                                        <div className="font-bold text-xs text-clinic-navy">{c.tenBN}</div>
                                        <div className="text-[11px] text-clinic-text-secondary">{c.tenLieuTrinh}</div>
                                        <div className="mt-1 flex items-center justify-between text-[11px]">
                                            <span className="font-mono text-clinic-cta font-bold">{c.maDangKy}</span>
                                            <span className="font-extrabold text-clinic-navy">
                                                {c.soBuoiDaTap}/{c.tongSoBuoi} buổi
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-8 medpro-card p-4 space-y-3">
                        {selectedCourse ? (
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-clinic-border">
                                    <div>
                                        <div className="text-sm font-extrabold text-clinic-navy">
                                            LỊCH TRÌNH {selectedCourse.tongSoBuoi || 10} BUỔI: {selectedCourse.tenBN}
                                        </div>
                                        <div className="text-xs text-clinic-text-secondary">
                                            Phác đồ: <span className="font-bold text-clinic-navy">{selectedCourse.tenLieuTrinh}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCheckInSession(selectedCourse)}
                                        className="medpro-btn-primary !py-1.5 !px-3 text-xs"
                                    >
                                        <CheckCircle size={14} weight="bold" />
                                        <span>Check-in buổi tiếp theo</span>
                                    </button>
                                </div>

                                <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                                    <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                                        <thead>
                                            <tr>
                                                <th>Buổi số</th>
                                                <th>Thời gian dự kiến</th>
                                                <th>Giờ tập</th>
                                                <th>Kỹ thuật viên PHCN</th>
                                                <th>Trạng thái buổi</th>
                                                <th>Đánh giá lâm sàng</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {courseSessions.map((s) => (
                                                <tr key={s.buoiSo}>
                                                    <td className="font-bold text-center whitespace-nowrap">Buổi {s.buoiSo}</td>
                                                    <td className="font-semibold text-clinic-navy">{s.ngayTap}</td>
                                                    <td className="font-mono whitespace-nowrap">{s.gioTap}</td>
                                                    <td>{s.ktv}</td>
                                                    <td className="whitespace-nowrap">
                                                        <span
                                                            className={
                                                                s.trangThai === 'Đã hoàn thành'
                                                                    ? 'medpro-badge-success'
                                                                    : s.trangThai === 'Sắp diễn ra'
                                                                    ? 'medpro-badge-info'
                                                                    : 'medpro-badge-warning'
                                                            }
                                                        >
                                                            {s.trangThai}
                                                        </span>
                                                    </td>
                                                    <td className="text-clinic-text-secondary">{s.danhGia}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="py-12 text-center text-clinic-text-muted text-xs">
                                Vui lòng chọn ca bệnh nhân ở cột bên trái.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'BAI_TAP' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-extrabold text-clinic-navy uppercase">
                            DANH MỤC BÀI TẬP VẬT LÝ TRỊ LIỆU &amp; PHỤC HỒI CHỨC NĂNG CHUẨN
                        </div>
                        <span className="medpro-badge-info tabular-nums">{exercisesList.length} bài tập mẫu</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exercisesList.map((ex) => (
                            <div key={ex.id} className="p-4 rounded-[6px] border border-clinic-border bg-clinic-bg space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="medpro-badge-info font-mono !text-[10px]">
                                            {ex.maBT}
                                        </span>
                                        <h4 className="font-bold text-sm text-clinic-navy mt-1">{ex.tenBaiTap}</h4>
                                    </div>
                                    <span className="medpro-badge-success shrink-0">
                                        {ex.mucDo}
                                    </span>
                                </div>

                                <div className="text-xs text-clinic-text-secondary space-y-1">
                                    <div>
                                        Chuyên khoa: <span className="font-bold text-clinic-navy">{ex.chuyenKhoa}</span>
                                    </div>
                                    <div>
                                        Nhóm cơ tác động: <span className="font-medium text-clinic-text">{ex.nhomCo}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-clinic-text-secondary font-mono text-[11px] tabular-nums">
                                        <span>Thời lượng: {ex.thoiGian}</span>
                                        <span>Tần suất: {ex.soLanNgay}</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-clinic-border text-xs text-clinic-text-secondary">
                                    <span className="font-bold text-clinic-navy">Hướng dẫn kỹ thuật:</span> {ex.huongDan}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'BAO_CAO' && (
                <div className="medpro-card p-4 space-y-3">
                    <div className="text-sm font-extrabold text-clinic-navy uppercase">BÁO CÁO HIỆU QUẢ ĐIỀU TRỊ PHỤC HỒI CHỨC NĂNG</div>
                    <div className="bg-clinic-surface rounded-[6px] border border-clinic-border grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-clinic-border tabular-nums">
                        <div className="p-4">
                            <div className="text-xs text-clinic-success font-bold uppercase">Tỷ lệ giảm đau &amp; hồi phục</div>
                            <div className="text-2xl font-extrabold text-clinic-success mt-1">87.5%</div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Dựa trên thang điểm đau VAS sau buổi 5</div>
                        </div>
                        <div className="p-4">
                            <div className="text-xs text-clinic-cta font-bold uppercase">Tỷ lệ tuân thủ đủ liệu trình</div>
                            <div className="text-2xl font-extrabold text-clinic-cta mt-1">92.0%</div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Bệnh nhân tham gia tối thiểu 8/10 buổi</div>
                        </div>
                        <div className="p-4">
                            <div className="text-xs text-clinic-warning font-bold uppercase">Tổng số buổi tập trong tháng</div>
                            <div className="text-2xl font-extrabold text-clinic-warning mt-1">146 ca</div>
                            <div className="text-[11px] text-clinic-text-muted mt-0.5">Tại phòng Vật lý trị liệu PK Clinic-AI</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'HOA_DON' && (
                <div className="medpro-card p-4 space-y-4">
                    <div className="text-sm font-extrabold text-clinic-navy uppercase">HÓA ĐƠN VIỆN PHÍ LIỆU TRÌNH ĐIỀU TRỊ</div>
                    <div className="overflow-x-auto border border-clinic-border rounded-[6px]">
                        <table className="medpro-table w-full [&_th]:!px-2.5 [&_td]:!px-2.5 text-xs tabular-nums">
                            <thead>
                                <tr>
                                    <th>Số HĐ</th>
                                    <th>Bệnh nhân</th>
                                    <th>Liệu trình</th>
                                    <th>Số buổi</th>
                                    <th>Tổng tiền</th>
                                    <th>Thanh toán</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {treatmentCourses.map((c, idx) => (
                                    <tr key={c.id}>
                                        <td className="font-mono font-bold text-clinic-cta whitespace-nowrap">HD-LT-00{idx + 1}</td>
                                        <td className="font-bold text-clinic-navy">{c.tenBN}</td>
                                        <td>{c.tenLieuTrinh}</td>
                                        <td className="font-bold text-center whitespace-nowrap">{c.tongSoBuoi} buổi</td>
                                        <td className="font-mono font-extrabold text-clinic-cta whitespace-nowrap">
                                            {(c.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className="medpro-badge-success">
                                                {c.thanhToan}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => AppToast.success(`In biên lai liệu trình của BN ${c.tenBN}`)}
                                                className="medpro-btn-outline !py-1 !px-2.5 text-[11px]"
                                            >
                                                In biên lai
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
