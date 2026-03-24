import { useState, useEffect, useRef } from 'react'
import { paymentsApi } from '../api'
import { useAuth } from '../hooks/useAuth'

interface PaymentStatusItem {
  studentId: number
  studentName: string
  classId: number
  className: string | null
  subject: string | null
  teacherName: string | null
  parentPhone: string | null
  tuitionFee: number
  hasClass: boolean
  isPaid: boolean
  paymentId: number | null
  amount: number
  paidDate: string | null
  notes: string
}

interface PaymentData {
  items: PaymentStatusItem[]
  totalCollected: number
  totalEnrollments: number
  paidCount: number
  unpaidCount: number
}

export default function PaymentsPage() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState<PaymentData | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<PaymentStatusItem | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [infoId, setInfoId] = useState<string | null>(null)
  const [infoAbove, setInfoAbove] = useState(false)
  const infoRef = useRef<HTMLDivElement>(null)

  // Filters
  const [filterName, setFilterName] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | 'paid' | 'unpaid' | 'noclass'>('')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => { loadData() }, [])

  // Close info popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadData = async () => {
    const res = await paymentsApi.getAll()
    setData(res.data)
  }

  const openRecord = (s: PaymentStatusItem) => {
    setSelected(s)
    setAmount(s.tuitionFee > 0 ? String(s.tuitionFee) : '500000')
    setNotes('')
    setError('')
    setShowForm(true)
  }

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setError('')
    try {
      await paymentsApi.record({
        studentId: selected.studentId,
        classId: selected.classId,
        amount: Number(amount),
        notes,
      })
      setShowForm(false)
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    }
  }

  const itemKey = (s: PaymentStatusItem) => `${s.studentId}-${s.classId}`

  // Unique class list for filter dropdown
  const classList = data ? [...new Set(data.items.filter(i => i.hasClass).map(i => `${i.className} ${i.subject}`))] : []

  // Apply filters
  const filteredItems = data?.items.filter(s => {
    if (filterName && !s.studentName.toLowerCase().includes(filterName.toLowerCase())) return false
    if (filterClass && `${s.className} ${s.subject}` !== filterClass) return false
    if (filterStatus === 'paid' && !s.isPaid) return false
    if (filterStatus === 'unpaid' && (!s.hasClass || s.isPaid)) return false
    if (filterStatus === 'noclass' && s.hasClass) return false
    if (filterDate && s.paidDate) {
      const paid = new Date(s.paidDate).toISOString().slice(0, 10)
      if (paid !== filterDate) return false
    } else if (filterDate && !s.paidDate) {
      return false
    }
    return true
  }) ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Học phí</h2>
          {data && (
            <p className="text-sm text-gray-400">
              Đã thu: <span className="text-green-600 font-medium">
                {data.totalCollected.toLocaleString('vi-VN')} ₫
              </span>
              {' · '}
              Chưa đóng: <span className="text-red-500 font-medium">{data.unpaidCount} lượt</span>
              {' · '}
              Tổng: <span className="text-gray-600 font-medium">{data.totalEnrollments} lượt đăng ký</span>
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Tìm học sinh..."
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Tất cả lớp</option>
          {classList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="paid">Đã đóng</option>
          <option value="unpaid">Chưa đóng</option>
          <option value="noclass">Chưa có lớp</option>
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        />
        {(filterName || filterClass || filterStatus || filterDate) && (
          <button
            onClick={() => { setFilterName(''); setFilterClass(''); setFilterStatus(''); setFilterDate('') }}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >Xóa bộ lọc</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filteredItems.length} kết quả</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Học sinh</th>
              <th className="px-4 py-3 text-left">Lớp</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Số tiền</th>
              <th className="px-4 py-3 text-left">Ngày đóng</th>
              <th className="px-4 py-3 text-left">Ghi chú</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredItems.map(s => (
              <tr key={itemKey(s)} className={`transition ${
                !s.hasClass ? 'bg-gray-50/50' : s.isPaid ? 'bg-green-50/30' : 'bg-red-50/30'
              }`}>
                <td className="px-4 py-3 font-medium text-gray-800">{s.studentName}</td>
                <td className="px-4 py-3 text-gray-600">
                  {s.hasClass ? (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {s.className} {s.subject}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    !s.hasClass ? 'bg-gray-100 text-gray-500'
                    : s.isPaid ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-600'
                  }`}>
                    {!s.hasClass ? 'Chưa có lớp' : s.isPaid ? 'Đã đóng' : 'Chưa đóng'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {s.isPaid ? `${s.amount.toLocaleString('vi-VN')} ₫` : s.tuitionFee > 0 ? `${s.tuitionFee.toLocaleString('vi-VN')} ₫` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {s.paidDate ? new Date(s.paidDate).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 max-w-[120px] truncate">{s.notes || '—'}</td>
                <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                  {isAdmin && !s.isPaid && s.hasClass && (
                    <button
                      onClick={() => openRecord(s)}
                      className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                    >
                      Ghi nhận
                    </button>
                  )}
                  {/* Info icon */}
                  <div className="relative" ref={infoId === itemKey(s) ? infoRef : undefined}>
                    <button
                      onClick={(e) => {
                        const key = itemKey(s)
                        if (infoId === key) { setInfoId(null); return }
                        const rect = e.currentTarget.getBoundingClientRect()
                        setInfoAbove(rect.bottom + 140 > window.innerHeight)
                        setInfoId(key)
                      }}
                      className="text-gray-400 hover:text-gray-600 transition"
                      title="Thông tin chi tiết"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    {infoId === itemKey(s) && (
                      <div className={`absolute right-0 ${infoAbove ? 'bottom-6' : 'top-6'} bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 w-56 text-xs`}>
                        <div className="space-y-1.5">
                          <div>
                            <span className="text-gray-400">Giáo viên:</span>{' '}
                            <span className="text-gray-700 font-medium">{s.teacherName || 'Chưa có'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Lớp:</span>{' '}
                            <span className="text-gray-700 font-medium">{s.className} {s.subject}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Học phí lớp:</span>{' '}
                            <span className="text-gray-700 font-medium">
                              {s.tuitionFee > 0 ? `${s.tuitionFee.toLocaleString('vi-VN')} ₫` : 'Chưa thiết lập'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">SĐT phụ huynh:</span>{' '}
                            <span className="text-gray-700 font-medium">{s.parentPhone || '—'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Chưa có dữ liệu (học sinh cần được xếp lớp trước)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal ghi nhận */}
      {showForm && selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-1">Ghi nhận học phí</h3>
            <p className="text-sm text-gray-400 mb-4">
              {selected.studentName} · {selected.className} {selected.subject}
            </p>
            <form onSubmit={handleRecord} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Số tiền (₫)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ghi chú</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition"
                >
                  Lưu
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
    </div>
  )
}
