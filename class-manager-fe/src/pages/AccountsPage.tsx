import { useState, useEffect } from 'react'
import { usersApi } from '../api'
import { useAuth } from '../hooks/useAuth'

interface UserAccount {
  id: number
  fullName: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  teacherId: number | null
  teacherName: string | null
}

const SUBJECTS = [
  'Toán', 'Văn', 'Tiếng Anh', 'Lý', 'Hoá',
  'Luyện viết TH 1', 'Luyện viết TH 2', 'Luyện viết TH 3', 'Luyện viết TH 4', 'Luyện viết TH 5',
]

const emptyCreateForm = {
  fullName: '', email: '', password: '', role: 'teacher',
  teacherSubject: '', teacherPhone: '',
}

const emptyEditForm = {
  fullName: '', role: 'teacher',
  teacherSubject: '', teacherPhone: '',
}

export default function AccountsPage() {
  const { user: me } = useAuth()
  const [accounts, setAccounts]           = useState<UserAccount[]>([])
  const [loading, setLoading]             = useState(false)

  // Modal: tạo tài khoản
  const [showCreate, setShowCreate]       = useState(false)
  const [createForm, setCreateForm]       = useState(emptyCreateForm)
  const [createError, setCreateError]     = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  // Modal: sửa tài khoản
  const [editTarget, setEditTarget]       = useState<UserAccount | null>(null)
  const [editForm, setEditForm]           = useState(emptyEditForm)
  const [editError, setEditError]         = useState('')
  const [editLoading, setEditLoading]     = useState(false)

  // Modal: reset mật khẩu
  const [resetTarget, setResetTarget]     = useState<UserAccount | null>(null)
  const [resetPw, setResetPw]             = useState('')
  const [resetError, setResetError]       = useState('')
  const [resetLoading, setResetLoading]   = useState(false)

  // Modal: đổi mật khẩu bản thân
  const [showChangePw, setShowChangePw]   = useState(false)
  const [changePwForm, setChangePwForm]   = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [changePwError, setChangePwError] = useState('')
  const [changePwLoading, setChangePwLoading] = useState(false)

  useEffect(() => { loadAccounts() }, [])

  const loadAccounts = () => {
    setLoading(true)
    usersApi.getAll().then(r => setAccounts(r.data)).finally(() => setLoading(false))
  }

  // ── Tạo tài khoản ───────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)
    try {
      const payload: Record<string, unknown> = {
        fullName: createForm.fullName,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
      }
      if (createForm.role === 'teacher') {
        payload.teacherSubject = createForm.teacherSubject
        if (createForm.teacherPhone) payload.teacherPhone = createForm.teacherPhone
      }
      const res = await usersApi.create(payload)
      setShowCreate(false)
      setAccounts(prev => [...prev, res.data].sort((a, b) => a.fullName.localeCompare(b.fullName)))
    } catch (err: any) {
      setCreateError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setCreateLoading(false)
    }
  }

  // ── Sửa tài khoản ───────────────────────────────────────────────
  const openEdit = (u: UserAccount) => {
    setEditTarget(u)
    setEditError('')
    setEditForm({ fullName: u.fullName, role: u.role, teacherSubject: '', teacherPhone: '' })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setEditError('')
    setEditLoading(true)
    try {
      const payload: Record<string, unknown> = { fullName: editForm.fullName, role: editForm.role }
      if (editForm.role === 'teacher' && editForm.teacherSubject) {
        payload.teacherSubject = editForm.teacherSubject
        if (editForm.teacherPhone) payload.teacherPhone = editForm.teacherPhone
      }
      const res = await usersApi.update(editTarget.id, payload)
      setEditTarget(null)
      setAccounts(prev => prev.map(a => a.id === editTarget.id ? res.data : a))
    } catch (err: any) {
      setEditError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Reset mật khẩu ──────────────────────────────────────────────
  const openReset = (u: UserAccount) => { setResetTarget(u); setResetPw(''); setResetError('') }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    setResetError('')
    setResetLoading(true)
    try {
      await usersApi.resetPassword(resetTarget.id, resetPw)
      setResetTarget(null)
    } catch (err: any) {
      setResetError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setResetLoading(false)
    }
  }

  // ── Xóa tài khoản ───────────────────────────────────────────────
  const handleDelete = async (u: UserAccount) => {
    if (!confirm(`Xóa vĩnh viễn tài khoản "${u.fullName}" (${u.email})?\nHành động này không thể hoàn tác.`)) return
    try {
      await usersApi.delete(u.id)
      setAccounts(prev => prev.filter(a => a.id !== u.id))
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    }
  }

  // ── Toggle active ────────────────────────────────────────────────
  const handleToggleActive = async (u: UserAccount) => {
    const action = u.isActive ? 'vô hiệu hóa' : 'kích hoạt'
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} tài khoản "${u.fullName}"?`)) return
    try {
      const res = await usersApi.toggleActive(u.id)
      setAccounts(prev => prev.map(a => a.id === u.id ? res.data : a))
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    }
  }

  // ── Đổi mật khẩu bản thân ───────────────────────────────────────
  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePwError('')
    if (changePwForm.newPassword !== changePwForm.confirm) {
      setChangePwError('Mật khẩu xác nhận không khớp.')
      return
    }
    setChangePwLoading(true)
    try {
      await usersApi.changePassword(changePwForm.currentPassword, changePwForm.newPassword)
      setShowChangePw(false)
      setChangePwForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err: any) {
      setChangePwError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setChangePwLoading(false)
    }
  }

  const roleBadge = (role: string) => {
    switch (role) {
      case 'owner':
      case 'admin':
        return <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">
          {role === 'owner' ? 'Admin' : 'Admin'}
        </span>
      case 'manager':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-xs font-medium">Quản lý</span>
      default:
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">Giáo viên</span>
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Quản lý tài khoản</h2>
          <p className="text-sm text-gray-400">{accounts.length} tài khoản</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowChangePw(true); setChangePwError('') }}
            className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Đổi mật khẩu
          </button>
          <button
            onClick={() => { setCreateForm(emptyCreateForm); setCreateError(''); setShowCreate(true) }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + Tạo tài khoản
          </button>
        </div>
      </div>

      {/* Bảng tài khoản */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Họ tên</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Hồ sơ GV</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Ngày tạo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Đang tải...</td></tr>
            )}
            {!loading && accounts.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 transition ${!u.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {u.fullName}
                  {u.email === me?.email && <span className="ml-2 text-xs text-gray-400">(bạn)</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">{roleBadge(u.role)}</td>
                <td className="px-4 py-3">
                  {u.teacherName
                    ? <span className="text-xs text-green-600 font-medium">✓ {u.teacherName}</span>
                    : u.role === 'teacher'
                      ? <span className="text-xs text-orange-400">⚠ Chưa link</span>
                      : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {u.isActive
                    ? <span className="text-xs text-green-600 font-medium">Hoạt động</span>
                    : <span className="text-xs text-gray-400">Vô hiệu</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(u)} className="text-blue-500 hover:text-blue-700 text-xs">Sửa</button>
                  <button onClick={() => openReset(u)} className="text-orange-400 hover:text-orange-600 text-xs">Reset PW</button>
                  {u.email !== me?.email && (<>
                    <button onClick={() => handleToggleActive(u)}
                      className={`text-xs ${u.isActive ? 'text-amber-500 hover:text-amber-700' : 'text-green-500 hover:text-green-700'}`}>
                      {u.isActive ? 'Vô hiệu' : 'Kích hoạt'}
                    </button>
                    <button onClick={() => handleDelete(u)}
                      className="text-red-400 hover:text-red-600 text-xs">
                      Xóa
                    </button>
                  </>)}
                </td>
              </tr>
            ))}
            {!loading && accounts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Chưa có tài khoản nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Tạo tài khoản */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-800 mb-4">Tạo tài khoản mới</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Họ tên *</label>
                <input type="text" required value={createForm.fullName}
                  onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input type="email" required value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mật khẩu * (tối thiểu 6 ký tự)</label>
                <input type="password" required minLength={6} value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role *</label>
                <select required value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value, teacherSubject: '', teacherPhone: '' }))}
                  className={inputCls}>
                  <option value="teacher">Giáo viên</option>
                  <option value="manager">Quản lý</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {createForm.role === 'teacher' && (
                <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/40 space-y-2">
                  <p className="text-xs font-medium text-blue-700">Hồ sơ giáo viên *</p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Môn dạy *</label>
                    <select required value={createForm.teacherSubject}
                      onChange={e => setCreateForm(f => ({ ...f, teacherSubject: e.target.value }))}
                      className={inputCls}>
                      <option value="">-- Chọn môn --</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Số điện thoại</label>
                    <input type="tel" value={createForm.teacherPhone}
                      onChange={e => setCreateForm(f => ({ ...f, teacherPhone: e.target.value }))}
                      placeholder="0912345678"
                      className={inputCls} />
                  </div>
                </div>
              )}
              {createError && <p className="text-red-500 text-sm">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={createLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50">
                  {createLoading ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sửa tài khoản */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-800 mb-1">Chỉnh sửa tài khoản</h3>
            <p className="text-xs text-gray-400 mb-4">{editTarget.email}</p>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Họ tên *</label>
                <input type="text" required value={editForm.fullName}
                  onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role *</label>
                <select required value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value, teacherSubject: '', teacherPhone: '' }))}
                  className={inputCls}>
                  <option value="teacher">Giáo viên</option>
                  <option value="manager">Quản lý</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editForm.role === 'teacher' && (
                <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/40 space-y-2">
                  <p className="text-xs font-medium text-blue-700">
                    Cập nhật hồ sơ giáo viên
                    {editTarget.teacherName && <span className="ml-1 font-normal text-gray-400">(hiện: {editTarget.teacherName})</span>}
                  </p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Môn dạy</label>
                    <select value={editForm.teacherSubject}
                      onChange={e => setEditForm(f => ({ ...f, teacherSubject: e.target.value }))}
                      className={inputCls}>
                      <option value="">-- Giữ nguyên --</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Số điện thoại</label>
                    <input type="tel" value={editForm.teacherPhone}
                      onChange={e => setEditForm(f => ({ ...f, teacherPhone: e.target.value }))}
                      placeholder="Nhập để cập nhật"
                      className={inputCls} />
                  </div>
                </div>
              )}
              {editError && <p className="text-red-500 text-sm">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={editLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50">
                  {editLoading ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button type="button" onClick={() => setEditTarget(null)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset mật khẩu */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-1">Reset mật khẩu</h3>
            <p className="text-sm text-gray-400 mb-4">{resetTarget.fullName} — {resetTarget.email}</p>
            <form onSubmit={handleReset} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mật khẩu mới * (tối thiểu 6 ký tự)</label>
                <input type="password" required minLength={6} value={resetPw}
                  onChange={e => setResetPw(e.target.value)}
                  className={inputCls} />
              </div>
              {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={resetLoading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50">
                  {resetLoading ? 'Đang reset...' : 'Reset mật khẩu'}
                </button>
                <button type="button" onClick={() => setResetTarget(null)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Đổi mật khẩu bản thân */}
      {showChangePw && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Đổi mật khẩu của bạn</h3>
            <form onSubmit={handleChangePw} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mật khẩu hiện tại *</label>
                <input type="password" required value={changePwForm.currentPassword}
                  onChange={e => setChangePwForm(f => ({ ...f, currentPassword: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mật khẩu mới * (tối thiểu 6 ký tự)</label>
                <input type="password" required minLength={6} value={changePwForm.newPassword}
                  onChange={e => setChangePwForm(f => ({ ...f, newPassword: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Xác nhận mật khẩu mới *</label>
                <input type="password" required value={changePwForm.confirm}
                  onChange={e => setChangePwForm(f => ({ ...f, confirm: e.target.value }))}
                  className={inputCls} />
              </div>
              {changePwError && <p className="text-red-500 text-sm">{changePwError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={changePwLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50">
                  {changePwLoading ? 'Đang lưu...' : 'Đổi mật khẩu'}
                </button>
                <button type="button" onClick={() => setShowChangePw(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
