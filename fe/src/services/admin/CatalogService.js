import { BaseServices } from '../BaseService'

export class CatalogService extends BaseServices {
    getDepartments = async (params = {}) => {
        try {
            const query = new URLSearchParams()
            if (params.isActive !== undefined && params.isActive !== null) {
                query.append('is_active', params.isActive)
            }
            const qs = query.toString() ? `?${query.toString()}` : ''
            const res = await this.get(`/api/v1/admin/catalog/departments${qs}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    createDepartment = async (payload) => {
        const res = await this.post('/api/v1/admin/catalog/departments', payload)
        return res.data?.data || res.data
    }

    updateDepartment = async (id, payload) => {
        const res = await this.put(`/api/v1/admin/catalog/departments/${id}`, payload)
        return res.data?.data || res.data
    }

    deleteDepartment = async (id) => {
        const res = await this.delete(`/api/v1/admin/catalog/departments/${id}`)
        return res.data?.data || res.data
    }

    getRooms = async (params = {}) => {
        try {
            const query = new URLSearchParams()
            if (params.loaiPhong) query.append('loai_phong', params.loaiPhong)
            if (params.chuyenKhoaId) query.append('chuyen_khoa_id', params.chuyenKhoaId)
            if (params.isActive !== undefined && params.isActive !== null) {
                query.append('is_active', params.isActive)
            }
            const qs = query.toString() ? `?${query.toString()}` : ''
            const res = await this.get(`/api/v1/admin/catalog/rooms${qs}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    createRoom = async (payload) => {
        const res = await this.post('/api/v1/admin/catalog/rooms', payload)
        return res.data?.data || res.data
    }

    updateRoom = async (id, payload) => {
        const res = await this.put(`/api/v1/admin/catalog/rooms/${id}`, payload)
        return res.data?.data || res.data
    }

    deleteRoom = async (id) => {
        const res = await this.delete(`/api/v1/admin/catalog/rooms/${id}`)
        return res.data?.data || res.data
    }

    getServices = async () => {
        try {
            const res = await this.get('/api/v1/admin/catalog/services', {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    createService = async (payload) => {
        const res = await this.post('/api/v1/admin/catalog/services', payload)
        return res.data?.data || res.data
    }

    updateService = async (id, payload) => {
        const res = await this.put(`/api/v1/admin/catalog/services/${id}`, payload)
        return res.data?.data || res.data
    }

    deleteService = async (id) => {
        const res = await this.delete(`/api/v1/admin/catalog/services/${id}`)
        return res.data?.data || res.data
    }

    getPrices = async (serviceId) => {
        try {
            const query = serviceId ? `?service_id=${serviceId}` : ''
            const res = await this.get(`/api/v1/admin/catalog/prices${query}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    updatePrice = async (payload) => {
        const res = await this.post('/api/v1/admin/catalog/prices', payload)
        return res.data?.data || res.data
    }

    getPriceHistory = async (serviceId) => {
        try {
            const query = serviceId ? `?service_id=${serviceId}` : ''
            const res = await this.get(`/api/v1/admin/catalog/prices/history${query}`, {
                __skipGlobalLoading: true,
                __skipRefresh: true,
            })
            return res.data?.data || res.data || []
        } catch {
            return []
        }
    }

    importCatalog = async (payload) => {
        const res = await this.post('/api/v1/admin/catalog/import', payload)
        return res.data?.data || res.data
    }
}

export const catalogService = new CatalogService()
