import { useState, useEffect } from 'react'
import { paymentsApi } from '../api'
import { useAuth } from '../hooks/useAuth'

interface PaymentStatusItem {
  studentId: number
  studentName: string
  isPaid: boolean
  amount: number
  paidDate: string | null
  notes: string
}

interface MonthlyData {
  month: number
  year: number
  students: PaymentStatusItem[]
  totalCollected: number
  unpaidCount: number
}

export default function PaymentsPage() {
  const { isAdmin } = useAuth()
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [data, setData] = useState<MonthlyData | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<PaymentStatusItem | null>(null)
  const [amount, setAmount] = useState('500000')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [month, year])

  const loadData = async () => {
    const res = await paymentsApi.getMonthly(month, year)
    setData(res.data)
  }

  const openRecord = (s: PaymentStatusItem) => {
    if (s.isPaid) return
    setSelectedStudent(s)
    setAmount('500000')
    setNotes('')
    setError('')
    setShowForm(true)
  }

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudent) return
    setError('')
    try {
      await paymentsApi.record({
        studentId: selectedStudent.studentId,
        amount: Number(amount),
        monthOf: month,
        yearOf: year,
        notes,
      })
      setShowForm(false)
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    }
  }

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
              Chưa đóng: <span className="text-red-500 font-medium">{data.unpaidCount} học sinh</span>
            </p>
          )}
        </div>

        {/* Month/Year picker */}
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Học sinh</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Số tiền</th>
              <th className="px-4 py-3 text-left">Ngày đóng</th>
              <th className="px-4 py-3 text-left">Ghi chú</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.students.map(s => (
              <tr key={s.studentId} className={`transition ${s.isPaid ? 'bg-green-50/30' : 'bg-red-50/30'}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{s.studentName}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    s.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {s.isPaid ? 'Đã đóng' : 'Chưa đóng'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {s.isPaid ? `${s.amount.toLocaleString('vi-VN')} ₫` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {s.paidDate ? new Date(s.paidDate).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400">{s.notes}</td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && !s.isPaid && (
                    <button
                      onClick={() => openRecord(s)}
                      className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                    >
                      Ghi nhận
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {(!data || data.students.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal ghi nhận */}
      {showForm && selectedStudent && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-1">Ghi nhận học phí</h3>
            <p className="text-sm text-gray-400 mb-4">
              {selectedStudent.studentName} · Tháng {month}/{year}
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
