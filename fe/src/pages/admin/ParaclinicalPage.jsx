import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
    Microscope,
    Scan,
    Heartbeat,
    Eye,
    MagnifyingGlass,
    ArrowRight,
    CheckCircle,
    WarningCircle,
    Sparkle,
} from '../../components/common/ClinicIcon'
import {
    FUNCTIONAL_TEMPLATES,
    IMAGING_PRESETS,
    ENDOSCOPY_TEMPLATES,
} from '../../utils/constants/clinical'

const LAB_REFERENCE_CATALOG = [
    {
        group: 'XET_NGHIEM',
        categoryName: 'Huyết học & Đông máu',
        code: 'DV_XN_MAU',
        serviceName: 'Tổng phân tích tế bào máu ngoại vi (24 thông số)',
        indicators: [
            { code: 'WBC', name: 'Số lượng bạch cầu', unit: 'G/L', normal: '4.0 – 10.0', critical: '< 2.0 hoặc > 30.0' },
            { code: 'NEU%', name: 'Tỷ lệ bạch cầu trung tính', unit: '%', normal: '40 – 75', critical: '—' },
            { code: 'LYM%', name: 'Tỷ lệ bạch cầu lympho', unit: '%', normal: '20 – 40', critical: '—' },
            { code: 'RBC', name: 'Số lượng hồng cầu', unit: 'T/L', normal: 'Nam: 4.2 – 5.4 | Nữ: 3.8 – 5.0', critical: '—' },
            { code: 'HGB', name: 'Nồng độ huyết sắc tố', unit: 'g/L', normal: 'Nam: 130 – 170 | Nữ: 120 – 150', critical: '< 70 hoặc > 200' },
            { code: 'HCT', name: 'Thể tích khối hồng cầu (Hematocrit)', unit: 'L/L', normal: 'Nam: 0.40 – 0.50 | Nữ: 0.36 – 0.46', critical: '< 0.20 hoặc > 0.60' },
            { code: 'PLT', name: 'Số lượng tiểu cầu', unit: 'G/L', normal: '150 – 400', critical: '< 50 hoặc > 1000' },
        ],
    },
    {
        group: 'XET_NGHIEM',
        categoryName: 'Sinh hóa máu & Chuyển hóa đường',
        code: 'DV_XN_GLUCOSE',
        serviceName: 'Định lượng Glucose máu lúc đói',
        indicators: [
            { code: 'GLU', name: 'Glucose máu', unit: 'mmol/L', normal: '3.9 – 6.4', critical: '< 2.2 hoặc > 25.0' },
        ],
    },
    {
        group: 'XET_NGHIEM',
        categoryName: 'Sinh hóa máu & Đái tháo đường',
        code: 'DV_XN_HBA1C',
        serviceName: 'Định lượng HbA1c máu (Kiểm soát đường huyết 3 tháng)',
        indicators: [
            { code: 'HBA1C', name: 'HbA1c máu', unit: '%', normal: '4.0 – 6.0', critical: '> 12.0' },
        ],
    },
    {
        group: 'XET_NGHIEM',
        categoryName: 'Sinh hóa máu & Chức năng Gan',
        code: 'DV_XN_MEN_GAN',
        serviceName: 'Đo hoạt độ Men gan (AST, ALT, GGT)',
        indicators: [
            { code: 'AST', name: 'AST (GOT)', unit: 'U/L', normal: 'dưới 37', critical: '> 1000' },
            { code: 'ALT', name: 'ALT (GPT)', unit: 'U/L', normal: 'dưới 40', critical: '> 1000' },
            { code: 'GGT', name: 'GGT', unit: 'U/L', normal: 'Nam: 11 – 50 | Nữ: 7 – 32', critical: '> 500' },
        ],
    },
    {
        group: 'XET_NGHIEM',
        categoryName: 'Sinh hóa máu & Chức năng Thận',
        code: 'DV_XN_THAN',
        serviceName: 'Định lượng Ure & Creatinin máu',
        indicators: [
            { code: 'URE', name: 'Ure máu', unit: 'mmol/L', normal: '2.5 – 7.5', critical: '> 30.0' },
            { code: 'CREA', name: 'Creatinin máu', unit: 'µmol/L', normal: 'Nam: 62 – 120 | Nữ: 53 – 100', critical: '> 500' },
            { code: 'EGFR', name: 'Mức lọc cầu thận ước tính (eGFR)', unit: 'mL/min/1.73m²', normal: 'trên 60', critical: '< 15' },
        ],
    },
    {
        group: 'XET_NGHIEM',
        categoryName: 'Sinh hóa máu & Bộ mỡ Lipid',
        code: 'DV_XN_MO_MAU',
        serviceName: 'Định lượng Bộ mỡ máu (Lipid panel)',
        indicators: [
            { code: 'CHOL', name: 'Cholesterol toàn phần', unit: 'mmol/L', normal: 'dưới 5.2', critical: '> 10.0' },
            { code: 'TG', name: 'Triglycerid', unit: 'mmol/L', normal: 'dưới 1.7', critical: '> 5.6' },
            { code: 'HDL', name: 'HDL-Cholesterol (tốt)', unit: 'mmol/L', normal: 'trên 1.0', critical: '—' },
            { code: 'LDL', name: 'LDL-Cholesterol (xấu)', unit: 'mmol/L', normal: 'dưới 3.4', critical: '> 4.9' },
        ],
    },
    {
        group: 'XET_NGHIEM',
        categoryName: 'Phân tích Nước tiểu 10 thông số',
        code: 'DV_XN_NUOC_TIEU',
        serviceName: 'Tổng phân tích nước tiểu bằng máy tự động',
        indicators: [
            { code: 'pH', name: 'Độ pH nước tiểu', unit: '', normal: '5.0 – 7.5', critical: '—' },
            { code: 'SG', name: 'Tỷ trọng (SG)', unit: '', normal: '1.005 – 1.030', critical: '—' },
            { code: 'GLU', name: 'Glucose niệu', unit: 'mmol/L', normal: 'Âm tính (dưới 0.8)', critical: '—' },
            { code: 'PRO', name: 'Protein niệu', unit: 'g/L', normal: 'Âm tính (dưới 0.15)', critical: '—' },
            { code: 'LEU', name: 'Bạch cầu niệu (Leukocytes)', unit: 'TB/µL', normal: 'Âm tính (dưới 25)', critical: '—' },
            { code: 'NIT', name: 'Nitrit niệu', unit: '', normal: 'Âm tính', critical: '—' },
        ],
    },
]

export default function ParaclinicalPage() {
    const [selectedGroup, setSelectedGroup] = useState('ALL')
    const [searchTerm, setSearchTerm] = useState('')

    const filteredCatalog = useMemo(() => {
        return LAB_REFERENCE_CATALOG.filter((item) => {
            const matchGroup = selectedGroup === 'ALL' || item.group === selectedGroup
            const matchSearch =
                !searchTerm.trim() ||
                item.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.indicators.some((ind) => ind.name.toLowerCase().includes(searchTerm.toLowerCase()) || ind.code.toLowerCase().includes(searchTerm.toLowerCase()))
            return matchGroup && matchSearch
        })
    }, [selectedGroup, searchTerm])

    return (
        <div className="space-y-6 pb-12">
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-[#003553] via-[#004B75] to-[#0088BA] p-6 text-white shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#8FE2FF] border border-white/15">
                            <Microscope size={15} weight="duotone" />
                            <span>LIS & PACS Kỹ Thuật Số</span>
                        </div>
                        <h1 className="text-2xl font-extrabold tracking-tight font-display">
                            Danh Mục Kỹ Thuật & Khoảng Tham Chiếu Cận Lâm Sàng
                        </h1>
                        <p className="text-xs text-sky-100 max-w-2xl leading-relaxed">
                            Quy chuẩn kỹ thuật xét nghiệm, thăm dò chức năng và chẩn đoán hình ảnh. Kỹ thuật viên truy cập Bàn làm việc để tiếp nhận mẫu, nhập kết quả và ký số duyệt trả.
                        </p>
                    </div>

                    <Link
                        to="/staff/paraclinical-work"
                        className="inline-flex items-center gap-2 rounded-xl bg-[#00B5F1] px-5 py-3 text-xs font-extrabold text-[#002840] shadow-md transition hover:bg-[#009EDB] shrink-0"
                    >
                        <span>Đến Bàn làm việc CLS</span>
                        <ArrowRight size={16} weight="bold" />
                    </Link>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {[
                        { key: 'ALL', label: 'Tất cả danh mục' },
                        { key: 'XET_NGHIEM', label: 'Xét nghiệm (LIS)' },
                        { key: 'TDCN', label: 'Thăm dò chức năng' },
                        { key: 'CDHA', label: 'Chẩn đoán hình ảnh' },
                        { key: 'NOI_SOI', label: 'Nội soi' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setSelectedGroup(tab.key)}
                            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                                selectedGroup === tab.key
                                    ? 'bg-[#003553] text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative min-w-[260px]">
                    <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm chỉ số, mã hoặc tên kỹ thuật…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#00B5F1] focus:outline-none transition shadow-2xs"
                    />
                </div>
            </div>

            {(selectedGroup === 'ALL' || selectedGroup === 'XET_NGHIEM') && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Microscope size={18} weight="duotone" className="text-[#0088BA]" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-[#003553]">
                            Bộ Chỉ Số Xét Nghiệm Chuẩn Hóa ({filteredCatalog.length} kỹ thuật)
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {filteredCatalog.map((service) => (
                            <div key={service.code} className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                                <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <span className="font-mono text-xs font-bold text-[#007EA8] bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">
                                            {service.code}
                                        </span>
                                        <h3 className="text-sm font-bold text-[#003553]">{service.serviceName}</h3>
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                        {service.categoryName}
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/50 text-slate-600 border-b border-slate-200">
                                                <th className="p-3 font-bold w-24">Mã</th>
                                                <th className="p-3 font-bold">Tên chỉ số xét nghiệm</th>
                                                <th className="p-3 font-bold text-center w-24">Đơn vị</th>
                                                <th className="p-3 font-bold text-center">Khoảng tham chiếu chuẩn</th>
                                                <th className="p-3 font-bold text-center w-36">Ngưỡng báo động</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {service.indicators.map((ind) => (
                                                <tr key={ind.code} className="hover:bg-sky-50/30 transition">
                                                    <td className="p-3 font-mono font-bold text-[#003553]">{ind.code}</td>
                                                    <td className="p-3 font-semibold text-slate-800">{ind.name}</td>
                                                    <td className="p-3 text-center text-slate-600 font-mono">{ind.unit || '—'}</td>
                                                    <td className="p-3 text-center font-bold text-emerald-800 bg-emerald-50/30">{ind.normal}</td>
                                                    <td className="p-3 text-center">
                                                        {ind.critical !== '—' ? (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                                                <WarningCircle size={12} weight="bold" />
                                                                {ind.critical}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(selectedGroup === 'ALL' || selectedGroup === 'TDCN') && (
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                        <Heartbeat size={18} weight="duotone" className="text-rose-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-[#003553]">
                            Thăm Dò Chức Năng (Điện tim ECG, Hô hấp ký, Điện não)
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(FUNCTIONAL_TEMPLATES).filter(([k]) => k !== 'DV010').map(([k, tpl]) => (
                            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                    <div className="font-bold text-sm text-[#003553] flex items-center gap-2">
                                        <span className="font-mono text-xs text-[#0088BA] bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{k}</span>
                                        <span>{k === 'DV_ECG' ? 'Điện tâm đồ (ECG) 12 chuyển đạo' : k === 'DV_HO_HAP_KY' ? 'Đo chức năng hô hấp' : k === 'DV_EEG' ? 'Điện não đồ (EEG)' : 'Đo thính lực'}</span>
                                    </div>
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        {tpl.params?.length || 0} thông số
                                    </span>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                    <span className="font-semibold text-slate-500">Mẫu nhận định lâm sàng:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.keys(tpl.presets || {}).map((presetKey) => (
                                            <span key={presetKey} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium">
                                                ✓ {presetKey}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(selectedGroup === 'ALL' || selectedGroup === 'CDHA') && (
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                        <Scan size={18} weight="duotone" className="text-sky-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-[#003553]">
                            Chẩn Đoán Hình Ảnh (X-quang KTS & Siêu âm màu)
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(IMAGING_PRESETS).filter(([k]) => !['DV005', 'DV006', 'DV008'].includes(k)).map(([k, presets]) => (
                            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                                <div className="border-b border-slate-100 pb-2">
                                    <span className="font-mono text-[11px] font-bold text-[#007EA8] bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{k}</span>
                                    <h4 className="font-bold text-sm text-[#003553] mt-1">
                                        {k === 'DV_SA_BUNG' ? 'Siêu âm ổ bụng tổng quát'
                                            : k === 'DV_XQ_NGUC' ? 'X-quang tim phổi thẳng'
                                            : k === 'DV_SA_TIM' ? 'Siêu âm tim màu Doppler'
                                            : k === 'DV_SA_GIAP' ? 'Siêu âm tuyến giáp'
                                            : k === 'DV_SA_VU' ? 'Siêu âm tuyến vú 2 bên'
                                            : k === 'DV_SA_MACH_CHI' ? 'Siêu âm Doppler mạch chi'
                                            : k === 'DV_XQ_XOANG' ? 'X-quang xoang (Blondeau - Hirtz)'
                                            : k === 'DV_XQ_COT_SONG' ? 'X-quang cột sống thắt lưng'
                                            : k === 'DV_XQ_KHOP_GOI' ? 'X-quang khớp gối'
                                            : 'Chụp Panorama toàn cảnh hàm răng'}
                                    </h4>
                                </div>
                                <div className="space-y-1 text-xs">
                                    <span className="font-semibold text-slate-500">Mẫu mô tả có sẵn:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {Object.keys(presets).map((pKey) => (
                                            <span key={pKey} className="text-[11px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                                                {pKey}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(selectedGroup === 'ALL' || selectedGroup === 'NOI_SOI') && (
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                        <Eye size={18} weight="duotone" className="text-amber-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-[#003553]">
                            Nội Soi Tiêu Hóa & Tai Mũi Họng (NBI Kỹ Thuật Số)
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(ENDOSCOPY_TEMPLATES).filter(([k]) => k !== 'DV009').map(([k, tpl]) => (
                            <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                                <div className="border-b border-slate-100 pb-2">
                                    <span className="font-mono text-[11px] font-bold text-[#007EA8] bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{k}</span>
                                    <h4 className="font-bold text-sm text-[#003553] mt-1">
                                        {k === 'DV_NS_TMH' ? 'Nội soi Tai Mũi Họng ống mềm' : 'Nội soi Thực quản – Dạ dày – Tá tràng'}
                                    </h4>
                                </div>
                                <div className="text-xs space-y-1">
                                    <span className="font-semibold text-slate-500">Vị trí giải phẫu khảo sát:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {tpl.sites.map((s) => (
                                            <span key={s} className="px-2 py-0.5 rounded bg-sky-50 text-[#003553] font-semibold text-[11px] border border-sky-100">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
