import { useEffect, useState } from 'react'
import { http } from '../BaseService'

export const medicalCatalogService = {
  async getSpecialties() {
    const response = await http.get('/api/v1/medical/specialties')
    const data = response?.data?.data
    if (!Array.isArray(data)) throw new Error('Danh sách chuyên khoa không hợp lệ')
    return data.map(item => ({
      id: String(item.id), realId: item.id, name: item.ten_chuyen_khoa,
      description: item.mo_ta || '', doctorCount: item.so_luong_bac_si ?? 0,
      room: item.vi_tri_phong || '', code: item.ma_chuyen_khoa,
    }))
  },
  async getDoctors() {
    const response = await http.get('/api/v1/medical/doctors', { params: { page: 1, page_size: 100 } })
    const data = response?.data?.data
    if (!Array.isArray(data)) throw new Error('Danh sách bác sĩ không hợp lệ')
    return data.map(item => ({
      id: String(item.id), realId: item.id, name: item.ho_ten,
      specialtyId: String(item.chuyen_khoa_id || ''), specialty: item.chuyen_khoa,
      experience: item.nam_kinh_nghiem ? `${item.nam_kinh_nghiem} năm kinh nghiệm` : '',
      initials: item.ho_ten.split(/\s+/).slice(-2).map(word => word[0]).join('').toUpperCase(),
      room: item.vi_tri_phong || '', fee: Number(item.gia_kham_mac_dinh || 0),
      degree: item.hoc_vi || '',
    }))
  },
}

export function useMedicalCatalog() {
  const [state, setState] = useState({ specialties: [], doctors: [], loading: true, error: '' })
  useEffect(() => {
    let alive = true
    Promise.all([medicalCatalogService.getSpecialties(), medicalCatalogService.getDoctors()])
      .then(([specialties, doctors]) => { if (alive) setState({ specialties, doctors, loading: false, error: '' }) })
      .catch(error => { if (alive) setState({ specialties: [], doctors: [], loading: false, error: error.response?.data?.message || error.message || 'Không thể tải danh mục bác sĩ' }) })
    return () => { alive = false }
  }, [])
  return state
}
