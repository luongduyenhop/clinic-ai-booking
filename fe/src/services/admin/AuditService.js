import { BaseServices } from '../BaseService'

export class AuditService extends BaseServices {
    getAuditLogs = (params = {}) => {
        return this.get('/api/v1/admin/audit/logs', { params })
    }
}

export const auditService = new AuditService()
