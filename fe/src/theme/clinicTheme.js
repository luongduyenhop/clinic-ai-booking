const LOCKED_BASE_TOKENS = {
    colorPrimary: '#0077AA',
    colorPrimaryHover: '#005F8A',
    colorPrimaryActive: '#004E73',
    colorTextHeading: '#003553',
    colorText: '#0F172A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748B',
    colorBorder: '#E2E8F0',
    colorBorderSecondary: '#E2E8F0',
    colorBgLayout: '#F8FAFC',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorLink: '#0077AA',
    colorLinkHover: '#005F8A',
    colorLinkActive: '#004E73',
    colorSuccess: '#047857',
    colorWarning: '#FFB54A',
    colorError: '#E11D48',
    colorInfo: '#0077AA',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
    boxShadowSecondary: '0 1px 2px rgba(15, 23, 42, 0.06)',
    fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    fontFamilyCode: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
}

function buildAntdTheme({ radius, controlHeight, tablePaddingBlock, tablePaddingInline }) {
    return {
        token: {
            ...LOCKED_BASE_TOKENS,
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
                headerBg: '#F1F5F9',
                headerColor: '#003553',
                headerSplitColor: '#E2E8F0',
                borderColor: '#E2E8F0',
                rowHoverBg: '#F8FAFC',
                borderRadius: radius,
                cellPaddingBlock: tablePaddingBlock,
                cellPaddingInline: tablePaddingInline,
            },
            Descriptions: {
                labelBg: '#F1F5F9',
                colorTextLabel: '#003553',
                colorSplit: '#E2E8F0',
                borderRadiusLG: radius,
            },
            Modal: {
                borderRadiusLG: radius,
                headerBg: '#FFFFFF',
                titleColor: '#003553',
            },
            Card: {
                borderRadiusLG: radius,
                colorBorderSecondary: '#E2E8F0',
            },
            Segmented: {
                itemSelectedBg: '#FFFFFF',
                itemSelectedColor: '#003553',
                trackBg: '#F1F5F9',
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
})

export const CLINICAL_ANTD_THEME = buildAntdTheme({
    radius: 6,
    controlHeight: 32,
    tablePaddingBlock: 8,
    tablePaddingInline: 10,
})

export const CLINICAL_WORKBENCH_PREFIXES = ['/admin', '/doctor', '/reception', '/staff']

export function isClinicalWorkbenchPath(pathname = '') {
    const normalizedPath = typeof pathname === 'string' ? pathname : ''
    return CLINICAL_WORKBENCH_PREFIXES.some(
        (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    )
}
