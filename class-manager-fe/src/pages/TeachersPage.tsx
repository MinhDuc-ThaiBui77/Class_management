import { useState, useEffect } from 'react'
import { teachersApi, downloadBlob } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { TableSkeleton } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import Badge from '../components/Badge'

interface Teacher {
  id: number; fullName: string; phone: string; email: string
  subject: string; notes: string; classCount: number; userId: number | null; userEmail: string | null
}

const subjectColors: Record<string, 'teal' | 'blue' | 'purple' | 'amber' | 'red' | 'emerald'> = {
  'Toán': 'teal', 'Văn': 'purple', 'Tiếng Anh': 'blue', 'Lý': 'amber', 'Hoá': 'red',
}

export default function TeachersPage() {
  const { canAdmin } = useAuth()
  const toast = useToast()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<Teacher | null>(null)

  const loadTeachers = async () => {
    setLoading(true)
    try { const r = await teachersApi.getAll(); setTeachers(r.data) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTeachers() }, [])

  const doDelete = async (t: Teacher) => {
    await teachersApi.delete(t.id)
    toast.success(`Đã xóa giáo viên "${t.fullName}"`)
    setConfirmDelete(null)
    loadTeachers()
  }

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(-2).toUpperCase()

  const avatarColors = ['bg-red-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500']

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Giáo viên</h2>
            <p className="text-sm text-gray-400">{teachers.length} giáo viên</p>
          </div>
          <button onClick={async () => { const r = await teachersApi.export(); downloadBlob(r, 'danh-sach-giao-vien.xlsx') }} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition">Export Excel</button>
        </div>
      </div>

      {loading ? <TableSkeleton rows={4} cols={5} /> : teachers.length === 0 ? (
        <EmptyState icon="👩‍🏫" title="Chưa có giáo viên nào" description="Giáo viên được tạo từ mục Tài khoản" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((t, i) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition group">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {initials(t.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{t.fullName}</h3>
                    <Badge color={subjectColors[t.subject] ?? 'gray'} size="sm">{t.subject}</Badge>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                    {t.phone && <div className="flex items-center gap-2"><span className="text-gray-400">SĐT:</span> {t.phone}</div>}
                    {t.email && <div className="flex items-center gap-2"><span className="text-gray-400">Email:</span> {t.email}</div>}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Lớp:</span>
                      <span className="font-medium text-gray-700">{t.classCount} lớp</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Tài khoản:</span>
                      {t.userEmail
                        ? <span className="text-amber-600 font-medium">✓ {t.userEmail}</span>
                        : <span className="text-gray-400">Chưa link</span>}
                    </div>
                  </div>
                </div>
              </div>
              {canAdmin && (
                <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                  <button onClick={() => setConfirmDelete(t)} className="text-red-400 hover:text-red-600 text-xs font-medium">Xóa giáo viên</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Xóa giáo viên"
          message={`Xóa "${confirmDelete.fullName}"${confirmDelete.userEmail ? ` và tài khoản "${confirmDelete.userEmail}"` : ''}? Hành động này không thể hoàn tác.`}
          onConfirm={() => doDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
