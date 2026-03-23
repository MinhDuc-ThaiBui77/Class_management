import { useState, useEffect } from 'react'
import { teachersApi } from '../api'
import { useAuth } from '../hooks/useAuth'

interface Teacher {
  id: number
  fullName: string
  phone: string
  email: string
  subject: string
  notes: string
  classCount: number
  userId: number | null
  userEmail: string | null
}

export default function TeachersPage() {
  const { isAdmin } = useAuth()
  const [teachers, setTeachers] = useState<Teacher[]>([])

  const loadTeachers = () => teachersApi.getAll().then(r => setTeachers(r.data))

  useEffect(() => { loadTeachers() }, [])

  const handleDelete = async (t: Teacher) => {
    const msg = t.userEmail
      ? `Xóa giáo viên "${t.fullName}" và tài khoản "${t.userEmail}"?`
      : `Xóa giáo viên "${t.fullName}"?`
    if (!confirm(msg)) return
    await teachersApi.delete(t.id)
    loadTeachers()
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Giáo viên</h2>
        <p className="text-sm text-gray-400">{teachers.length} giáo viên</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Họ tên</th>
              <th className="px-4 py-3 text-left">Môn</th>
              <th className="px-4 py-3 text-left">Điện thoại</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Tài khoản</th>
              <th className="px-4 py-3 text-left">Lớp đang dạy</th>
              {isAdmin && <th className="px-4 py-3 text-right"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {teachers.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-800">{t.fullName}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{t.subject}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{t.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{t.email || '—'}</td>
                <td className="px-4 py-3">
                  {t.userEmail
                    ? <span className="text-xs text-green-600 font-medium">✓ {t.userEmail}</span>
                    : <span className="text-xs text-gray-400">Chưa link</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{t.classCount} lớp</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t)}
                      className="text-red-400 hover:text-red-600 text-xs transition"
                    >Xóa</button>
                  </td>
                )}
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-gray-400">Chưa có giáo viên nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
