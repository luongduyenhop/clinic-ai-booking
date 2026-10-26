export default function SymptomToggle({ label, selected, onClick, danger = false }) {
    return <button type="button" onClick={onClick} className={`min-h-10 rounded-full border px-4 text-xs font-bold transition ${selected ? danger ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-[#00B5F1] bg-[#E8F4FD] text-[#006F9F]' : 'border-slate-200 bg-white text-slate-600 hover:border-[#8DDBF7]'}`}>{label}</button>
}
