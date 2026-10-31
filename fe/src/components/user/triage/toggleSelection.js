export default function toggleSelection(formik, name, item) {
    const current = formik.values[name]
    formik.setFieldValue(name, current.includes(item) ? current.filter((value) => value !== item) : [...current, item])
}
