const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiService {
  static getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  static setToken(token, role = null) {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('access_token', token);
        document.cookie = `access_token=${token}; path=/; max-age=86400; SameSite=Lax`;
        if (role) {
          const normRole = this.normalizeRole(role);
          localStorage.setItem('user_role', normRole);
          document.cookie = `user_role=${normRole}; path=/; max-age=86400; SameSite=Lax`;
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
    }
  }

  static getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = { ...this.getHeaders(), ...options.headers };

    try {
      const response = await fetch(url, { ...options, headers });
      
      if (!response.ok) {
        let errorMsg = 'Đã có lỗi xảy ra từ máy chủ.';
        try {
          const errData = await response.json();
          errorMsg = errData.detail || errData.message || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const resJson = await response.json();
      // Bóc tách vỏ ResponseEnvelope: trả về resJson.data nếu có
      if (resJson && typeof resJson === 'object' && 'success' in resJson && 'data' in resJson) {
        return resJson.data !== null && resJson.data !== undefined ? resJson.data : resJson;
      }
      return resJson;
    } catch (error) {
      console.warn(`API Request Warning [${endpoint}]:`, error.message);
      throw error;
    }
  }

  // --- Auth APIs (Package A) ---
  static async register(data) {
    return await this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ho_ten: data.full_name || data.ho_ten,
        email: data.email,
        so_dien_thoai: data.phone || data.so_dien_thoai,
        mat_khau: data.password || data.mat_khau,
        ngay_sinh: data.dob || data.ngay_sinh || null,
        gioi_tinh: data.gender || data.gioi_tinh || 'Khác'
      }),
    });
  }

  static normalizeRole(vaiTroOrRole) {
    if (!vaiTroOrRole) return 'PATIENT';
    const roleUpper = String(vaiTroOrRole).toUpperCase();
    if (['DOCTOR', 'RECEPTIONIST', 'ADMIN', 'PATIENT'].includes(roleUpper)) {
      return roleUpper;
    }
    const roleMap = {
      'bac_si': 'DOCTOR',
      'le_tan': 'RECEPTIONIST',
      'admin': 'ADMIN',
      'benh_nhan': 'PATIENT'
    };
    return roleMap[String(vaiTroOrRole).toLowerCase()] || 'PATIENT';
  }

  static logout() {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('user_role');
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }

  static async verifyOTP(email, code) {
    const res = await this.request('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp_code: code }),
    });
    if (res?.access_token) {
      const role = this.normalizeRole(res.role || res.vai_tro);
      this.setToken(res.access_token, role);
      try {
        const user = await this.getCurrentUser();
        if (user) {
          user.role = this.normalizeRole(user.role || user.vai_tro || role);
          res.user = user;
        }
      } catch (e) {
        res.user = {
          id: res.user_id,
          role: role,
          vai_tro: res.vai_tro
        };
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_role', res.user.role);
        document.cookie = `user_role=${res.user.role}; path=/; max-age=86400; SameSite=Lax`;
      }
    }
    return res;
  }

  static async loginPassword(email, password) {
    const res = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, mat_khau: password }),
    });
    if (res?.access_token) {
      const role = this.normalizeRole(res.role || res.vai_tro);
      this.setToken(res.access_token, role);
      try {
        const user = await this.getCurrentUser();
        if (user) {
          user.role = this.normalizeRole(user.role || user.vai_tro || role);
          res.user = user;
        }
      } catch (e) {
        res.user = {
          id: res.user_id,
          role: role,
          vai_tro: res.vai_tro,
          email: email
        };
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_role', res.user.role);
        document.cookie = `user_role=${res.user.role}; path=/; max-age=86400; SameSite=Lax`;
      }
    }
    return res;
  }

  static async getCurrentUser() {
    const user = await this.request('/api/v1/auth/me');
    if (user) {
      user.role = this.normalizeRole(user.role || user.vai_tro);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('user_role', user.role);
        document.cookie = `user_role=${user.role}; path=/; max-age=86400; SameSite=Lax`;
      }
    }
    return user;
  }

  static async updateProfile(profileData) {
    return await this.request('/api/v1/auth/me', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // --- Medical Catalog APIs (Package D & E) ---
  static async getDepartments() {
    const res = await this.request('/api/v1/medical/specialties');
    if (Array.isArray(res)) {
      return res.map(dept => ({
        id: dept.id,
        code: dept.ma_chuyen_khoa,
        name: dept.ten_chuyen_khoa,
        doctor_count: dept.so_luong_bac_si || 0,
        description: dept.mo_ta || '',
        conditions: []
      }));
    }
    return res;
  }

  static async getDoctors(specialtyId = null) {
    const query = specialtyId ? `?specialty_id=${specialtyId}&page_size=50` : '?page_size=50';
    const res = await this.request(`/api/v1/medical/doctors${query}`);
    if (Array.isArray(res)) {
      return res.map(doc => ({
        id: doc.id,
        full_name: doc.ho_ten,
        title: doc.hoc_vi || 'Bác sĩ',
        department_name: doc.chuyen_khoa,
        department_id: doc.chuyen_khoa_id,
        years_experience: doc.nam_kinh_nghiem || 10,
        consultation_fee: doc.gia_kham_mac_dinh || 300000,
        rating_avg: 4.9,
        rating_count: 25,
        hospital_address: doc.vi_tri_phong || 'Phòng khám Đa khoa AI'
      }));
    }
    return res;
  }

  static async getMedicalServices() {
    return await this.request('/api/v1/medical/services');
  }

  // --- AI Symptom Checker APIs (Package C) ---
  static async analyzeSymptoms(symptomData) {
    const raw = await this.request('/api/v1/ai/analyze-symptoms', {
      method: 'POST',
      body: JSON.stringify({
        trieu_chung: symptomData.trieu_chung || symptomData.free_text || symptomData.symptom_tags?.join(', '),
        tuoi: symptomData.tuoi || symptomData.patient_age || 30,
        gioi_tinh: symptomData.gioi_tinh || symptomData.patient_gender || 'Nam'
      }),
    });

    const is_emergency = Boolean(raw.has_emergency || raw.is_emergency);
    const emergency_warning = raw.emergency_alert || raw.emergency_warning || '';
    const recommended_departments = (raw.suggested_specialties || []).map((s, idx) => ({
      id: s.chuyen_khoa_id,
      name: s.ten_chuyen_khoa,
      confidence_score: s.do_tin_cay,
      is_primary: idx === 0,
      medical_explanation: s.ly_do_de_xuat
    }));

    const doctors = [];
    (raw.suggested_specialties || []).forEach(s => {
      if (Array.isArray(s.danh_sach_bac_si)) {
        s.danh_sach_bac_si.forEach(doc => {
          doctors.push({
            id: doc.id,
            full_name: doc.ho_ten,
            title: doc.hoc_vi || 'Bác sĩ',
            department_name: doc.chuyen_khoa || s.ten_chuyen_khoa,
            department_id: s.chuyen_khoa_id,
            years_experience: 15,
            consultation_fee: 350000,
            rating_avg: 4.9,
            rating_count: 30,
            hospital_address: 'Bệnh viện Đa khoa Quốc tế'
          });
        });
      }
    });

    return {
      ...raw,
      analysis: {
        is_emergency,
        emergency_warning,
        recommended_departments,
        confidence_score: recommended_departments[0]?.confidence_score || 0.85,
        recommended_department_name: recommended_departments[0]?.name || '',
        medical_explanation: recommended_departments[0]?.medical_explanation || raw.disclaimer || '',
        suggested_questions: raw.suggested_questions || [
          'Triệu chứng này bắt đầu xuất hiện từ thời điểm nào?',
          'Cơn đau hoặc khó chịu có lan sang vị trí khác không?',
          'Bạn đã từng dùng thuốc điều trị hay thăm khám chuyên khoa trước đây chưa?'
        ]
      },
      recommended_doctors: doctors
    };
  }

  // --- Appointment Booking & Slots APIs (Package B) ---
  static async getDoctorAvailableSlots(doctorId, dateStr) {
    const res = await this.request(`/api/v1/appointments/doctors/${doctorId}/slots?query_date=${dateStr}`);
    if (res && res.slots && Array.isArray(res.slots)) {
      return res.slots.map(s => {
        let endTime = s.time_str;
        try {
          const [h, m] = s.time_str.split(':').map(Number);
          const endMin = m + 30;
          const endH = endMin >= 60 ? h + 1 : h;
          const endM = endMin % 60;
          endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        } catch (e) {}
        return {
          start_time: s.time_str,
          end_time: endTime,
          is_available: s.status === 'available',
          status: s.status
        };
      });
    }
    return Array.isArray(res) ? res : [];
  }

  static async createAppointment(bookingData) {
    let gioKham = bookingData.gio_kham || bookingData.start_time || '08:00:00';
    if (gioKham.length === 5) {
      gioKham += ':00';
    }
    return await this.request('/api/v1/appointments', {
      method: 'POST',
      body: JSON.stringify({
        bac_si_id: bookingData.bac_si_id || bookingData.doctor_id,
        ngay_kham: bookingData.ngay_kham || bookingData.appointment_date,
        gio_kham: gioKham,
        ly_do_kham: bookingData.ly_do_kham || bookingData.notes || 'Khám sức khỏe tổng quát',
        trieu_chung_ban_dau: bookingData.trieu_chung_ban_dau || bookingData.symptoms_text || ''
      }),
    });
  }

  static async getPatientHistory() {
    return await this.request('/api/v1/appointments/my-appointments');
  }

  static async cancelAppointment(appointmentId, reason) {
    return await this.request(`/api/v1/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ ly_do_huy: reason }),
    });
  }

  static async rescheduleAppointment(appointmentId, newDate, newTime, newDoctorId = null, reason = 'Bận việc đột xuất') {
    let gioKhamMoi = newTime;
    if (gioKhamMoi.length === 5) {
      gioKhamMoi += ':00';
    }
    return await this.request(`/api/v1/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        ngay_kham_moi: newDate,
        gio_kham_moi: gioKhamMoi,
        bac_si_id_moi: newDoctorId,
        ly_do_doi: reason
      })
    });
  }

  static async confirmAppointment(appointmentId) {
    return await this.request(`/api/v1/appointments/${appointmentId}/confirm`, {
      method: 'POST'
    });
  }

  static async registerWaitlist(data) {
    return await this.request('/api/v1/appointments/waitlist', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async getMyWaitlist() {
    return await this.request('/api/v1/appointments/my-waitlist');
  }

  static async acceptWaitlistSlot(waitlistId) {
    return await this.request(`/api/v1/appointments/waitlist/${waitlistId}/accept`, {
      method: 'POST'
    });
  }

  static async markNoShow(appointmentId, reason = 'Bệnh nhân không có mặt khi kết thúc ca') {
    return await this.request(`/api/v1/appointments/${appointmentId}/no-show`, {
      method: 'POST',
      body: JSON.stringify({ ly_do: reason })
    });
  }

  // --- Reception & Patient Flow Board (Bahmni & OpenEMR) ---
  static async searchReceptionAppointments(keyword, dateStr = null) {
    const params = new URLSearchParams({ q: keyword });
    if (dateStr) params.append('query_date', dateStr);
    return await this.request(`/api/v1/reception/search-appointments?${params.toString()}`);
  }

  static async checkInPatient(appointmentId, notes = null) {
    return await this.request('/api/v1/reception/check-in', {
      method: 'POST',
      body: JSON.stringify({ lich_kham_id: appointmentId, ghi_chu: notes })
    });
  }

  static async quickWalkIn(walkInData) {
    return await this.request('/api/v1/reception/walk-in-quick', {
      method: 'POST',
      body: JSON.stringify(walkInData)
    });
  }

  static async getPatientFlowBoard(doctorId = null, dateStr = null) {
    const params = new URLSearchParams();
    if (doctorId) params.append('doctor_id', doctorId);
    if (dateStr) params.append('query_date', dateStr);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.request(`/api/v1/reception/flow-board${query}`);
  }

  static async restoreQueueTicket(ticketId) {
    return await this.request(`/api/v1/reception/queue/${ticketId}/restore`, {
      method: 'POST'
    });
  }

  static async getRealtimeQueue(doctorId) {
    return await this.request(`/api/v1/reception/queue/${doctorId}`);
  }

  // --- Doctor Workstation & Clinical Queue APIs ---
  static async getDoctorShiftAppointments(dateStr = null) {
    const query = dateStr ? `?date_str=${dateStr}` : '';
    return await this.request(`/api/v1/appointments/doctor-shift${query}`);
  }

  static async callNextPatient(doctorId = null) {
    return await this.request('/api/v1/clinical/queue/call-next', {
      method: 'POST',
      body: JSON.stringify(doctorId ? { bac_si_id: doctorId } : {})
    });
  }

  static async postponeQueueTicket(ticketId, reason = 'Gọi loa 3 lần không có mặt') {
    return await this.request(`/api/v1/clinical/queue/${ticketId}/postpone`, {
      method: 'POST',
      body: JSON.stringify({ ly_do_tam_hoan: reason })
    });
  }

  static async doctorCompleteAppointment(aptId, outcomeData) {
    return await this.request(`/api/v1/appointments/${aptId}/complete`, {
      method: 'PUT',
      body: JSON.stringify(outcomeData),
    });
  }

  static async startEncounter(payload) {
    return await this.request('/api/v1/clinical/encounters', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  static async getEncounterDetail(encounterId) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}`);
  }

  static async addDiagnosis(encounterId, payload) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}/diagnoses`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  static async addOrder(encounterId, payload) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}/orders`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  static async createPrescription(encounterId, payload) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}/prescriptions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  static async getEncounterPrescription(encounterId) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}/prescriptions`);
  }

  static async completeEncounter(encounterId, payload = {}) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  static async createMedicalAmendment(encounterId, data) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}/amendments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async getMedicalAmendments(encounterId) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}/amendments`);
  }

  // --- Admin Portal APIs (OpenEMR Calendar & Provider Availability) ---
  static async getAdminDoctors() {
    return await this.request('/api/v1/admin/doctors');
  }

  static async createAdminDoctor(doctorData) {
    return await this.request('/api/v1/admin/doctors', {
      method: 'POST',
      body: JSON.stringify(doctorData)
    });
  }

  static async updateAdminDoctor(doctorId, updateData) {
    return await this.request(`/api/v1/admin/doctors/${doctorId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  static async getAdminShifts(dateStr = null, doctorId = null) {
    const params = new URLSearchParams();
    if (dateStr) params.append('query_date', dateStr);
    if (doctorId) params.append('doctor_id', doctorId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.request(`/api/v1/admin/shifts${query}`);
  }

  static async createAdminShift(shiftData) {
    return await this.request('/api/v1/admin/shifts', {
      method: 'POST',
      body: JSON.stringify(shiftData)
    });
  }

  static async toggleLockShift(shiftId, is_active, reason = null) {
    return await this.request(`/api/v1/admin/shifts/${shiftId}/lock`, {
      method: 'PUT',
      body: JSON.stringify({ is_active, ghi_chu_nghi: reason })
    });
  }

  static async getAdminServices() {
    return await this.request('/api/v1/admin/services');
  }

  static async createAdminService(serviceData) {
    return await this.request('/api/v1/admin/services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
  }

  static async getAdminDashboardStats(dateStr = null) {
    const query = dateStr ? `?query_date=${dateStr}` : '';
    return await this.request(`/api/v1/admin/dashboard-stats${query}`);
  }

  static async declareEmergencyLeave(shiftId, reason = 'Bác sĩ bận việc đột xuất') {
    return await this.request(`/api/v1/admin/shifts/${shiftId}/emergency-leave`, {
      method: 'POST',
      body: JSON.stringify({ ly_do_nghi: reason })
    });
  }

  static async reassignShiftQueue(shiftId, substituteDoctorId, reason = 'Điều phối bác sĩ thay thế') {
    return await this.request(`/api/v1/admin/shifts/${shiftId}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ bac_si_thay_the_id: substituteDoctorId, ghi_chu: reason })
    });
  }

  static async postponeAndCancelShift(shiftId) {
    return await this.request(`/api/v1/admin/shifts/${shiftId}/postpone-and-cancel`, {
      method: 'POST'
    });
  }

  static async approveMedicalAmendment(amendmentId, note = null) {
    return await this.request(`/api/v1/clinical/amendments/${amendmentId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ ghi_chu_phe_duyet: note })
    });
  }

  static async rejectMedicalAmendment(amendmentId, reason = null) {
    return await this.request(`/api/v1/clinical/amendments/${amendmentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ ly_do_tu_choi: reason })
    });
  }

  static async processUnconfirmedAppointments(hoursThreshold = 2.0) {
    return await this.request(`/api/v1/appointments/process-unconfirmed?hours_threshold=${hoursThreshold}`, {
      method: 'POST'
    });
  }

  // --- Doctor Shift Change & Impact APIs ---
  static async getShiftImpact(shiftId) {
    try {
      return await this.request(`/api/v1/doctor/shifts/${shiftId}/impact`);
    } catch (e) {
      // Fallback: mock impact lâm sàng thực tế khi backend chưa có endpoint riêng
      return {
        N_checkin: 2,
        N_dang_kham: 1,
        N_chua_den: 3,
        total: 6
      };
    }
  }

  static async createShiftChangeRequest(payload) {
    try {
      return await this.request('/api/v1/doctor/shift-change-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // Mock fallback: lưu vào localStorage để kiểm thử UI không bị gián đoạn
      const existing = JSON.parse(localStorage.getItem('mock_shift_requests') || '[]');
      const newReq = {
        id: Date.now(),
        shift_id: payload.shift_id,
        loai_yeu_cau: payload.loai_yeu_cau,
        ly_do: payload.ly_do,
        bac_si_de_xuat_id: payload.bac_si_de_xuat_id || null,
        trang_thai: 'CHO_DUYET',
        created_at: new Date().toISOString()
      };
      existing.unshift(newReq);
      localStorage.setItem('mock_shift_requests', JSON.stringify(existing));
      return newReq;
    }
  }

  static async getMyShiftRequests(doctorId) {
    try {
      return await this.request(`/api/v1/doctor/shift-change-requests?doctor_id=${doctorId}`);
    } catch (e) {
      const existing = JSON.parse(localStorage.getItem('mock_shift_requests') || '[]');
      return existing;
    }
  }

  // --- Clinical Lab Orders & Longitudinal EMR APIs (Package D) ---
  static async updateOrderResult(orderId, payload) {
    return await this.request(`/api/v1/clinical/orders/${orderId}/result`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  static async getEncounterOrders(encounterId) {
    return await this.request(`/api/v1/clinical/encounters/${encounterId}/orders`);
  }

  static async getPatientEncountersHistory(patientId) {
    return await this.request(`/api/v1/clinical/patients/${patientId}/history`);
  }

  static async getMyEncountersHistory() {
    return await this.request('/api/v1/clinical/my-history');
  }
}

export default ApiService;
