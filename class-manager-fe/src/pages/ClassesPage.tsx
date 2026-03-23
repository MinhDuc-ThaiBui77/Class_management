import { useState, useEffect } from 'react'
import { classesApi, studentsApi, teachersApi } from '../api'
import { useAuth } from '../hooks/useAuth'
import ImportModal from '../components/ImportModal'

interface Class {
  id: number
  name: string
  subject: string
  notes: string
  studentCount: number
  teacherId: number | null
  teacherName: string | null
  totalSessions: number | null
  tuitionFee: number | null
}

interface Teacher {
  id: number
  fullName: string
  subject: string
}

interface ClassStudent {
  studentId: number
  fullName: string
  address: string
}

interface Student {
  id: number
  fullName: string
  parentPhone: string
}

const SUBJECTS = [
  'Toán', 'Văn', 'Tiếng Anh', 'Lý', 'Hoá',
  'Luyện viết TH 1', 'Luyện viết TH 2', 'Luyện viết TH 3', 'Luyện viết TH 4', 'Luyện viết TH 5',
]
const KHOI = Array.from({ length: 12 }, (_, i) => String(i + 1))
const NHOM = ['A', 'B', 'C', 'D', 'E', 'F']
const SO   = ['1', '2', '3', '4', '5']

function parseName(name: string) {
  const m = name.match(/^(\d+)([A-F])(\d*)$/)
  if (m) return { khoi: m[1], nhom: m[2], so: m[3] || '1' }
  return { khoi: '', nhom: 'A', so: '1' }
}

const emptyForm = { khoi: '', nhom: 'A', so: '1', subject: '', teacherId: '' as string | number, notes: '', totalSessions: '' as string | number, tuitionFee: '' as string | number }

export default function ClassesPage() {
  const { isAdmin } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [showImport, setShowImport] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Class | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Panel quản lý học sinh trong lớp
  const [selected, setSelected] = useState<Class | null>(null)
  const [enrolled, setEnrolled] = useState<ClassStudent[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [enrollError, setEnrollError] = useState('')

  useEffect(() => {
    loadClasses()
    teachersApi.getAll().then(r => setTeachers(r.data))
  }, [])

  const loadClasses = async () => {
    const res = await classesApi.getAll()
    setClasses(res.data)
  }

  const selectClass = async (cls: Class) => {
    setSelected(cls)
    setEnrollError('')
    const [enrolledRes, allRes] = await Promise.all([
      classesApi.getStudents(cls.id),
      studentsApi.getAll(),
    ])
    setEnrolled(enrolledRes.data)
    setAllStudents(allRes.data)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const openEdit = (cls: Class) => {
    setEditing(cls)
    const parsed = parseName(cls.name)
    setForm({ ...parsed, subject: cls.subject, teacherId: cls.teacherId ?? '', notes: cls.notes, totalSessions: cls.totalSessions ?? '', tuitionFee: cls.tuitionFee ?? '' })
    setError('')
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const name = `${form.khoi}${form.nhom}${form.so}`
      const payload = {
        name,
        subject: form.subject,
        teacherId: form.teacherId === '' ? null : Number(form.teacherId),
        notes: form.notes,
        totalSessions: form.totalSessions === '' ? null : Number(form.totalSessions),
        tuitionFee: form.tuitionFee === '' ? null : Number(form.tuitionFee),
      }
      if (editing) {
        await classesApi.update(editing.id, payload)
      } else {
        await classesApi.create(payload)
      }
      setShowForm(false)
      loadClasses()
      if (selected && editing?.id === selected.id) {
        setSelected(prev => prev ? { ...prev, name, subject: form.subject, teacherId: payload.teacherId, totalSessions: payload.totalSessions ?? null, tuitionFee: payload.tuitionFee ?? null } : null)
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (cls: Class) => {
    if (!confirm(`Xóa lớp "${cls.name} - ${cls.subject}"?`)) return
    await classesApi.delete(cls.id)
    if (selected?.id === cls.id) setSelected(null)
    loadClasses()
  }

  const handleEnroll = async (studentId: number) => {
    if (!selected) return
    setEnrollError('')
    try {
      await classesApi.enroll(selected.id, studentId)
      const res = await classesApi.getStudents(selected.id)
      setEnrolled(res.data)
      loadClasses()
    } catch (err: any) {
      setEnrollError(err.response?.data?.message ?? 'Lỗi thêm học sinh.')
    }
  }

  const handleUnenroll = async (studentId: number) => {
    if (!selected) return
    await classesApi.unenroll(selected.id, studentId)
    setEnrolled(prev => prev.filter(s => s.studentId !== studentId))
    loadClasses()
  }

  const enrolledIds = new Set(enrolled.map(s => s.studentId))
  const notEnrolled = allStudents.filter(s => !enrolledIds.has(s.id))

  return (
    <div className="flex gap-6">
      {/* Danh sách lớp */}
      <div className="w-72 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Lớp học</h2>
            <p className="text-sm text-gray-400">{classes.length} lớp</p>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
            >
              + Thêm lớp
            </button>
          )}
        </div>

        <div className="space-y-2">
          {classes.map(cls => (
            <div
              key={cls.id}
              onClick={() => selectClass(cls)}
              className={`rounded-xl px-4 py-3 cursor-pointer border transition group ${
                selected?.id === cls.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800 text-sm">
                    {cls.name} <span className="text-blue-600">· {cls.subject}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{cls.studentCount} học sinh · {cls.teacherName ?? 'Chưa có GV'}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(cls) }}
                      className="text-blue-500 hover:text-blue-700 text-xs px-1"
                    >Sửa</button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(cls) }}
                      className="text-red-400 hover:text-red-600 text-xs px-1"
                    >Xóa</button>
                  </div>
                )}
              </div>
              {cls.notes && <p className="text-xs text-gray-400 mt-1 truncate">{cls.notes}</p>}
            </div>
          ))}
          {classes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Chưa có lớp học nào</p>
          )}
        </div>
      </div>

      {/* Panel học sinh trong lớp */}
      <div className="flex-1">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            ← Chọn lớp để quản lý học sinh
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {selected.name} <span className="text-blue-600">· {selected.subject}</span>
              </h3>
              <div className="flex gap-4 mt-1 text-sm text-gray-500">
                <span>{enrolled.length} học sinh</span>
                {selected.totalSessions != null && <span>· {selected.totalSessions} buổi</span>}
                {selected.tuitionFee != null && <span>· Học phí: {selected.tuitionFee.toLocaleString('vi-VN')}đ</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Học sinh trong lớp */}
              <div className="bg-white rounded-xl border border-gray-100">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Đang học</p>
                  {isAdmin && (
                    <button
                      onClick={() => setShowImport(true)}
                      className="text-xs text-blue-500 hover:text-blue-700 transition"
                    >
                      Import Excel
                    </button>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {enrolled.map(s => (
                    <div key={s.studentId} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                        <p className="text-xs text-gray-400">{s.address}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleUnenroll(s.studentId)}
                          className="text-red-400 hover:text-red-600 text-xs transition"
                        >Xóa</button>
                      )}
                    </div>
                  ))}
                  {enrolled.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">Chưa có học sinh</p>
                  )}
                </div>
              </div>

              {/* Thêm học sinh vào lớp — chỉ admin */}
              {isAdmin && <div className="bg-white rounded-xl border border-gray-100">
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-sm font-medium text-gray-700">Thêm vào lớp</p>
                </div>
                {enrollError && (
                  <p className="text-red-500 text-xs px-4 pt-2">{enrollError}</p>
                )}
                <div className="divide-y divide-gray-50">
                  {notEnrolled.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                        <p className="text-xs text-gray-400">{s.parentPhone}</p>
                      </div>
                      <button
                        onClick={() => handleEnroll(s.id)}
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium transition"
                      >+ Thêm</button>
                    </div>
                  ))}
                  {notEnrolled.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      {allStudents.length === 0 ? 'Chưa có học sinh nào' : 'Tất cả đã vào lớp'}
                    </p>
                  )}
                </div>
              </div>}
            </div>
          </>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-4">
              {editing ? 'Chỉnh sửa lớp' : 'Thêm lớp mới'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tên lớp *</label>
                <div className="flex gap-2">
                  <select
                    required
                    value={form.khoi}
                    onChange={e => setForm(f => ({ ...f, khoi: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Khối</option>
                    {KHOI.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <select
                    value={form.nhom}
                    onChange={e => setForm(f => ({ ...f, nhom: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {NHOM.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select
                    value={form.so}
                    onChange={e => setForm(f => ({ ...f, so: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SO.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {form.khoi && (
                  <p className="text-xs text-blue-600 mt-1">Tên lớp: <strong>{form.khoi}{form.nhom}{form.so}</strong></p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Môn học *</label>
                <select
                  required
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value, teacherId: '' }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn môn học --</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Giáo viên đứng lớp</label>
                {(() => {
                  const filtered = form.subject
                    ? teachers.filter(t => t.subject === form.subject)
                    : teachers
                  return (
                    <>
                      <select
                        value={form.teacherId}
                        onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}
                        disabled={!form.subject}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">-- Chưa phân công --</option>
                        {filtered.map(t => (
                          <option key={t.id} value={t.id}>{t.fullName} ({t.subject})</option>
                        ))}
                      </select>
                      {form.subject && filtered.length === 0 && (
                        <p className="text-xs text-orange-500 mt-1">Chưa có giáo viên dạy môn {form.subject}</p>
                      )}
                    </>
                  )
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Số buổi học</label>
                  <input
                    type="number"
                    min="1"
                    value={form.totalSessions}
                    onChange={e => setForm(f => ({ ...f, totalSessions: e.target.value }))}
                    placeholder="VD: 24"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Học phí (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.tuitionFee}
                    onChange={e => setForm(f => ({ ...f, tuitionFee: e.target.value }))}
                    placeholder="VD: 500000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ghi chú</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
                >
                  {loading ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showImport && selected && (
        <ImportModal
          mode="class"
          classId={selected.id}
          onClose={() => setShowImport(false)}
          onDone={() => selectClass(selected)}
        />
      )}
    </div>
  )
}
