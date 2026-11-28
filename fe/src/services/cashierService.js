import { http } from './BaseService'

class CashierService {
    async getUnbilledEncounters(page = 1, pageSize = 50) {
        const response = await http.get('/api/v1/cashier/unbilled-encounters', {
            params: { page, page_size: pageSize }
        })
        return response.data?.data || { items: [], total: 0 }
    }

    async getInvoicePreview(luotKhamId) {
        const response = await http.get(`/api/v1/cashier/encounters/${luotKhamId}/invoice-preview`)
        return response.data?.data
    }

    async getInvoices({
        trangThai = null,
        tuKhoa = null,
        tuNgay = null,
        denNgay = null,
        caKham = null,
        page = 1,
        pageSize = 200,
    } = {}) {
        const params = { page, page_size: pageSize }
        if (trangThai) {
            params.trang_thai = trangThai
        }
        if (tuKhoa) {
            params.tu_khoa = tuKhoa
        }
        if (tuNgay) {
            params.tu_ngay = tuNgay
        }
        if (denNgay) {
            params.den_ngay = denNgay
        }
        if (caKham && caKham !== 'ALL') {
            params.ca_kham = caKham
        }
        const response = await http.get('/api/v1/cashier/invoices', { params })
        return response.data?.data || { items: [], total: 0 }
    }

    async getPendingBills(maKcb = null, page = 1, pageSize = 50) {
        const params = { page, page_size: pageSize }
        if (maKcb) {
            params.ma_kcb = maKcb
        }
        const response = await http.get('/api/v1/cashier/pending-bills', { params })
        return response.data?.data || { items: [], total: 0 }
    }

    async createInvoice(payload) {
        const response = await http.post('/api/v1/cashier/invoices', payload)
        return response.data?.data
    }

    async getInvoiceDetail(invoiceId) {
        const response = await http.get(`/api/v1/cashier/invoices/${invoiceId}`)
        return response.data?.data
    }

    async payInvoice(invoiceId, payload) {
        const response = await http.post(`/api/v1/cashier/invoices/${invoiceId}/pay`, payload)
        return response.data?.data
    }

    async cancelInvoice(invoiceId, lyDo) {
        const response = await http.post(`/api/v1/cashier/invoices/${invoiceId}/cancel`, null, {
            params: { ly_do: lyDo }
        })
        return response.data?.data
    }

    async getShiftSummary() {
        const response = await http.get('/api/v1/cashier/shift-summary')
        return response.data?.data
    }

    async closeShift(payload) {
        const response = await http.post('/api/v1/cashier/close-shift', payload)
        return response.data?.data
    }
}

export const cashierService = new CashierService()
export default cashierService
