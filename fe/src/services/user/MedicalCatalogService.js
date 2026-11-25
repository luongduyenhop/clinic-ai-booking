import { useEffect, useState } from 'react'
import { http } from '../BaseService.js'
import { toFriendlyErrorMessage } from '../../utils/helpers/clientErrorHelper.js'
import {
    formatPublicDoctorName,
    getSpecialtyClinicalMetadata,
    isAutomatedTestDoctorRecord,
    isAutomatedTestSpecialtyRecord,
} from '../../utils/helpers/quickBookingHelpers.js'

export {
    formatPublicDoctorName,
    getSpecialtyClinicalMetadata,
    isAutomatedTestDoctorRecord,
    isAutomatedTestSpecialtyRecord,
}

function formatDoctorInitials(fullName = '') {
    const cleanedWords = String(fullName)
        .replace(/\[[^\]]*\]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((word) => /^[A-Za-zÀ-ỹ]/i.test(word))
    if (!cleanedWords.length) return 'BS'
    return cleanedWords.slice(-2).map((word) => word[0]).join('').toUpperCase()
}

export const medicalCatalogService = {
    async getSpecialties() {
        const response = await http.get('/api/v1/medical/specialties')
        const data = response?.data?.data
        if (!Array.isArray(data)) throw new Error('Danh sách chuyên khoa không hợp lệ')
        return data
            .filter((item) => !isAutomatedTestSpecialtyRecord(item))
            .map((item) => {
            const meta = getSpecialtyClinicalMetadata(item.ma_chuyen_khoa || item.ten_chuyen_khoa)
            return {
                id: String(item.id),
                realId: item.id,
                name: item.ten_chuyen_khoa,
                description: item.mo_ta || '',
                doctorCount: item.so_luong_bac_si ?? 0,
                room: item.vi_tri_phong || meta.floor,
                code: item.ma_chuyen_khoa,
                fee: Number(item.gia_kham_mac_dinh || meta.fee),
                services: meta.services,
                scheduleNote: 'Thứ 2 – Thứ 7 · 07:30 – 17:30',
            }
        })
    },
    async getDoctors() {
        const response = await http.get('/api/v1/medical/doctors', { params: { page: 1, page_size: 100 } })
        const data = response?.data?.data
        if (!Array.isArray(data)) throw new Error('Danh sách bác sĩ không hợp lệ')
        return data
            .filter((item) => !isAutomatedTestDoctorRecord(item))
            .map((item) => {
                const displayName = formatPublicDoctorName(item.ho_ten)
                return {
                    id: String(item.id),
                    realId: item.id,
                    name: displayName,
                    specialtyId: String(item.chuyen_khoa_id || ''),
                    specialty: item.chuyen_khoa,
                    experience: item.nam_kinh_nghiem ? `${item.nam_kinh_nghiem} năm kinh nghiệm` : '',
                    initials: formatDoctorInitials(displayName),
                    room: item.vi_tri_phong || '',
                    fee: Number(item.gia_kham_mac_dinh || 0),
                    degree: item.hoc_vi || '',
                }
            })
    },
}

export function useMedicalCatalog() {
    const [state, setState] = useState({ specialties: [], doctors: [], loading: true, error: '' })
    useEffect(() => {
        let alive = true
        Promise.all([medicalCatalogService.getSpecialties(), medicalCatalogService.getDoctors()])
            .then(([specialties, doctors]) => {
                if (alive) setState({ specialties, doctors, loading: false, error: '' })
            })
            .catch((error) => {
                if (alive) {
                    setState({
                        specialties: [],
                        doctors: [],
                        loading: false,
                        error: toFriendlyErrorMessage(
                            error,
                            'Chưa tải được lịch khám. Bạn thử lại sau ít phút hoặc gọi 1900 6868.'
                        ),
                    })
                }
            })
        return () => {
            alive = false
        }
    }, [])
    return state
}
