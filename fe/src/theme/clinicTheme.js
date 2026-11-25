const LOCKED_BASE_TOKENS = {
    colorPrimary: '#0077AA',
    colorPrimaryHover: '#005F8A',
    colorPrimaryActive: '#004E73',
    colorTextHeading: '#003553',
    colorText: '#0F172A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748B',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorLink: '#0077AA',
    colorLinkHover: '#005F8A',
    colorLinkActive: '#004E73',
    colorSuccess: '#047857',
    colorSuccessBg: '#ECFDF5',
    colorSuccessBorder: '#A7F3D0',
    colorWarning: '#FFB54A',
    colorWarningBg: '#FFFBEB',
    colorWarningBorder: '#FDE68A',
    colorError: '#E11D48',
    colorErrorBg: '#FFF1F2',
    colorErrorBorder: '#FECDD3',
    colorInfo: '#0077AA',
    colorInfoBg: '#E8F4FD',
    colorInfoBorder: '#BAE6FD',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
    boxShadowSecondary: '0 1px 2px rgba(15, 23, 42, 0.05)',
    fontFamilyCode: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
}

function buildAntdTheme({
    radius,
    controlHeight,
    tablePaddingBlock,
    tablePaddingInline,
    fontFamily,
    bgLayout,
    bgMuted,
    bgHover,
    borderColor,
}) {
    return {
        token: {
            ...LOCKED_BASE_TOKENS,
            fontFamily,
            colorBgLayout: bgLayout,
            colorBorder: borderColor,
            colorBorderSecondary: borderColor,
            borderRadius: radius,
            borderRadiusLG: radius,
            borderRadiusSM: Math.max(4, radius - 2),
            borderRadiusXS: 4,
            controlHeight,
        },
        components: {
            Button: {
                borderRadius: radius,
                borderRadiusLG: radius,
                borderRadiusSM: Math.max(4, radius - 2),
                controlHeight,
                fontWeight: 600,
                primaryShadow: 'none',
                defaultShadow: 'none',
                dangerShadow: 'none',
            },
            Table: {
                headerBg: bgMuted,
                headerColor: '#003553',
                headerSplitColor: borderColor,
                borderColor,
                rowHoverBg: bgHover,
                borderRadius: radius,
                cellPaddingBlock: tablePaddingBlock,
                cellPaddingInline: tablePaddingInline,
            },
            Descriptions: {
                labelBg: bgMuted,
                colorTextLabel: '#003553',
                colorSplit: borderColor,
                borderRadiusLG: radius,
            },
            Modal: {
                borderRadiusLG: radius,
                headerBg: '#FFFFFF',
                titleColor: '#003553',
            },
            Card: {
                borderRadiusLG: radius,
                colorBorderSecondary: borderColor,
            },
            Segmented: {
                itemSelectedBg: '#FFFFFF',
                itemSelectedColor: '#003553',
                trackBg: bgMuted,
                borderRadius: radius,
                borderRadiusSM: Math.max(4, radius - 2),
            },
            Tag: {
                borderRadiusSM: 9999,
            },
            Select: {
                borderRadius: radius,
                controlHeight,
                colorPrimary: '#0077AA',
                colorPrimaryHover: '#005F8A',
                controlOutline: 'rgba(0, 119, 170, 0.14)',
            },
            Input: {
                borderRadius: radius,
                controlHeight,
                colorPrimary: '#0077AA',
                colorPrimaryHover: '#005F8A',
                activeShadow: '0 0 0 3px rgba(0, 119, 170, 0.14)',
            },
            DatePicker: {
                borderRadius: radius,
                controlHeight,
                colorPrimary: '#0077AA',
                colorPrimaryHover: '#005F8A',
                activeShadow: '0 0 0 3px rgba(0, 119, 170, 0.14)',
            },
        },
    }
}

export const PATIENT_ANTD_THEME = buildAntdTheme({
    radius: 8,
    controlHeight: 40,
    tablePaddingBlock: 12,
    tablePaddingInline: 14,
    fontFamily: '"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    bgLayout: '#FAF9F5',
    bgMuted: '#F3F1EC',
    bgHover: '#FAF9F5',
    borderColor: '#E7E5E0',
})

export const CLINICAL_ANTD_THEME = buildAntdTheme({
    radius: 6,
    controlHeight: 32,
    tablePaddingBlock: 8,
    tablePaddingInline: 10,
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    bgLayout: '#F8FAFC',
    bgMuted: '#F1F5F9',
    bgHover: '#F8FAFC',
    borderColor: '#E2E8F0',
})

export const CLINICAL_WORKBENCH_PREFIXES = ['/admin', '/doctor', '/reception', '/staff']

export function isClinicalWorkbenchPath(pathname = '') {
    const normalizedPath = typeof pathname === 'string' ? pathname : ''
    return CLINICAL_WORKBENCH_PREFIXES.some(
        (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    )
}
