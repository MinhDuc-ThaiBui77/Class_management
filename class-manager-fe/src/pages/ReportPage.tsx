import { useState, useEffect } from 'react'
import { reportsApi, expensesApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Summary {
  revenue: number
  expectedRevenue: number
  teacherCost: number
  expenseCost: number
  totalCost: number
  profit: number
  totalStudents: number
  paidStudents: number
  collectionRate: number
  teacherBreakdown: TeacherCostItem[]
  expenseBreakdown: ExpenseItem[]
}

interface TeacherCostItem {
  teacherId: number
  teacherName: string
  subject: string
  sessionCount: number
  salaryPerSession: number
  total: number
}

interface ExpenseItem {
  id: number
  title: string
  amount: number
  expenseDate: string
  isRecurring: boolean
  notes: string
}

interface ChartItem {
  month: number
  year: number
  revenue: number
  totalCost: number
  profit: number
}

const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12']
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function ReportPage() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [quarter, setQuarter] = useState(Math.ceil(currentMonth / 3))

  const [summary, setSummary] = useState<Summary | null>(null)
  const [chartData, setChartData] = useState<ChartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'teachers' | 'expenses'>('teachers')

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', expenseDate: '', isRecurring: false, notes: '' })
  const [expenseError, setExpenseError] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [summaryRes, chartRes] = await Promise.all([
        reportsApi.summary(period, year, month, quarter),
        reportsApi.chart(year),
      ])
      setSummary(summaryRes.data)
      setChartData(chartRes.data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [period, year, month, quarter])

  const handleExport = async () => {
    const res = await reportsApi.export(period, year, month, quarter)
    const url = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = period === 'quarter' ? `bao-cao-Q${quarter}-${year}.xlsx`
               : period === 'year' ? `bao-cao-${year}.xlsx`
               : `bao-cao-${String(month).padStart(2, '0')}-${year}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setExpenseError('')
    try {
      await expensesApi.create({
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        expenseDate: expenseForm.expenseDate,
        isRecurring: expenseForm.isRecurring,
        notes: expenseForm.notes,
      })
      setShowExpenseForm(false)
      setExpenseForm({ title: '', amount: '', expenseDate: '', isRecurring: false, notes: '' })
      loadData()
    } catch (err: any) {
      setExpenseError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    }
  }

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Xóa chi phí này?')) return
    await expensesApi.delete(id)
    loadData()
  }

  const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ'

  const barData = chartData.map(d => ({
    name: MONTHS[d.month - 1],
    'Doanh thu': d.revenue,
    'Lợi nhuận': d.profit,
  }))

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Báo cáo tài chính</h2>
          <p className="text-sm text-gray-400">Doanh thu, chi phí và lợi nhuận</p>
        </div>
        <button
          onClick={handleExport}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Export Excel
        </button>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                period === p ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'month' ? 'Tháng' : p === 'quarter' ? 'Quý' : 'Năm'}
            </button>
          ))}
        </div>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        >
          {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {period === 'month' && (
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        )}
        {period === 'quarter' && (
          <select
            value={quarter}
            onChange={e => setQuarter(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>Quý {q}</option>)}
          </select>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Đang tải...</p>}

      {summary && !loading && (
        <>
          {/* Dashboard cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card label="Doanh thu" value={fmt(summary.revenue)} color="blue" />
            <Card label="Chi phí GV" value={fmt(summary.teacherCost)} color="orange" />
            <Card label="Chi phí khác" value={fmt(summary.expenseCost)} color="gray" />
            <Card label="Lợi nhuận" value={fmt(summary.profit)} color={summary.profit >= 0 ? 'green' : 'red'} />
          </div>

          {/* Collection rate */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Tỷ lệ thu học phí</span>
              <span className="text-sm font-medium text-gray-800">{summary.paidStudents}/{summary.totalStudents} HS ({summary.collectionRate}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(summary.collectionRate, 100)}%` }}
              />
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Biểu đồ doanh thu & lợi nhuận năm {year}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}tr`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Lợi nhuận" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail tabs */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setTab('teachers')}
                className={`px-4 py-3 text-sm font-medium transition ${
                  tab === 'teachers' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Lương giáo viên ({summary.teacherBreakdown.length})
              </button>
              <button
                onClick={() => setTab('expenses')}
                className={`px-4 py-3 text-sm font-medium transition ${
                  tab === 'expenses' ? 'text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Chi phí khác ({summary.expenseBreakdown.length})
              </button>
            </div>

            {tab === 'teachers' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Giáo viên</th>
                    <th className="px-4 py-3 text-left">Môn</th>
                    <th className="px-4 py-3 text-right">Số buổi</th>
                    <th className="px-4 py-3 text-right">Lương/buổi</th>
                    <th className="px-4 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {summary.teacherBreakdown.map(t => (
                    <tr key={t.teacherId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{t.teacherName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{t.subject}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{t.sessionCount}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(t.salaryPerSession)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(t.total)}</td>
                    </tr>
                  ))}
                  {summary.teacherBreakdown.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chưa có dữ liệu</td></tr>
                  )}
                  {summary.teacherBreakdown.length > 0 && (
                    <tr className="bg-gray-50 font-medium">
                      <td colSpan={4} className="px-4 py-3 text-right text-gray-600">Tổng cộng</td>
                      <td className="px-4 py-3 text-right text-gray-800">{fmt(summary.teacherCost)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'expenses' && (
              <div>
                <div className="px-4 py-3 border-b border-gray-50 flex justify-end">
                  <button
                    onClick={() => setShowExpenseForm(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition"
                  >
                    + Thêm chi phí
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Khoản mục</th>
                      <th className="px-4 py-3 text-right">Số tiền</th>
                      <th className="px-4 py-3 text-left">Ngày</th>
                      <th className="px-4 py-3 text-left">Loại</th>
                      <th className="px-4 py-3 text-left">Ghi chú</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {summary.expenseBreakdown.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{e.title}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(e.amount)}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(e.expenseDate).toLocaleDateString('vi-VN')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            e.isRecurring ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {e.isRecurring ? 'Cố định' : 'Phát sinh'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{e.notes || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteExpense(e.id)} className="text-red-400 hover:text-red-600 text-xs">Xóa</button>
                        </td>
                      </tr>
                    ))}
                    {summary.expenseBreakdown.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chưa có chi phí</td></tr>
                    )}
                    {summary.expenseBreakdown.length > 0 && (
                      <tr className="bg-gray-50 font-medium">
                        <td className="px-4 py-3 text-right text-gray-600">Tổng cộng</td>
                        <td className="px-4 py-3 text-right text-gray-800">{fmt(summary.expenseCost)}</td>
                        <td colSpan={4}></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Expense form modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Thêm chi phí</h3>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Khoản mục *</label>
                <input
                  required
                  value={expenseForm.title}
                  onChange={e => setExpenseForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Thuê phòng, Mua dụng cụ vệ sinh"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Số tiền (VNĐ) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="VD: 3000000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ngày *</label>
                <input
                  required
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={e => setExpenseForm(f => ({ ...f, expenseDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={expenseForm.isRecurring}
                  onChange={e => setExpenseForm(f => ({ ...f, isRecurring: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="isRecurring" className="text-sm text-gray-600">Chi phí cố định hàng tháng</label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ghi chú</label>
                <input
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {expenseError && <p className="text-red-500 text-sm">{expenseError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition">Lưu</button>
                <button type="button" onClick={() => setShowExpenseForm(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    gray: 'bg-gray-50 text-gray-700',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${colors[color]?.split(' ')[1] ?? 'text-gray-800'}`}>{value}</p>
    </div>
  )
}
