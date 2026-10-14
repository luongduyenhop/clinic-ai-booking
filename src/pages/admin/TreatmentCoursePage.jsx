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
    Receipt,
    CheckCircle,
    Clock,
    X,
    CalendarCheck,
    Pulse,
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
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    // Danh mục bài tập phục hồi chức năng & vật lý trị liệu chuẩn BYT
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

    // Lịch trình chi tiết các buổi tập của ca đang chọn
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

    // Điểm danh buổi tập
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
            {/* Top Navigation & Operational Summary */}
            <div className="bg-white rounded-2xl shadow-xs border border-[#E5EEF5] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center shadow-md">
                        <ClipboardText size={24} weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-lg font-black text-[#003553] tracking-wide flex items-center gap-2">
                            LIỆU TRÌNH ĐIỀU TRỊ & PHỤC HỒI CHỨC NĂNG
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#00B5F1] text-[11px] font-bold">
                                Vật lý trị liệu dài ngày
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500">
                            Quản lý phác đồ điều trị nhiều buổi, điểm danh ca tập, theo dõi lịch liệu trình và danh mục bài tập PHCN
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => AppToast.info('Vui lòng chọn bệnh nhân để chỉ định liệu trình!')}
                        className="medpro-btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <PlusCircle size={16} weight="bold" />
                        <span>Kê đơn liệu trình mới</span>
                    </button>
                </div>
            </div>

            {/* Sub-Tabs bar (Chuẩn tClinic) */}
            <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-xl">
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
                        className={`px-3.5 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                            activeTab === t.id
                                ? 'border-[#00B5F1] text-[#00B5F1]'
                                : 'border-transparent text-slate-500 hover:text-[#003553]'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: DANH SÁCH LIỆU TRÌNH */}
            {activeTab === 'LIEU_TRINH' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs font-black text-[#003553] uppercase">
                            CÁC CA ĐIỀU TRỊ LIỆU TRÌNH HIỆN HỮU ({filteredCourses.length})
                        </div>
                        <div className="relative w-72">
                            <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Tìm bệnh nhân, mã liệu trình..."
                                className="w-full text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table text-xs">
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
                                            <td className="font-mono font-bold text-[#00B5F1]">{c.maDangKy}</td>
                                            <td>
                                                <div className="font-bold text-[#003553]">{c.tenBN}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">
                                                    {c.dienThoai} &bull; {c.tuoi}
                                                </div>
                                            </td>
                                            <td className="font-semibold text-slate-700">
                                                <div>{c.tenLieuTrinh}</div>
                                                <div className="text-[11px] text-slate-400 italic mt-0.5">{c.baiTap}</div>
                                            </td>
                                            <td className="font-medium text-slate-600">{c.bacSi}</td>
                                            <td>
                                                <div className="font-black text-xs text-[#003553]">
                                                    {c.soBuoiDaTap} / {c.tongSoBuoi} buổi ({percent}%)
                                                </div>
                                                <div className="w-28 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                                    <div
                                                        className="h-1.5 bg-[#00B5F1] rounded-full transition-all"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex gap-1">
                                                    {(c.lichLapLai || []).map((day) => (
                                                        <span
                                                            key={day}
                                                            className="px-1.5 py-0.5 rounded bg-sky-50 text-[#003553] text-[10px] font-bold border border-sky-100"
                                                        >
                                                            {day}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="font-mono font-black text-[#003553]">
                                                {(c.thanhTien || 0).toLocaleString('vi-VN')} đ
                                            </td>
                                            <td>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {c.thanhToan}
                                                </span>
                                            </td>
                                            <td>
                                                <StatusBadge status={c.trangThai} compact />
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCheckInSession(c)}
                                                    className="medpro-btn-primary !py-1 !px-2.5 text-[11px] cursor-pointer"
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

            {/* TAB 2: LỊCH LIỆU TRÌNH THEO BUỔI */}
            {activeTab === 'LICH' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Cột trái: Chọn ca bệnh nhân */}
                    <div className="lg:col-span-4 bg-white rounded-xl border border-[#E5EEF5] p-3.5 space-y-3">
                        <div className="text-xs font-black text-[#003553] uppercase pb-2 border-b border-slate-100">
                            CHỌN CA BỆNH NHÂN
                        </div>
                        <div className="space-y-2">
                            {treatmentCourses.map((c) => {
                                const isSel = selectedCourse?.id === c.id
                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => setSelectedCourse(c)}
                                        className={`p-3 rounded-xl border transition cursor-pointer ${
                                            isSel
                                                ? 'bg-[#F0F8FE] border-[#00B5F1] ring-2 ring-[#00B5F1]/15'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="font-bold text-xs text-[#003553]">{c.tenBN}</div>
                                        <div className="text-[11px] text-slate-500">{c.tenLieuTrinh}</div>
                                        <div className="mt-1 flex items-center justify-between text-[11px]">
                                            <span className="font-mono text-[#00B5F1] font-bold">{c.maDangKy}</span>
                                            <span className="font-extrabold text-slate-700">
                                                {c.soBuoiDaTap}/{c.tongSoBuoi} buổi
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Cột phải: Bảng lịch từng buổi tập */}
                    <div className="lg:col-span-8 bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-3">
                        {selectedCourse ? (
                            <>
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <div>
                                        <div className="text-sm font-black text-[#003553]">
                                            LỊCH TRÌNH 10 BUỔI: {selectedCourse.tenBN}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Phác đồ: <span className="font-bold text-slate-700">{selectedCourse.tenLieuTrinh}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCheckInSession(selectedCourse)}
                                        className="medpro-btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1 cursor-pointer"
                                    >
                                        <CheckCircle size={14} weight="bold" />
                                        <span>Check-in buổi tiếp theo</span>
                                    </button>
                                </div>

                                <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                                    <table className="medpro-table text-xs">
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
                                                    <td className="font-bold text-center">Buổi {s.buoiSo}</td>
                                                    <td className="font-semibold text-[#003553]">{s.ngayTap}</td>
                                                    <td className="font-mono">{s.gioTap}</td>
                                                    <td>{s.ktv}</td>
                                                    <td>
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                s.trangThai === 'Đã hoàn thành'
                                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                    : s.trangThai === 'Sắp diễn ra'
                                                                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                                                    : 'bg-slate-50 text-slate-500'
                                                            }`}
                                                        >
                                                            {s.trangThai}
                                                        </span>
                                                    </td>
                                                    <td className="italic text-slate-500">{s.danhGia}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                Vui lòng chọn ca bệnh nhân ở cột bên trái.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: DANH MỤC BÀI TẬP PHCN */}
            {activeTab === 'BAI_TAP' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-[#003553]">
                            DANH MỤC BÀI TẬP VẬT LÝ TRỊ LIỆU & PHỤC HỒI CHỨC NĂNG CHUẨN
                        </div>
                        <span className="text-xs text-slate-500 font-semibold">{exercisesList.length} bài tập mẫu</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exercisesList.map((ex) => (
                            <div key={ex.id} className="p-4 rounded-xl border border-slate-200 bg-[#FBFDFE] space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="px-2 py-0.5 rounded bg-sky-100 text-[#00B5F1] font-mono text-[10px] font-bold">
                                            {ex.maBT}
                                        </span>
                                        <h4 className="font-black text-sm text-[#003553] mt-1">{ex.tenBaiTap}</h4>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                        {ex.mucDo}
                                    </span>
                                </div>

                                <div className="text-xs text-slate-600 space-y-1">
                                    <div>
                                        Chuyên khoa: <span className="font-bold text-slate-800">{ex.chuyenKhoa}</span>
                                    </div>
                                    <div>
                                        Nhóm cơ tác động: <span className="font-medium text-slate-700">{ex.nhomCo}</span>
                                    </div>
                                    <div className="flex gap-4 text-slate-500 font-mono text-[11px]">
                                        <span>⏱ {ex.thoiGian}</span>
                                        <span>🔁 {ex.soLanNgay}</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                                    <span className="font-bold text-slate-700">Hướng dẫn kỹ thuật:</span> {ex.huongDan}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 4: BÁO CÁO */}
            {activeTab === 'BAO_CAO' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-3">
                    <div className="text-sm font-bold text-[#003553]">BÁO CÁO HIỆU QUẢ ĐIỀU TRỊ PHỤC HỒI CHỨC NĂNG</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                            <div className="text-xs text-emerald-800 font-bold uppercase">Tỷ lệ giảm đau & hồi phục</div>
                            <div className="text-2xl font-black text-emerald-700 mt-1">87.5%</div>
                            <div className="text-[11px] text-emerald-600 mt-0.5">Dựa trên thang điểm đau VAS sau buổi 5</div>
                        </div>
                        <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/50">
                            <div className="text-xs text-sky-800 font-bold uppercase">Tỷ lệ tuân thủ đủ liệu trình</div>
                            <div className="text-2xl font-black text-[#00B5F1] mt-1">92.0%</div>
                            <div className="text-[11px] text-sky-600 mt-0.5">Bệnh nhân tham gia tối thiểu 8/10 buổi</div>
                        </div>
                        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50">
                            <div className="text-xs text-amber-800 font-bold uppercase">Tổng số buổi tập trong tháng</div>
                            <div className="text-2xl font-black text-amber-700 mt-1">146 ca</div>
                            <div className="text-[11px] text-amber-600 mt-0.5">Tại phòng Vật lý trị liệu PK Medpro</div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: HÓA ĐƠN */}
            {activeTab === 'HOA_DON' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-4 space-y-4">
                    <div className="text-sm font-bold text-[#003553]">HÓA ĐƠN VIỆN PHÍ LIỆU TRÌNH ĐIỀU TRỊ</div>
                    <div className="overflow-x-auto border border-[#E5EEF5] rounded-xl">
                        <table className="medpro-table text-xs">
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
                                        <td className="font-mono font-bold text-[#00B5F1]">HD-LT-00{idx + 1}</td>
                                        <td className="font-bold text-[#003553]">{c.tenBN}</td>
                                        <td>{c.tenLieuTrinh}</td>
                                        <td className="font-bold text-center">{c.tongSoBuoi} buổi</td>
                                        <td className="font-mono font-black text-[#00B5F1]">
                                            {(c.thanhTien || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {c.thanhToan}
                                            </span>
                                        </td>
                                        <td>
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
