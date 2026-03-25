import { useState, useEffect } from 'react'
import { classesApi, studentsApi, teachersApi, downloadBlob } from '../api'
import CurrencyInput from '../components/CurrencyInput'
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
  currentSessions: number
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

const emptyForm = { khoi: '', nhom: 'A', so: '1', subject: '', teacherId: '' as string | number, notes: '', totalSessions: '' as string | number, tuitionFee: '' as string | number, teacherSharePercent: '75' as string | number }

export default function ClassesPage() {
  const { canManage } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [showImport, setShowImport] = useState(false)
  const [showExportAttendance, setShowExportAttendance] = useState(false)
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1)
  const [exportYear, setExportYear] = useState(new Date().getFullYear())
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

  // Load all students once on mount
  useEffect(() => { studentsApi.getAll().then(r => setAllStudents(r.data)) }, [])

  const selectClass = async (cls: Class) => {
    setSelected(cls)
    setEnrollError('')
    setAddSearch('')
    const enrolledRes = await classesApi.getStudents(cls.id)
    setEnrolled(enrolledRes.data)
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
    setForm({ ...parsed, subject: cls.subject, teacherId: cls.teacherId ?? '', notes: cls.notes, totalSessions: cls.totalSessions ?? '', tuitionFee: cls.tuitionFee ?? '', teacherSharePercent: cls.teacherSharePercent ?? 75 })
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
        teacherSharePercent: Number(form.teacherSharePercent) || 75,
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
      // Update student count locally
      setClasses(prev => prev.map(c => c.id === selected.id ? { ...c, studentCount: res.data.length } : c))
    } catch (err: any) {
      setEnrollError(err.response?.data?.message ?? 'Lỗi thêm học sinh.')
    }
  }

  const handleUnenroll = async (studentId: number) => {
    if (!selected) return
    await classesApi.unenroll(selected.id, studentId)
    setEnrolled(prev => {
      const next = prev.filter(s => s.studentId !== studentId)
      setClasses(cs => cs.map(c => c.id === selected.id ? { ...c, studentCount: next.length } : c))
      return next
    })
  }

  const enrolledIds = new Set(enrolled.map(s => s.studentId))
  const notEnrolled = allStudents.filter(s => !enrolledIds.has(s.id))

  // Sort + search
  const sortedEnrolled = [...enrolled].sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
  const [addSearch, setAddSearch] = useState('')
  const filteredNotEnrolled = notEnrolled
    .filter(s => !addSearch || s.fullName.toLowerCase().includes(addSearch.toLowerCase()))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))

  // Nhóm lớp theo khối
  const groups: Record<string, typeof classes> = {}
  classes.forEach(cls => {
    const m = cls.name.match(/^(\d+)/)
    const num = m ? parseInt(m[1]) : 0
    const label = num >= 1 && num <= 5 ? 'TH' : num >= 6 ? `K${num}` : '?'
    if (!groups[label]) groups[label] = []
    groups[label].push(cls)
  })
  const gradeKeys = Object.keys(groups).sort((a, b) => {
    const order = (k: string) => k === 'TH' ? 0 : k === '?' ? 99 : parseInt(k.replace('K', ''))
    return order(a) - order(b)
  })
  const [activeGrade, setActiveGrade] = useState(() => gradeKeys[0] ?? '')
  const gradeClasses = groups[activeGrade] ?? []

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header — same style as other tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Lớp học</h2>
          <p className="text-sm text-gray-400">{classes.length} lớp · {classes.reduce((s, c) => s + c.studentCount, 0)} học sinh</p>
        </div>
        {canManage && (
          <button onClick={openAdd} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
            + Thêm lớp
          </button>
        )}
      </div>

      {/* Grade tabs — pill style */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {gradeKeys.map(key => (
          <button
            key={key}
            onClick={() => setActiveGrade(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap border ${
              activeGrade === key
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
            }`}
          >
            {key === 'TH' ? 'Tiểu học' : key === '?' ? 'Khác' : `Khối ${key.replace('K','')}`}
            <span className={`ml-1 text-xs ${activeGrade === key ? 'text-red-200' : 'text-gray-400'}`}>
              ({groups[key].length})
            </span>
          </button>
        ))}
      </div>

      {/* Class cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {gradeClasses.map(cls => {
          const isSelected = selected?.id === cls.id
          const progress = cls.totalSessions ? Math.round((cls.currentSessions / cls.totalSessions) * 100) : 0

          return (
            <div
              key={cls.id}
              onClick={() => selectClass(cls)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md group ${
                isSelected ? 'border-red-400 ring-2 ring-red-50 shadow-sm' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              {/* Name + subject + actions */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{cls.name}</h3>
                  <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">{cls.subject}</span>
                </div>
                {canManage && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={e => { e.stopPropagation(); openEdit(cls) }} className="text-gray-400 hover:text-red-600 text-xs font-medium">Sửa</button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(cls) }} className="text-gray-400 hover:text-red-600 text-xs">Xóa</button>
                  </div>
                )}
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center justify-between">
                  <span>{cls.studentCount} học sinh</span>
                  {cls.tuitionFee != null && cls.tuitionFee > 0 && (
                    <span className="font-semibold text-red-600">{cls.tuitionFee.toLocaleString('vi-VN')}₫</span>
                  )}
                </div>
                <div className={cls.teacherName ? 'text-gray-700' : 'text-gray-300 italic'}>
                  GV: {cls.teacherName ?? 'Chưa phân công'}
                </div>
              </div>

              {/* Progress bar */}
              {cls.totalSessions != null && cls.totalSessions > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-gray-400">Tiến độ</span>
                    <span className={`font-semibold ${progress >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                      {cls.currentSessions}/{cls.totalSessions} buổi
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-red-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {gradeClasses.length === 0 && (
          <p className="text-sm text-gray-400 col-span-full text-center py-8">Không có lớp nào trong khối này</p>
        )}
      </div>

      {/* Panel học sinh trong lớp */}
      {selected && (
        <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {selected.name} <span className="text-red-600">· {selected.subject}</span>
              </h3>
              <div className="flex gap-4 mt-1 text-sm text-gray-500">
                <span>{enrolled.length} học sinh</span>
                {selected.totalSessions != null && <span>· {selected.totalSessions} buổi</span>}
                {selected.tuitionFee != null && <span>· Học phí: {selected.tuitionFee.toLocaleString('vi-VN')}₫</span>}
                {selected.currentSessions > 0 && <span>· Đã học: {selected.currentSessions}{selected.totalSessions ? `/${selected.totalSessions}` : ''} buổi</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Học sinh trong lớp */}
              <div className="bg-white rounded-xl border border-gray-100">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Đang học</p>
                  <div className="flex gap-2">
                    <button onClick={async () => { const r = await classesApi.exportStudents(selected.id); downloadBlob(r, `lop-${selected.name}.xlsx`) }} className="text-xs text-gray-400 hover:text-gray-600 transition">Export Danh sách</button>
                    <button onClick={() => setShowExportAttendance(true)} className="text-xs text-gray-400 hover:text-gray-600 transition">Export Điểm danh</button>
                    <button onClick={() => setShowImport(true)} className="text-xs text-red-600 hover:text-red-700 transition">Import</button>
                  </div>
                </div>
                <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                  {sortedEnrolled.map(s => (
                    <div key={s.studentId} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                        <p className="text-xs text-gray-400">{s.address}</p>
                      </div>
                      <button
                        onClick={() => handleUnenroll(s.studentId)}
                        className="text-red-400 hover:text-red-600 text-xs transition"
                      >Xóa</button>
                    </div>
                  ))}
                  {enrolled.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">Chưa có học sinh</p>
                  )}
                </div>
              </div>

              {/* Thêm học sinh vào lớp — admin + GV lớp mình */}
              <div className="bg-white rounded-xl border border-gray-100">
                <div className="px-4 py-3 border-b border-gray-50 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Thêm vào lớp</p>
                  <input
                    type="text"
                    placeholder="Tìm học sinh..."
                    value={addSearch}
                    onChange={e => setAddSearch(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white placeholder-gray-400 transition"
                  />
                </div>
                {enrollError && (
                  <p className="text-red-500 text-xs px-4 pt-2">{enrollError}</p>
                )}
                <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                  {filteredNotEnrolled.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                        <p className="text-xs text-gray-400">{s.parentPhone}</p>
                      </div>
                      <button
                        onClick={() => handleEnroll(s.id)}
                        className="text-red-600 hover:text-red-700 text-xs font-medium transition"
                      >+ Thêm</button>
                    </div>
                  ))}
                  {filteredNotEnrolled.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      {allStudents.length === 0 ? 'Chưa có học sinh nào' : 'Tất cả đã vào lớp'}
                    </p>
                  )}
                </div>
              </div>
            </div>
        </div>
      )}

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
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Khối</option>
                    {KHOI.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <select
                    value={form.nhom}
                    onChange={e => setForm(f => ({ ...f, nhom: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {NHOM.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select
                    value={form.so}
                    onChange={e => setForm(f => ({ ...f, so: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400"
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Học phí (VNĐ)</label>
                  <CurrencyInput
                    value={form.tuitionFee}
                    onChange={v => setForm(f => ({ ...f, tuitionFee: v }))}
                    placeholder="500.000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">% chia GV</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.teacherSharePercent}
                    onChange={e => setForm(f => ({ ...f, teacherSharePercent: e.target.value }))}
                    placeholder="75"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ghi chú</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={2}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
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

      {/* Export điểm danh theo tháng */}
      {showExportAttendance && selected && (
        <div className="fixed inset-0 backdrop-blur-sm bg-gradient-to-br from-red-50 via-amber-50 to-white bg-opacity-80 flex items-center justify-center z-50" onClick={() => setShowExportAttendance(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-xs animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-4">Export điểm danh</h3>
            <p className="text-sm text-gray-500 mb-3">{selected.name} - {selected.subject}</p>
            <div className="flex gap-2 mb-4">
              <select value={exportMonth} onChange={e => setExportMonth(Number(e.target.value))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
              </select>
              <select value={exportYear} onChange={e => setExportYear(Number(e.target.value))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => {
                const now = new Date()
                const isCurrentMonth = exportMonth === now.getMonth() + 1 && exportYear === now.getFullYear()
                if (isCurrentMonth && now.getDate() < 28) {
                  if (!window.confirm(`Tháng ${exportMonth}/${exportYear} chưa kết thúc. Vẫn export?`)) return
                }
                const r = await classesApi.exportAttendance(selected.id, exportMonth, exportYear)
                downloadBlob(r, `diem-danh-${selected.name}-T${exportMonth}-${exportYear}.xlsx`)
                setShowExportAttendance(false)
              }} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition">Export</button>
              <button onClick={async () => {
                const r = await classesApi.exportAttendance(selected.id)
                downloadBlob(r, `diem-danh-${selected.name}-tat-ca.xlsx`)
                setShowExportAttendance(false)
              }} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">Tất cả</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
