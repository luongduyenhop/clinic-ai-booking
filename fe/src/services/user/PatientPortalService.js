import { BaseServices } from '../BaseService.js'

class PatientPortalService extends BaseServices {
  getProfile() { return this.get('/api/v1/patient/profile') }
  updateProfile(payload) { return this.put('/api/v1/patient/profile', payload) }
  getFamilyMembers() { return this.get('/api/v1/patient/family-members') }
  addFamilyMember(member) { return this.post('/api/v1/patient/family-members', member) }
  deleteFamilyMember(id) { return this.delete('/api/v1/patient/family-members/' + id) }
  getInvoices() { return this.get('/api/v1/patient/invoices') }
  getMedicalRecords() { return this.get('/api/v1/patient/medical-records') }
  getPrescriptionsPage(page = 1, signal) {
    return this.get('/api/v1/patient/prescriptions', { params: { page, page_size: 20 }, signal })
  }
  getLabResultsPage(page = 1, signal) {
    return this.get('/api/v1/patient/lab-results', { params: { page, page_size: 20 }, signal })
  }
  getBookings() { return this.get('/api/v1/appointments/my-appointments') }
  findLostPatientCode(keyword) { return this.post('/api/v1/patient/find-lost-code', { keyword }) }
  submitFeedback(payload) { return this.post('/api/v1/patient/feedback', payload) }
}
export const patientPortalService = new PatientPortalService()
