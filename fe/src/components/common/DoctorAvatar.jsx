import { getAvatarInitials } from '../../utils/helpers/doctorNameHelper'

const SIZE_CLASSES = {
    sm: 'w-11 h-11 text-xs',
    md: 'w-13 h-13 text-sm',
    lg: 'w-16 h-16 sm:w-[72px] sm:h-[72px] text-base sm:text-lg',
}

function resolveSpecialtyTone(specialtyCode = '', specialty = '') {
    const key = `${specialtyCode} ${specialty}`.toLowerCase()
    if (key.includes('khoa_tmh') || key.includes('tai mũi họng') || key.includes('tmh')) {
        return 'bg-avatar-plum-bg text-avatar-plum-text border-avatar-plum-border'
    }
    if (key.includes('khoa_rang') || key.includes('răng') || key.includes('nha khoa')) {
        return 'bg-avatar-ochre-bg text-avatar-ochre-text border-avatar-ochre-border'
    }
    if (key.includes('khoa_mat') || key.includes('mắt') || key.includes('nhãn khoa')) {
        return 'bg-avatar-teal-bg text-avatar-teal-text border-avatar-teal-border'
    }
    if (key.includes('khoa_ngoai') || key.includes('ngoại')) {
        return 'bg-avatar-sage-bg text-avatar-sage-text border-avatar-sage-border'
    }
    if (key.includes('khoa_noi') || key.includes('nội')) {
        return 'bg-avatar-sky-bg text-avatar-sky-text border-avatar-sky-border'
    }
    return 'bg-clinic-surface-alt text-clinic-navy border-clinic-border'
}

function resolveAvatarInitials(name = '', initials = '') {
    const provided = String(initials || '').replace(/[^A-Za-zÀ-ỹ]/g, '').trim()
    if (provided) return provided.slice(0, 2).toUpperCase()
    return getAvatarInitials(name, 'BS')
}

export default function DoctorAvatar({
    name = '',
    initials = '',
    specialty = '',
    specialtyCode = '',
    size = 'md',
    className = '',
}) {
    const labelText = resolveAvatarInitials(name, initials)
    const toneClass = resolveSpecialtyTone(specialtyCode, specialty)
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md

    return (
        <span
            role="img"
            aria-label={name ? `Đại diện ${name}` : 'Đại diện bác sĩ'}
            className={`inline-flex items-center justify-center rounded-[8px] border font-display font-bold tracking-tight shrink-0 select-none ${toneClass} ${sizeClass} ${className}`.trim()}
        >
            {labelText}
        </span>
    )
}
