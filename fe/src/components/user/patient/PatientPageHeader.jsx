export default function PatientPageHeader({ title, description, action }) {
    return (
        <header className="mb-6 pb-4 border-b border-clinic-border flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 className="font-display text-[22px] sm:text-[26px] font-extrabold tracking-tight text-clinic-navy">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-6 text-clinic-text-secondary">
                        {description}
                    </p>
                )}
            </div>
            {action}
        </header>
    )
}
