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
    Star,
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
    CloudArrowUp,
    Gear,
    Question,
    Storefront,
    Tag,
    Tooth,
    Ear,
    SpeakerHigh,
    BookmarkSimple,
    Calendar,
    CalendarX,
    Certificate,
    GraduationCap,
    PaperPlaneTilt,
    Pen,
    Phone,
    PushPin,
    UserCircle,
    ArrowsLeftRight,
    ArrowCounterClockwise,
    DotsThreeVertical,
    ListBullets,
    SquaresFour,
    PlayCircle,
    UserMinus,
    Table,
    TreeStructure,
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
    CloudArrowUp,
    Gear,
    Tooth,
    Ear,
    SpeakerHigh,
    BookmarkSimple,
    Calendar,
    CalendarX,
    Certificate,
    GraduationCap,
    PaperPlaneTilt,
    Pen,
    Phone,
    PushPin,
    UserCircle,
    ArrowsLeftRight,
    ArrowCounterClockwise,
    DotsThreeVertical,
    ListBullets,
    SquaresFour,
    PlayCircle,
    UserMinus,
    Table,
    TreeStructure,
    CaretLeft,
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
    Star,
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

export const STATUS_LABEL_MAP = {
    ACTIVE: 'Đang hoạt động',
    EXPIRING_SOON: 'Sắp hết hạn',
    EXPIRED: 'Đã hết hạn',
    SUSPENDED: 'Đang đình chỉ',
    REVOKED: 'Đã thu hồi',
    ACCEPTED: 'Đã liên thông',
    SIGNED: 'Đã ký số',
    ISSUED: 'Đã cấp',
    DRAFT: 'Bản nháp',
    VALIDATED: 'Đã kiểm tra',
    SUBMISSION_PENDING: 'Chờ gửi liên thông',
    SUBMITTED: 'Đã gửi liên thông',
    RETRY_PENDING: 'Chờ gửi lại',
    CHO_DUYET: 'Chờ duyệt',
    DA_DUYET: 'Đã duyệt',
    TU_CHOI: 'Từ chối',
    SUCCESS: 'Thành công',
    FAILED: 'Thất bại',
    FAILURE: 'Thất bại',
    ONLINE: 'Trực tuyến',
    OFFLINE: 'Ngoại tuyến',
    CONNECTED: 'Đã kết nối',
    DISCONNECTED: 'Mất kết nối',
    da_thu: 'Đã thu tiền',
    chua_thu: 'Chưa thu',
    hoan_tien_mot_phan: 'Hoàn một phần',
    da_hoan_tien: 'Đã hoàn tiền',
    da_huy: 'Đã hủy',
    cho_kham: 'Chờ khám',
    dang_kham: 'Đang khám',
    da_kham: 'Đã khám',
    cho_thuc_hien: 'Chờ thực hiện',
    dang_thuc_hien: 'Đang thực hiện',
    da_co_ket_qua: 'Đã có kết quả',
    ket_thuc_kham: 'Kết thúc khám',
}

export function StatusBadge({ status, text, showText = true, compact = false, className = '' }) {
    const normalized = String(status || '').trim()
    const displayText = text || STATUS_LABEL_MAP[normalized] || normalized

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
            'SUCCESS',
            'ONLINE',
            'CONNECTED',
            'DA_DUYET',
            'da_thu',
            'da_hoan_tien',
            'Đã duyệt',
            'Đã liên thông',
            'Đã ký số',
            'Trực tuyến',
            'Đã kết nối',
            'Đã thu tiền',
        ].includes(normalized) ||
        [
            'Đã khám',
            'Kết thúc khám',
            'Đã có kết quả',
            'Hoàn thành',
            'Xác nhận',
            'Đã thu',
            'Đang hoạt động',
            'Đã duyệt',
            'Đã liên thông',
            'Đã ký số',
            'Trực tuyến',
            'Đã kết nối',
            'Đã thu tiền',
            'Thành công',
        ].includes(displayText) ||
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
            'CHO_DUYET',
            'cho_kham',
            'dang_kham',
            'chua_thu',
            'hoan_tien_mot_phan',
            'Sắp hết hạn',
            'Bản nháp',
            'Chờ gửi liên thông',
            'Chờ gửi lại',
            'Chờ duyệt',
            'Hoàn một phần',
        ].includes(normalized) ||
        [
            'Đang khám',
            'Chờ khám',
            'Chờ xác nhận',
            'Chờ thực hiện',
            'Đang thực hiện',
            'Sắp hết hạn',
            'Bản nháp',
            'Chờ gửi liên thông',
            'Chờ gửi lại',
            'Chờ duyệt',
            'Hoàn một phần',
        ].includes(displayText) ||
        normalized.includes('Phát hiện')
    ) {
        tone = 'warning'
        iconName = normalized.includes('Đang') || displayText.includes('Đang') ? 'Pulse' : 'Clock'
    } else if (
        [
            'Từ chối',
            'Đã hủy',
            'EXPIRED',
            'SUSPENDED',
            'REVOKED',
            'REJECTED',
            'TU_CHOI',
            'FAILED',
            'FAILURE',
            'DISCONNECTED',
            'da_huy',
            'Ẩn',
            'Ngừng',
            'Đã hết hạn',
            'Đang đình chỉ',
            'Đã thu hồi',
            'Thất bại',
            'Mất kết nối',
        ].includes(normalized) ||
        [
            'Từ chối',
            'Đã hủy',
            'Đã hết hạn',
            'Đang đình chỉ',
            'Đã thu hồi',
            'Thất bại',
            'Mất kết nối',
        ].includes(displayText) ||
        normalized.includes('CHẶN')
    ) {
        tone = 'danger'
        iconName = 'XCircle'
    }

    const styles = {
        success: 'bg-clinic-success-bg text-clinic-success border-clinic-success-border',
        warning: 'bg-clinic-warning-bg text-clinic-warning border-clinic-warning-border',
        danger: 'bg-clinic-danger-bg text-clinic-danger border-clinic-danger-border',
        info: 'bg-clinic-surface-alt text-clinic-navy border-clinic-info-border',
    }

    const dotStyles = {
        success: 'bg-clinic-success',
        warning: 'bg-clinic-warning',
        danger: 'bg-clinic-danger',
        info: 'bg-clinic-cta',
    }

    if (!showText) {
        return (
            <span
                title={displayText}
                aria-label={displayText}
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
            <span>{displayText}</span>
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
            <div className="w-11 h-11 rounded-[8px] bg-clinic-surface-alt text-clinic-cta flex items-center justify-center mb-2.5 border border-clinic-info-border">
                <ClinicIcon name={icon} size={22} weight="duotone" />
            </div>
            <p className="text-xs font-bold text-clinic-navy">{title}</p>
            {description && <p className="text-[11px] text-clinic-text-muted mt-0.5 max-w-xs">{description}</p>}
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
    Star,
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
    CloudArrowUp,
    Tooth,
    Ear,
    SpeakerHigh,
    BookmarkSimple,
    Calendar,
    CalendarX,
    Certificate,
    GraduationCap,
    PaperPlaneTilt,
    Pen,
    Phone,
    PushPin,
    UserCircle,
    ArrowsLeftRight,
    ArrowCounterClockwise,
    DotsThreeVertical,
    ListBullets,
    SquaresFour,
    PlayCircle,
    UserMinus,
    Table,
    TreeStructure,
}

function createInlineIcon(IconComp, defaultWeight = 'regular') {
    return function InlinePhosphorIcon({ size = 15, weight = defaultWeight, spin = false, className = '', style }) {
        return (
            <IconComp
                size={size}
                weight={weight}
                style={style}
                className={`inline-block align-[-0.125em] shrink-0 ${spin ? 'animate-spin' : ''} ${className}`.trim()}
                aria-hidden="true"
            />
        )
    }
}

export const AlertOutlined = createInlineIcon(Warning)
export const ApartmentOutlined = createInlineIcon(TreeStructure)
export const AppstoreOutlined = createInlineIcon(SquaresFour)
export const CalendarOutlined = createInlineIcon(CalendarCheck)
export const CheckCircleOutlined = createInlineIcon(CheckCircle)
export const CheckOutlined = createInlineIcon(Check, 'bold')
export const ClearOutlined = createInlineIcon(Broom)
export const ClockCircleOutlined = createInlineIcon(Clock)
export const CloseCircleOutlined = createInlineIcon(XCircle)
export const DollarCircleOutlined = createInlineIcon(CurrencyCircleDollar)
export const DollarOutlined = createInlineIcon(CurrencyCircleDollar)
export const EditOutlined = createInlineIcon(PencilSimple)
export const EnvironmentOutlined = createInlineIcon(MapPin)
export const ExclamationCircleOutlined = createInlineIcon(WarningCircle)
export const EyeOutlined = createInlineIcon(Eye)
export const FieldTimeOutlined = createInlineIcon(Clock)
export const HistoryOutlined = createInlineIcon(ClockCounterClockwise)
export const LeftOutlined = createInlineIcon(CaretLeft, 'bold')
export const LockOutlined = createInlineIcon(LockKey)
export const MedicineBoxOutlined = createInlineIcon(FirstAidKit)
export const MoreOutlined = createInlineIcon(DotsThreeVertical, 'bold')
export const PhoneOutlined = createInlineIcon(PhoneCall)
export const PlayCircleOutlined = createInlineIcon(PlayCircle)
export const PlusOutlined = createInlineIcon(Plus, 'bold')
export const PrinterOutlined = createInlineIcon(Printer)
export const QrcodeOutlined = createInlineIcon(QrCode)
export const ReloadOutlined = createInlineIcon(ArrowsClockwise)
export const RightOutlined = createInlineIcon(CaretRight, 'bold')
export const RollbackOutlined = createInlineIcon(ArrowCounterClockwise)
export const SearchOutlined = createInlineIcon(MagnifyingGlass)
export const SlidersOutlined = createInlineIcon(SlidersHorizontal)
export const SoundOutlined = createInlineIcon(SpeakerHigh)
export const SwapOutlined = createInlineIcon(ArrowsLeftRight)
export const SyncOutlined = createInlineIcon(ArrowsClockwise)
export const TableOutlined = createInlineIcon(Table)
export const ThunderboltOutlined = createInlineIcon(Lightning)
export const UnorderedListOutlined = createInlineIcon(ListBullets)
export const UserAddOutlined = createInlineIcon(UserPlus)
export const UserDeleteOutlined = createInlineIcon(UserMinus)
export const UserOutlined = createInlineIcon(User)
export const WarningOutlined = createInlineIcon(Warning)

export default ClinicIcon


