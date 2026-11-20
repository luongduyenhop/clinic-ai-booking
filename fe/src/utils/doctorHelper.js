import { formatUnifiedDoctorName } from './helpers/doctorNameHelper.js'

export const formatDoctorName = (name, title = '') =>
    formatUnifiedDoctorName(name, title, { defaultPrefix: 'BS.' })
