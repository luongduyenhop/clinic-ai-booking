const SINGLE_DOCTOR_TITLE_REGEX = /^(?:P\.?\s*GS\.?\s*(?:TS\.?)?(?:\s*BS\.?)?|GS\.?\s*(?:TS\.?)?(?:\s*BS\.?)?|TS\.?\s*(?:BS\.?)?|ThS\.?\s*(?:BS\.?)?|BS\.?\s*(?:CK\s*II|CKII|CK\s*I|CKI)?|CK\s*II|CKII|CK\s*I|CKI|Bác\s+sĩ)(?=\s|$|\.)\.?\s*/i

const GENERIC_ROLE_PLACEHOLDER_REGEX = /^Bác\s+sĩ\s+(?:Nội\s+tổng\s+quát|Chuyên\s+khoa)$/i

const GENERIC_SHORT_TITLE_REGEX = /^(?:BS\.?|Bác\s+sĩ)$/i

export function stripDemoTag(value = '') {
    return String(value || '')
        .replace(/\s*\[[^\]]*\]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export function getAvatarInitials(rawName = '', fallback = 'NV') {
    const { bareName } = stripDoctorTitles(rawName)
    const cleanSource = String(bareName || stripDemoTag(rawName))
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^A-Za-zÀ-ỹ\s]/g, ' ')
        .trim()
    const words = cleanSource.split(/\s+/).filter(Boolean)
    if (!words.length) return fallback
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return words
        .slice(-2)
        .map((word) => word[0])
        .join('')
        .toUpperCase()
}

export function stripDoctorTitles(rawName = '') {
    let current = stripDemoTag(rawName)
    const extractedTitles = []
    if (!current || GENERIC_ROLE_PLACEHOLDER_REGEX.test(current)) {
        return { bareName: current, extractedTitles, isGenericRole: Boolean(current) }
    }
    while (current) {
        const match = current.match(SINGLE_DOCTOR_TITLE_REGEX)
        if (!match || !match[0]) break
        const nextName = current.slice(match[0].length).trim()
        if (!nextName) break
        extractedTitles.push(match[0].trim())
        current = nextName
    }
    return { bareName: current, extractedTitles, isGenericRole: false }
}

function selectPreferredTitle(cleanDegree, extractedTitles, defaultPrefix) {
    const candidates = []
    if (cleanDegree) candidates.push(cleanDegree)
    for (const title of extractedTitles) {
        if (title) candidates.push(title)
    }
    if (!candidates.length) {
        return String(defaultPrefix || '').trim()
    }
    const specific = candidates.find((item) => !GENERIC_SHORT_TITLE_REGEX.test(item))
    if (specific) return specific
    return candidates[0]
}

export function formatUnifiedDoctorName(rawName = '', degree = '', { defaultPrefix = '' } = {}) {
    const cleanedRaw = stripDemoTag(rawName)
    const cleanDegree = stripDemoTag(degree)
    if (!cleanedRaw) return cleanDegree
    if (GENERIC_ROLE_PLACEHOLDER_REGEX.test(cleanedRaw)) {
        return cleanedRaw
    }
    const { bareName, extractedTitles } = stripDoctorTitles(cleanedRaw)
    if (!bareName) return cleanDegree || cleanedRaw
    const chosenTitle = selectPreferredTitle(cleanDegree, extractedTitles, defaultPrefix)
    if (!chosenTitle) return bareName
    return `${chosenTitle} ${bareName}`
}
