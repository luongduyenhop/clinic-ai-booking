import { Stethoscope, CheckCircle } from '../../common/ClinicIcon'
import { formatConsultFee, formatDoctorHeading } from '../../../utils/helpers/quickBookingHelpers'

export default function SpecialtyDoctorStep({
    values = {},
    onChange = () => {},
    specialties = [],
    doctors = [],
    loading = false,
    error = '',
}) {
    const filteredDoctors = doctors.filter((doctor) => doctor.specialtyId === values.specialtyId)

    return (
        <div>
            <div className="mb-5">
                <h2 className="booking-title">Chọn chuyên khoa</h2>
                <p className="booking-description">Danh sách chuyên khoa và phòng khám được cập nhật từ hệ thống điều phối.</p>
            </div>

            {loading && (
                <p role="status" className="mb-4 text-sm text-clinic-text-secondary">
                    Đang tải danh sách chuyên khoa và bác sĩ...
                </p>
            )}
            {error && (
                <p role="alert" className="mb-4 rounded-[8px] border border-clinic-danger-border bg-clinic-danger-bg p-3.5 text-sm text-clinic-danger">
                    {error}
                </p>
            )}

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {specialties.map((item) => {
                    const isSelected = values.specialtyId === item.id
                    return (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => onChange({ specialtyId: item.id, doctorId: '' })}
                            className={`relative text-left rounded-[8px] border p-4 transition-colors cursor-pointer ${
                                isSelected
                                    ? 'border-clinic-cta bg-clinic-surface-alt'
                                    : 'border-clinic-border bg-clinic-surface hover:border-clinic-cta'
                            }`}
                        >
                            <strong className="block text-sm font-bold text-clinic-navy pr-6">{item.name}</strong>
                            <span className="mt-1 block text-xs text-clinic-text-secondary">
                                {item.room || 'Khu khám ngoại trú'}
                            </span>
                            <span className="mt-1 block text-xs font-semibold text-clinic-text-muted tabular-nums">
                                {item.doctorCount} bác sĩ
                            </span>
                            {isSelected && (
                                <CheckCircle size={18} weight="fill" className="absolute right-3 top-3 text-clinic-cta" />
                            )}
                        </button>
                    )
                })}
            </div>

            {values.specialtyId && (
                <div className="mt-7 pt-6 border-t border-clinic-border">
                    <h2 className="booking-title">Chọn bác sĩ phụ trách</h2>
                    <div className="mt-4 grid md:grid-cols-2 gap-3">
                        {filteredDoctors.length ? (
                            filteredDoctors.map((doctor) => {
                                const isSelected = values.doctorId === doctor.id
                                return (
                                    <button
                                        type="button"
                                        key={doctor.id}
                                        onClick={() => onChange({ doctorId: doctor.id })}
                                        className={`flex items-center gap-3.5 rounded-[8px] border p-4 text-left transition-colors cursor-pointer ${
                                            isSelected
                                                ? 'border-clinic-cta bg-clinic-surface-alt'
                                                : 'border-clinic-border bg-clinic-surface hover:border-clinic-cta'
                                        }`}
                                    >
                                        <span className="w-11 h-11 shrink-0 rounded-[8px] bg-clinic-surface-alt border border-clinic-info-border text-clinic-navy flex items-center justify-center font-display font-extrabold text-sm">
                                            {doctor.initials}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <strong className="block text-sm font-bold text-clinic-navy truncate">
                                                {formatDoctorHeading(doctor)}
                                            </strong>
                                            <span className="mt-0.5 block text-xs text-clinic-text-secondary truncate">
                                                {doctor.room || doctor.experience || 'Khu khám ngoại trú'}
                                            </span>
                                            <span className="mt-0.5 block text-xs font-bold text-clinic-cta tabular-nums">
                                                {formatConsultFee(doctor.fee)}
                                            </span>
                                        </span>
                                        <Stethoscope size={19} className={isSelected ? 'text-clinic-cta' : 'text-clinic-text-muted'} />
                                    </button>
                                )
                            })
                        ) : (
                            <p className="text-sm text-clinic-text-secondary">
                                Chưa có bác sĩ đang nhận lịch trực tiếp trong chuyên khoa này.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
