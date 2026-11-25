const SINGLE_DOCTOR_TITLE_REGEX = /^(?:P\.?\s*GS\.?\s*(?:TS\.?)?(?:\s*BS\.?)?|GS\.?\s*(?:TS\.?)?(?:\s*BS\.?)?|TS\.?\s*(?:BS\.?)?|ThS\.?\s*(?:BS\.?)?|BS\.?\s*(?:CK\s*II|CKII|CK\s*I|CKI)?|CK\s*II|CKII|CK\s*I|CKI|Bác\s+sĩ)(?=\s|$|\.)\.?\s*/i

const GENERIC_ROLE_PLACEHOLDER_REGEX = /^Bác\s+sĩ\s+(?:Nội\s+tổng\s+quát|Chuyên\s+khoa)$/i

const GENERIC_SHORT_TITLE_REGEX = /^(?:BS\.?|Bác\s+sĩ)$/i

export function stripDemoTag(value = '') {
    return String(value || '')
        .replace(/\s*\[DEMO\]\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
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
