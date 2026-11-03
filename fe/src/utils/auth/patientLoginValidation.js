import * as Yup from 'yup'

const emailSchema = Yup.string().email()
const phonePattern = /^0\d{9}$/

export const patientLoginValidationSchema = Yup.object({
    usernameOrEmail: Yup.string()
        .trim()
        .required('Vui lòng nhập số điện thoại hoặc email')
        .test(
            'phone-or-email',
            'Vui lòng nhập email hợp lệ hoặc số điện thoại gồm 10 chữ số bắt đầu bằng 0',
            (value) => !value || phonePattern.test(value) || emailSchema.isValidSync(value),
        ),
    password: Yup.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').required('Vui lòng nhập mật khẩu'),
})

export function buildPatientLoginCredentials(values) {
    return { usernameOrEmail: values.usernameOrEmail.trim(), password: values.password }
}
