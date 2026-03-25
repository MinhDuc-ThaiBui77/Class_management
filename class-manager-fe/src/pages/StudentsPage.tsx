import { useState, useEffect, useRef, useCallback } from 'react'
import { studentsApi, downloadBlob } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { TableSkeleton } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import ImportModal from '../components/ImportModal'

interface StudentClass { className: string; subject: string; teacherName: string | null }
interface Student {
  id: number; fullName: string; address: string; parentPhone: string
  enrolledDate: string; notes: string; classCount: number; classes: StudentClass[]
}

const emptyForm = { fullName: '', address: '', parentPhone: '', dateOfBirth: '', enrolledDate: '', notes: '' }
type SortKey = 'fullName' | 'address' | 'classCount' | 'enrolledDate'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

export default function StudentsPage() {
  const { canManage } = useAuth()
  const toast = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('fullName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [tooltip, setTooltip] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  useEffect(() => { loadStudents() }, [])

  const loadStudents = async (kw = '') => {
    setLoading(true)
    try {
      const res = await studentsApi.getAll(kw || undefined)
      setStudents(res.data)
      setSelected(new Set())
    } finally { setLoading(false) }
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    setPage(1)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadStudents(val), 300)
  }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true) }
  const openEdit = (s: Student) => {
    setEditing(s)
    setForm({ fullName: s.fullName, address: s.address, parentPhone: s.parentPhone, dateOfBirth: '', enrolledDate: s.enrolledDate?.slice(0, 10) ?? '', notes: s.notes })
    setError(''); setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const payload = { ...form, dateOfBirth: form.dateOfBirth || null, enrolledDate: form.enrolledDate || new Date().toISOString() }
      if (editing) await studentsApi.update(editing.id, payload)
      else await studentsApi.create(payload)
      setShowForm(false); loadStudents(search)
      toast.success(editing ? 'Đã cập nhật học sinh' : 'Đã thêm học sinh mới')
    } catch (err: any) { setError(err.response?.data?.message ?? 'Có lỗi xảy ra.') }
    finally { setSaving(false) }
  }

  const doDelete = async (s: Student) => {
    await studentsApi.delete(s.id); loadStudents(search)
    toast.success(`Đã xóa "${s.fullName}"`)
    setConfirmDelete(null)
  }

  const doBulkDelete = async () => {
    setBulkDeleting(true); setConfirmBulk(false)
    try {
      await Promise.all([...selected].map(id => studentsApi.delete(id)))
      toast.success(`Đã xóa ${selected.size} học sinh`)
      loadStudents(search)
    } finally { setBulkDeleting(false) }
  }

  // Sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const sorted = [...students].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'fullName') cmp = a.fullName.localeCompare(b.fullName, 'vi')
    else if (sortKey === 'address') cmp = a.address.localeCompare(b.address, 'vi')
    else if (sortKey === 'classCount') cmp = a.classCount - b.classCount
    else cmp = new Date(a.enrolledDate).getTime() - new Date(b.enrolledDate).getTime()
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Bulk
  const allSelected = paged.length > 0 && paged.every(s => selected.has(s.id))
  const someSelected = paged.some(s => selected.has(s.id))
  const toggleAll = () => { allSelected ? setSelected(new Set()) : setSelected(new Set(paged.map(s => s.id))) }
  const toggleOne = (id: number) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey !== col ? <span className="ml-1 text-gray-300">↕</span> : <span className="ml-1 text-red-500">{sortDir === 'asc' ? '↑' : '↓'}</span>

  // Stats
  const withClass = students.filter(s => s.classCount > 0).length
  const noClass = students.length - withClass

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Học sinh</h2>
          <p className="text-sm text-gray-400">{students.length} học sinh</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { const r = await studentsApi.export(); downloadBlob(r, 'danh-sach-hoc-sinh.xlsx') }} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition">Export Excel</button>
          {canManage && <button onClick={() => setShowImport(true)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition">Import Excel</button>}
          <button onClick={openAdd} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">+ Thêm học sinh</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Tổng học sinh" value={students.length} icon="👨‍🎓" color="teal" />
        <StatCard label="Đang học" value={withClass} icon="📚" color="emerald" subtitle={`${withClass > 0 ? Math.round(withClass / students.length * 100) : 0}%`} />
        <StatCard label="Chưa có lớp" value={noClass} icon="⏳" color={noClass > 0 ? 'amber' : 'gray'} />
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          placeholder="Tìm theo tên, địa chỉ, SĐT..."
          value={search}
          onChange={handleSearch}
          autoFocus
          className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white placeholder-gray-400 transition"
        />
      </div>

      {/* Bulk bar */}
      {canManage && someSelected && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm animate-fade-in">
          <span className="text-red-700 font-medium">Đang chọn {selected.size} học sinh</span>
          <button onClick={() => setConfirmBulk(true)} disabled={bulkDeleting} className="ml-auto bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50">
            {bulkDeleting ? 'Đang xóa...' : `Xóa ${selected.size} học sinh`}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 text-xs">Bỏ chọn</button>
        </div>
      )}

      {/* Table */}
      {loading ? <TableSkeleton rows={8} cols={6} /> : sorted.length === 0 ? (
        <EmptyState icon="👨‍🎓" title="Chưa có học sinh nào" description="Thêm học sinh mới hoặc import từ Excel" action={{ label: '+ Thêm học sinh', onClick: openAdd }} />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {canManage && <th className="px-4 py-3 w-8"><input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected }} onChange={toggleAll} className="cursor-pointer rounded" /></th>}
                  <th className="px-4 py-3 text-left w-10">STT</th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('fullName')}>Họ tên <SortIcon col="fullName" /></th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('address')}>Địa chỉ <SortIcon col="address" /></th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('classCount')}>Lớp <SortIcon col="classCount" /></th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('enrolledDate')}>Ngày nhập học <SortIcon col="enrolledDate" /></th>
                  <th className="px-4 py-3 text-left">Ghi chú</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paged.map((s, idx) => (
                  <tr key={s.id} className={`transition ${selected.has(s.id) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    {canManage && <td className="px-4 py-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} className="cursor-pointer rounded" /></td>}
                    <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.fullName}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{s.address || '—'}</td>
                    <td className="px-4 py-3">
                      {s.classCount === 0 ? <Badge color="gray">Chưa có lớp</Badge> : (
                        <div className="relative inline-block">
                          <button onMouseEnter={() => setTooltip(s.id)} onMouseLeave={() => setTooltip(null)} className="text-red-600 text-xs font-medium hover:underline">{s.classCount} lớp</button>
                          {tooltip === s.id && (
                            <div className="absolute z-20 left-0 top-6 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[200px] animate-fade-in">
                              {s.classes.map((c, i) => (
                                <div key={i} className="text-xs text-gray-700 py-1.5 border-b border-gray-50 last:border-0">
                                  <span className="font-medium">{c.className}</span> <span className="text-gray-400">·</span> {c.subject}
                                  {c.teacherName && <div className="text-gray-400 mt-0.5">{c.teacherName}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.enrolledDate ? new Date(s.enrolledDate).toLocaleDateString('vi-VN') : ''}</td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{s.notes}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => openEdit(s)} className="text-red-600 hover:text-red-700 text-xs font-medium">Sửa</button>
                      {canManage && <button onClick={() => setConfirmDelete(s)} className="text-red-400 hover:text-red-600 text-xs">Xóa</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-gray-400">Trang {page}/{totalPages} ({sorted.length} kết quả)</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition">◀</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 rounded-lg text-sm transition ${page === p ? 'bg-red-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition">▶</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 mb-4">{editing ? 'Chỉnh sửa học sinh' : 'Thêm học sinh mới'}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              {[
                { label: 'Họ tên *', key: 'fullName', type: 'text', required: true },
                { label: 'Địa chỉ', key: 'address', type: 'text', required: false },
                { label: 'SĐT phụ huynh', key: 'parentPhone', type: 'tel', required: false },
                { label: 'Ngày sinh', key: 'dateOfBirth', type: 'date', required: false },
                { label: 'Ngày nhập học', key: 'enrolledDate', type: 'date', required: false },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                  <input type={field.type} required={field.required} value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white transition" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white transition" rows={2} />
              </div>
              {error && <div className="bg-red-50 border border-red-100 text-red-700 px-3 py-2 rounded-xl text-sm animate-shake">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-50">
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-medium transition">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm dialogs */}
      {confirmDelete && <ConfirmDialog title="Xóa học sinh" message={`Bạn có chắc muốn xóa "${confirmDelete.fullName}"? Hành động này không thể hoàn tác.`} onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
      {confirmBulk && <ConfirmDialog title={`Xóa ${selected.size} học sinh`} message="Tất cả học sinh đã chọn sẽ bị xóa. Hành động này không thể hoàn tác." confirmLabel={`Xóa ${selected.size} học sinh`} onConfirm={doBulkDelete} onCancel={() => setConfirmBulk(false)} />}

      {showImport && <ImportModal mode="students" onClose={() => setShowImport(false)} onDone={() => loadStudents(search)} />}
    </div>
  )
}
