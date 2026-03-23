import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' })

// Tự động gắn JWT token vào mọi request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Nếu token hết hạn → tự logout
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (fullName: string, email: string, password: string, role = 'teacher') =>
    api.post('/auth/register', { fullName, email, password, role }),
}

// ── Teachers ──────────────────────────────────────────────────────
export const teachersApi = {
  getAll: () => api.get('/teachers'),
  getSubjects: () => api.get('/teachers/subjects'),
  getAvailableUsers: () => api.get('/teachers/available-users'),
  create: (data: object) => api.post('/teachers', data),
  update: (id: number, data: object) => api.put(`/teachers/${id}`, data),
  delete: (id: number) => api.delete(`/teachers/${id}`),
}

// ── Classes ───────────────────────────────────────────────────────
export const classesApi = {
  getAll: () => api.get('/classes'),
  getById: (id: number) => api.get(`/classes/${id}`),
  create: (data: object) => api.post('/classes', data),
  update: (id: number, data: object) => api.put(`/classes/${id}`, data),
  delete: (id: number) => api.delete(`/classes/${id}`),
  getStudents: (id: number) => api.get(`/classes/${id}/students`),
  enroll: (id: number, studentId: number) => api.post(`/classes/${id}/students`, { studentId }),
  unenroll: (id: number, studentId: number) => api.delete(`/classes/${id}/students/${studentId}`),
}

// ── Students ──────────────────────────────────────────────────────
export const studentsApi = {
  getAll: (search?: string) =>
    api.get('/students', { params: search ? { search } : {} }),
  getById: (id: number) =>
    api.get(`/students/${id}`),
  create: (data: object) =>
    api.post('/students', data),
  update: (id: number, data: object) =>
    api.put(`/students/${id}`, data),
  delete: (id: number) =>
    api.delete(`/students/${id}`),
}

// ── Attendance ────────────────────────────────────────────────────
export const attendanceApi = {
  getSessions: () =>
    api.get('/attendance/sessions'),
  createSession: (data: object) =>
    api.post('/attendance/sessions', data),
  deleteSession: (id: number) =>
    api.delete(`/attendance/sessions/${id}`),
  getForSession: (sessionId: number) =>
    api.get(`/attendance/sessions/${sessionId}`),
  save: (sessionId: number, records: object[]) =>
    api.post('/attendance', { sessionId, records }),
}

// ── Users (Account Management) ────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/users'),
  getAvailableTeachers: (forUserId?: number) =>
    api.get('/users/available-teachers', { params: forUserId ? { forUserId } : {} }),
  create: (data: object) => api.post('/users', data),
  update: (id: number, data: object) => api.put(`/users/${id}`, data),
  resetPassword: (id: number, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
  toggleActive: (id: number) => api.patch(`/users/${id}/toggle`),
  delete: (id: number) => api.delete(`/users/${id}`),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/users/me/password', { currentPassword, newPassword }),
}

// ── Import ────────────────────────────────────────────────────────
export const importApi = {
  downloadTemplate: () =>
    api.get('/students/import-template', { responseType: 'blob' }),
  importStudents: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/students/import', form)
  },
  importToClass: (classId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/classes/${classId}/students/import`, form)
  },
}

// ── Payments ──────────────────────────────────────────────────────
export const paymentsApi = {
  getMonthly: (month: number, year: number) =>
    api.get('/payments', { params: { month, year } }),
  record: (data: object) =>
    api.post('/payments', data),
  delete: (id: number) =>
    api.delete(`/payments/${id}`),
}

// ── Expenses ─────────────────────────────────────────────────────
export const expensesApi = {
  getAll: (month?: number, year?: number) =>
    api.get('/expenses', { params: { month, year } }),
  create: (data: object) => api.post('/expenses', data),
  update: (id: number, data: object) => api.put(`/expenses/${id}`, data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
}

// ── Reports ──────────────────────────────────────────────────────
export const reportsApi = {
  summary: (period: string, year: number, month?: number, quarter?: number) =>
    api.get('/reports/summary', { params: { period, year, month, quarter } }),
  chart: (year: number) =>
    api.get('/reports/chart', { params: { year } }),
  export: (period: string, year: number, month?: number, quarter?: number) =>
    api.get('/reports/export', { params: { period, year, month, quarter }, responseType: 'blob' }),
}

export default api
