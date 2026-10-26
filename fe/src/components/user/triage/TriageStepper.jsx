import { Check } from '../../common/ClinicIcon'

const steps = ['Triệu chứng chính', 'Đặc điểm', 'Thông tin bổ sung']

export default function TriageStepper({ currentStep }) {
    return <ol className="grid grid-cols-3 gap-2" aria-label="Tiến trình khảo sát">{steps.map((label, index) => { const number = index + 1; const done = number < currentStep; const active = number === currentStep; return <li key={label} className="flex flex-col items-center text-center"><span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold ${done || active ? 'bg-[#00B5F1] text-white' : 'bg-slate-100 text-slate-400'}`}>{done ? <Check size={16} weight="bold"/> : number}</span><span className={`mt-2 text-[11px] sm:text-xs font-bold ${active ? 'text-[#003553]' : done ? 'text-[#008EC2]' : 'text-slate-400'}`}>{label}</span></li> })}</ol>
}
