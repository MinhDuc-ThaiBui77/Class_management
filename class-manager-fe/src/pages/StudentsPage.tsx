import { useState, useEffect } from 'react'
import { studentsApi } from '../api'
import { useAuth } from '../hooks/useAuth'
import ImportModal from '../components/ImportModal'

interface StudentClass {
  className: string
  subject: string
  teacherName: string | null
}

interface Student {
  id: number
  fullName: string
  address: string
  parentPhone: string
  enrolledDate: string
  notes: string
  classCount: number
  classes: StudentClass[]
}

const emptyForm = {
  fullName: '', address: '', parentPhone: '',
  dateOfBirth: '', enrolledDate: '', notes: ''
}

type SortKey = 'fullName' | 'address' | 'classCount' | 'enrolledDate'
type SortDir = 'asc' | 'desc'

export default function StudentsPage() {
  const { isAdmin } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('fullName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [tooltip, setTooltip] = useState<number | null>(null)

  useEffect(() => { loadStudents() }, [])

  const loadStudents = async (kw = '') => {
    const res = await studentsApi.getAll(kw || undefined)
    setStudents(res.data)
    setSelected(new Set())
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    loadStudents(e.target.value)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const openEdit = (s: Student) => {
    setEditing(s)
    setForm({
      fullName: s.fullName,
      address: s.address,
      parentPhone: s.parentPhone,
      dateOfBirth: '',
      enrolledDate: s.enrolledDate?.slice(0, 10) ?? '',
      notes: s.notes,
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        enrolledDate: form.enrolledDate || new Date().toISOString(),
      }
      if (editing) {
        await studentsApi.update(editing.id, payload)
      } else {
        await studentsApi.create(payload)
      }
      setShowForm(false)
      loadStudents(search)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (s: Student) => {
    if (!confirm(`Xóa học sinh "${s.fullName}"?`)) return
    await studentsApi.delete(s.id)
    loadStudents(search)
  }

  // ── Sort ──────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedStudents = [...students].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'fullName') cmp = a.fullName.localeCompare(b.fullName, 'vi')
    else if (sortKey === 'address') cmp = a.address.localeCompare(b.address, 'vi')
    else if (sortKey === 'classCount') cmp = a.classCount - b.classCount
    else if (sortKey === 'enrolledDate') cmp = new Date(a.enrolledDate).getTime() - new Date(b.enrolledDate).getTime()
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Bulk select ───────────────────────────────────────────────────
  const allSelected = sortedStudents.length > 0 && sortedStudents.every(s => selected.has(s.id))
  const someSelected = sortedStudents.some(s => selected.has(s.id))

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(sortedStudents.map(s => s.id)))
  }

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Xóa ${selected.size} học sinh đã chọn? Hành động này không thể hoàn tác.`)) return
    setBulkDeleting(true)
    try {
      await Promise.all([...selected].map(id => studentsApi.delete(id)))
      loadStudents(search)
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Học sinh</h2>
          <p className="text-sm text-gray-400">{students.length} học sinh</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Import Excel
            </button>
            <button
              onClick={openAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              + Thêm học sinh
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Tìm theo tên, địa chỉ, SĐT phụ huynh..."
        value={search}
        onChange={handleSearch}
        className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Bulk action bar */}
      {isAdmin && someSelected && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-700 font-medium">Đang chọn {selected.size} học sinh</span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="ml-auto bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            {bulkDeleting ? 'Đang xóa...' : `Xóa ${selected.size} học sinh`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg border border-gray-200 text-xs transition"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {isAdmin && (
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left w-10">STT</th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('fullName')}>
                Họ tên <SortIcon col="fullName" />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('address')}>
                Địa chỉ <SortIcon col="address" />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('classCount')}>
                Lớp đang học <SortIcon col="classCount" />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('enrolledDate')}>
                Ngày nhập học <SortIcon col="enrolledDate" />
              </th>
              <th className="px-4 py-3 text-left">Ghi chú</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedStudents.map((s, idx) => (
              <tr key={s.id} className={`hover:bg-gray-50 transition ${selected.has(s.id) ? 'bg-blue-50' : ''}`}>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleOne(s.id)}
                      className="cursor-pointer"
                    />
                  </td>
                )}
                <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{s.fullName}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{s.address || '—'}</td>
                <td className="px-4 py-3">
                  {s.classCount === 0 ? (
                    <span className="text-gray-300 text-xs">Chưa có lớp</span>
                  ) : (
                    <div className="relative inline-block">
                      <button
                        onMouseEnter={() => setTooltip(s.id)}
                        onMouseLeave={() => setTooltip(null)}
                        className="text-blue-600 text-xs font-medium hover:underline"
                      >
                        {s.classCount} lớp
                      </button>
                      {tooltip === s.id && (
                        <div className="absolute z-20 left-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
                          {s.classes.map((c, i) => (
                            <div key={i} className="text-xs text-gray-700 py-1 border-b border-gray-50 last:border-0">
                              <span className="font-medium">{c.className}</span>
                              <span className="text-gray-400 mx-1">·</span>
                              <span>{c.subject}</span>
                              {c.teacherName && (
                                <div className="text-gray-400">{c.teacherName}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {s.enrolledDate ? new Date(s.enrolledDate).toLocaleDateString('vi-VN') : ''}
                </td>
                <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{s.notes}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  {isAdmin && <>
                    <button onClick={() => openEdit(s)} className="text-blue-500 hover:text-blue-700 text-xs">Sửa</button>
                    <button onClick={() => handleDelete(s)} className="text-red-400 hover:text-red-600 text-xs">Xóa</button>
                  </>}
                </td>
              </tr>
            ))}
            {sortedStudents.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-400">
                  Chưa có học sinh nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-800 mb-4">
              {editing ? 'Chỉnh sửa học sinh' : 'Thêm học sinh mới'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              {[
                { label: 'Họ tên *', key: 'fullName', type: 'text', required: true },
                { label: 'Địa chỉ', key: 'address', type: 'text', required: false },
                { label: 'SĐT phụ huynh', key: 'parentPhone', type: 'tel', required: false },
                { label: 'Ngày sinh', key: 'dateOfBirth', type: 'date', required: false },
                { label: 'Ngày nhập học', key: 'enrolledDate', type: 'date', required: false },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    required={field.required}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
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
              <div className="flex gap-2 pt-2">
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

      {showImport && (
        <ImportModal
          mode="students"
          onClose={() => setShowImport(false)}
          onDone={() => loadStudents(search)}
        />
      )}
    </div>
  )
}
