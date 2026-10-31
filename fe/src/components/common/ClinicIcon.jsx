import {
    HouseLine,
    User,
    Users,
    UserPlus,
    UserList,
    ArrowLeft,
    Copy,
    Newspaper,
    BookOpenText,
    Folders,
    ChatCircleDots,
    FileText,
    ShieldCheck,
    Scales,
    GlobeHemisphereWest,
    CalendarCheck,
    CalendarPlus,
    ClipboardText,
    Stethoscope,
    Microscope,
    FirstAidKit,
    Pulse,
    Receipt,
    ChartBar,
    ArrowsClockwise,
    SignOut,
    FloppyDisk,
    Trash,
    PencilSimple,
    Printer,
    MagnifyingGlass,
    Funnel,
    Sparkle,
    Robot,
    Camera,
    UploadSimple,
    DownloadSimple,
    LockKey,
    Signature,
    CheckCircle,
    Warning,
    WarningCircle,
    XCircle,
    Clock,
    Plus,
    PlusCircle,
    ArrowRight,
    CaretRight,
    CaretLeft,
    CaretDown,
    Eye,
    QrCode,
    Hospital,
    IdentificationCard,
    Pill,
    Syringe,
    Heartbeat,
    MapPin,
    Buildings,
    CurrencyCircleDollar,
    EnvelopeSimple,
    Package,
    ListChecks,
    Key,
    UserGear,
    SealCheck,
    FileLock,
    Info,
    Lightning,
    SlidersHorizontal,
    Broom,
    Check,
    X,
    UserCheck,
    PhoneCall,
    ChatTeardropDots,
    Flask,
    Bicycle,
    ClockCounterClockwise,
    UsersThree,
    Bell,
    ArrowsOut,
    ArrowsIn,
    Drop,
    Waveform,
    Scan,
    MinusCircle,
    Globe,
    Translate,
    Cloud,
    Gear,
    Question,
    Storefront,
    Tag,
    Tooth,
    Ear,
} from '@phosphor-icons/react'

const ICON_MAP = {
    HouseLine,
    User,
    Users,
    UserPlus,
    UserList,
    ArrowLeft,
    Copy,
    Bell,
    ArrowsOut,
    ArrowsIn,
    Drop,
    Waveform,
    Scan,
    MinusCircle,
    Globe,
    Translate,
    Cloud,
    Gear,
    Tooth,
    Ear,
    Question,
    Storefront,
    Bicycle,
    Flask,
    UsersThree,
    Newspaper,
    BookOpenText,
    Folders,
    ChatCircleDots,
    FileText,
    ShieldCheck,
    Scales,
    GlobeHemisphereWest,
    CalendarCheck,
    CalendarPlus,
    ClipboardText,
    Stethoscope,
    Microscope,
    FirstAidKit,
    Pulse,
    Receipt,
    ChartBar,
    ArrowsClockwise,
    SignOut,
    FloppyDisk,
    Trash,
    PencilSimple,
    Printer,
    MagnifyingGlass,
    Funnel,
    Sparkle,
    Robot,
    Camera,
    UploadSimple,
    DownloadSimple,
    LockKey,
    Signature,
    CheckCircle,
    Warning,
    WarningCircle,
    XCircle,
    Clock,
    Plus,
    PlusCircle,
    ArrowRight,
    CaretRight,
    CaretDown,
    Eye,
    QrCode,
    Hospital,
    IdentificationCard,
    Pill,
    Syringe,
    Heartbeat,
    MapPin,
    Buildings,
    CurrencyCircleDollar,
    EnvelopeSimple,
    Package,
    ListChecks,
    Key,
    UserGear,
    SealCheck,
    FileLock,
    Info,
    Lightning,
    SlidersHorizontal,
    Broom,
    Check,
    X,
}

export function ClinicIcon({ name, size = 18, weight = 'regular', className = '' }) {
    const IconComponent = ICON_MAP[name] || FileText
    return <IconComponent size={size} weight={weight} className={`shrink-0 ${className}`} aria-hidden="true" />
}

/**
 * Semantic Status Badge following UI/UX Pro Max WCAG Guidelines:
 * Never rely on color alone — combines subtle background, border, vector icon/ring dot, and clear typography.
 */
export function StatusBadge({ status, showText = true, compact = false, className = '' }) {
    const normalized = String(status || '').trim()

    let tone = 'info'
    let iconName = 'Clock'

    if (
        [
            'Đã khám',
            'Kết thúc khám',
            'Đã có kết quả',
            'Hoàn thành',
            'Xác nhận',
            'Đã thu',
            'Đã trả lời',
            'Đang hoạt động',
            'Hiển thị',
            'ACTIVE',
            'ACCEPTED',
            'SIGNED',
            'ISSUED',
            'THÀNH CÔNG',
        ].includes(normalized) ||
        normalized.includes('100%') ||
        normalized.includes('ự động')
    ) {
        tone = 'success'
        iconName = 'CheckCircle'
    } else if (
        [
            'Đang khám',
            'Chờ khám',
            'Chờ xác nhận',
            'Chờ thực hiện',
            'Đang thực hiện',
            'Chờ CLS',
            'Chờ thu',
            'Chờ phản hồi',
            'EXPIRING_SOON',
            'DRAFT',
            'VALIDATED',
            'SUBMISSION_PENDING',
            'SUBMITTED',
            'RETRY_PENDING',
        ].includes(normalized) ||
        normalized.includes('Phát hiện')
    ) {
        tone = 'warning'
        iconName = normalized.includes('Đang') ? 'Pulse' : 'Clock'
    } else if (
        [
            'Từ chối',
            'Đã hủy',
            'EXPIRED',
            'SUSPENDED',
            'REVOKED',
            'REJECTED',
            'Ẩn',
            'Ngừng',
        ].includes(normalized) ||
        normalized.includes('CHẶN')
    ) {
        tone = 'danger'
        iconName = 'XCircle'
    }

    const styles = {
        success: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20',
        warning: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20',
        danger: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20',
        info: 'bg-[#E8F4FD] text-[#003553] border-[#B8E5FA] ring-[#00B5F1]/20',
    }

    const dotStyles = {
        success: 'bg-emerald-500 ring-2 ring-emerald-200',
        warning: 'bg-amber-500 ring-2 ring-amber-200',
        danger: 'bg-rose-500 ring-2 ring-rose-200',
        info: 'bg-[#00B5F1] ring-2 ring-[#B8E5FA]',
    }

    if (!showText) {
        return (
            <span
                title={normalized}
                aria-label={normalized}
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full border ${styles[tone]} ${className}`}
            >
                <ClinicIcon name={iconName} size={14} weight="fill" />
            </span>
        )
    }

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border font-bold tracking-tight ${
                compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
            } ${styles[tone]} ${className}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[tone]}`} aria-hidden="true" />
            <span>{normalized}</span>
        </span>
    )
}

export function EmptyState({
    icon = 'ClipboardText',
    title = 'Chưa có dữ liệu hiển thị',
    description = 'Vui lòng chọn điều kiện lọc khác hoặc thêm bản ghi mới vào hệ thống.',
}) {
    return (
        <div className="py-8 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F4FD] text-[#00B5F1] flex items-center justify-center mb-2.5 shadow-2xs border border-[#CBE9FA]">
                <ClinicIcon name={icon} size={22} weight="duotone" />
            </div>
            <p className="text-xs font-bold text-[#003553]">{title}</p>
            {description && <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">{description}</p>}
        </div>
    )
}

export {
    HouseLine,
    User,
    Users,
    UserPlus,
    UserList,
    ArrowLeft,
    Copy,
    Newspaper,
    BookOpenText,
    Folders,
    ChatCircleDots,
    FileText,
    ShieldCheck,
    Scales,
    GlobeHemisphereWest,
    CalendarCheck,
    CalendarPlus,
    ClipboardText,
    Stethoscope,
    Microscope,
    FirstAidKit,
    Pulse,
    Receipt,
    ChartBar,
    ArrowsClockwise,
    SignOut,
    FloppyDisk,
    Trash,
    PencilSimple,
    Printer,
    MagnifyingGlass,
    Funnel,
    Sparkle,
    Robot,
    Camera,
    UploadSimple,
    DownloadSimple,
    LockKey,
    Signature,
    CheckCircle,
    Warning,
    WarningCircle,
    XCircle,
    Clock,
    Plus,
    PlusCircle,
    ArrowRight,
    CaretRight,
    CaretLeft,
    CaretDown,
    Eye,
    QrCode,
    Hospital,
    IdentificationCard,
    Pill,
    Syringe,
    Heartbeat,
    MapPin,
    Buildings,
    CurrencyCircleDollar,
    EnvelopeSimple,
    Package,
    ListChecks,
    Key,
    UserGear,
    SealCheck,
    FileLock,
    Info,
    Lightning,
    SlidersHorizontal,
    Broom,
    Check,
    X,
    UserCheck,
    PhoneCall,
    ChatTeardropDots,
    Flask,
    Bicycle,
    ClockCounterClockwise,
    UsersThree,
    Bell,
    ArrowsOut,
    ArrowsIn,
    Drop,
    Waveform,
    Scan,
    MinusCircle,
    Globe,
    Translate,
    Storefront,
    Gear,
    Tag,
    Question,
    Cloud,
    Tooth,
    Ear,
}


