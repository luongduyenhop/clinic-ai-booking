export const DEMO_PATIENT_ACCOUNT = Object.freeze({
    phone: '0901234567',
    password: 'Patient@123',
    role: 'PATIENT',
    user: {
        id: 'PAT-DEMO-001',
        fullName: 'Nguyễn Văn An',
        shortName: 'Văn An',
        phone: '0901234567',
        birthDate: '1995-05-20',
        gender: 'MALE',
        email: 'vanan.demo@clinic-ai.vn',
    },
})

export function isDemoPatientCredentials(credentials) {
    return credentials?.usernameOrEmail === DEMO_PATIENT_ACCOUNT.phone && credentials?.password === DEMO_PATIENT_ACCOUNT.password
}
