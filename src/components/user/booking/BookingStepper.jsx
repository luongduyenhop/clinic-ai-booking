import { Check } from '../../common/ClinicIcon'

const labels = ['Chuyên khoa & Bác sĩ', 'Ngày & Giờ khám', 'Thông tin người khám']

export default function BookingStepper({ currentStep }) {
    return <ol className="grid grid-cols-3 gap-2" aria-label="Tiến trình đặt lịch">{labels.map((label, index) => { const step = index + 1; const done = step < currentStep; const active = step === currentStep; return <li key={label} className="relative"><div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3"><span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold ${done || active ? 'bg-[#00B5F1] text-white' : 'bg-slate-100 text-slate-400'}`}>{done ? <Check size={17} weight="bold" /> : step}</span><span className={`text-[11px] sm:text-sm font-bold text-center sm:text-left leading-4 ${active ? 'text-[#003553]' : done ? 'text-[#008EC2]' : 'text-slate-400'}`}>{label}</span></div>{index < 2 && <span className={`hidden sm:block absolute h-0.5 top-[18px] left-[44px] right-[-4px] -z-10 ${done ? 'bg-[#00B5F1]' : 'bg-slate-200'}`} />}</li> })}</ol>
}
