import { stripDoctorTitles } from '../../utils/helpers/doctorNameHelper'

const SIZE_CLASSES = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-14 h-14 text-base',
    lg: 'w-16 h-16 sm:w-[76px] sm:h-[76px] text-lg sm:text-xl',
}

function resolveSpecialtyTone(specialtyCode = '', specialty = '') {
    const key = `${specialtyCode} ${specialty}`.toLowerCase()
    if (key.includes('khoa_tmh') || key.includes('tai mũi họng') || key.includes('tmh')) {
        return 'bg-[#F3F0FA] text-[#3B2F63] border-[#DDD6F0]'
    }
    if (key.includes('khoa_rang') || key.includes('răng') || key.includes('nha khoa')) {
        return 'bg-[#FEF6E7] text-[#7A4A0B] border-[#F2DFBA]'
    }
    if (key.includes('khoa_mat') || key.includes('mắt') || key.includes('nhãn khoa')) {
        return 'bg-[#EDF6F7] text-[#124E57] border-[#C7E2E5]'
    }
    if (key.includes('khoa_ngoai') || key.includes('ngoại')) {
        return 'bg-[#ECF7F2] text-[#0F5132] border-[#C5E6D7]'
    }
    if (key.includes('khoa_noi') || key.includes('nội')) {
        return 'bg-[#EBF4FA] text-[#003553] border-[#CBE0EE]'
    }
    return 'bg-clinic-surface-alt text-clinic-navy border-clinic-border'
}

function resolveAvatarInitials(name = '', initials = '') {
    const provided = String(initials || '').trim()
    if (provided) return provided.slice(0, 2).toUpperCase()
    const { bareName } = stripDoctorTitles(name)
    const words = String(bareName || name)
        .trim()
        .split(/\s+/)
        .filter((word) => /^[A-Za-zÀ-ỹ]/i.test(word))
    if (!words.length) return 'BS'
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return words
        .slice(-2)
        .map((word) => word[0])
        .join('')
        .toUpperCase()
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
            className={`inline-flex items-center justify-center rounded-[8px] border font-display font-extrabold tracking-tight shrink-0 select-none ${toneClass} ${sizeClass} ${className}`.trim()}
        >
            {labelText}
        </span>
    )
}
