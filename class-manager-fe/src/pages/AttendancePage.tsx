import { useState, useEffect } from 'react'
import { attendanceApi, classesApi } from '../api'

interface Class {
  id: number
  name: string
  subject: string
}

interface Session {
  id: number
  classId: number
  className: string
  subject: string
  sessionDate: string
  topic: string
  notes: string
}

interface AttendanceItem {
  studentId: number
  studentName: string
  status: string
  reason: string
}

export default function AttendancePage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<Session | null>(null)
  const [records, setRecords] = useState<AttendanceItem[]>([])
  const [showNewSession, setShowNewSession] = useState(false)
  const [newClassId, setNewClassId] = useState<number | ''>('')
  const [newTopic, setNewTopic] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
  const [savingId, setSavingId] = useState<number | null>(null)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    loadSessions()
    classesApi.getAll().then(r => setClasses(r.data))
  }, [])

  const loadSessions = async () => {
    const res = await attendanceApi.getSessions()
    setSessions(res.data)
  }

  const selectSession = async (s: Session) => {
    setSelected(s)
    const res = await attendanceApi.getForSession(s.id)
    setRecords(res.data)
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setSessionError('')
    if (!newTopic.trim() || newClassId === '') return
    try {
      await attendanceApi.createSession({ classId: newClassId, sessionDate: newDate, topic: newTopic })
      setNewTopic('')
      setNewClassId('')
      setShowNewSession(false)
      loadSessions()
    } catch (err: any) {
      setSessionError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    }
  }

  const handleDeleteSession = async (s: Session) => {
    if (!confirm(`Xóa buổi học "${s.topic}"?`)) return
    await attendanceApi.deleteSession(s.id)
    setSelected(null)
    setRecords([])
    loadSessions()
  }

  const setStatus = (studentId: number, status: string) => {
    setRecords(r => r.map(x => {
      if (x.studentId !== studentId) return x
      // Nếu chuyển sang Present thì xóa lý do
      const reason = status === 'Present' ? '' : x.reason
      return { ...x, status, reason }
    }))
    // Auto-save khi click trạng thái
    autoSave(studentId, status)
  }

  const autoSave = async (changedStudentId?: number, changedStatus?: string) => {
    if (!selected) return
    setSavingId(changedStudentId ?? null)
    // Dùng records mới nhất
    const currentRecords = records.map(r =>
      r.studentId === changedStudentId
        ? { ...r, status: changedStatus ?? r.status, reason: (changedStatus === 'Present' ? '' : r.reason) }
        : r
    )
    await attendanceApi.save(selected.id, currentRecords)
    setSavingId(null)
  }

  const saveReason = async (studentId: number, reason: string) => {
    if (!selected) return
    setRecords(r => r.map(x => x.studentId === studentId ? { ...x, reason } : x))
    setSavingId(studentId)
    const currentRecords = records.map(r =>
      r.studentId === studentId ? { ...r, reason } : r
    )
    await attendanceApi.save(selected.id, currentRecords)
    setSavingId(null)
  }

  const statusColor = (s: string) =>
    s === 'Present' ? 'bg-green-100 text-green-700' :
    s === 'Absent'  ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-700'

  const statusLabel = (s: string) =>
    s === 'Present' ? 'Có mặt' : s === 'Absent' ? 'Vắng' : 'Có phép'

  return (
    <div className="flex gap-6 h-full">
      {/* Danh sách buổi học */}
      <div className="w-64 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Buổi học</h2>
          <button
            onClick={() => { setShowNewSession(true); setSessionError('') }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >+ Tạo</button>
        </div>

        {showNewSession && (
          <form onSubmit={handleCreateSession} className="bg-white border border-gray-200 rounded-xl p-3 mb-3 space-y-2">
            <select
              value={newClassId}
              onChange={e => setNewClassId(Number(e.target.value))}
              required
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn lớp --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>
              ))}
            </select>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Chủ đề buổi học..."
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {sessionError && <p className="text-red-500 text-xs">{sessionError}</p>}
            <div className="flex gap-1">
              <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs font-medium">Tạo</button>
              <button type="button" onClick={() => setShowNewSession(false)} className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs text-gray-500">Hủy</button>
            </div>
          </form>
        )}

        <div className="space-y-1">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => selectSession(s)}
              className={`rounded-xl px-3 py-2.5 cursor-pointer group transition ${
                selected?.id === s.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="text-xs font-medium text-blue-600 mb-0.5">{s.className} · {s.subject}</div>
              <div className="text-sm font-medium text-gray-800 truncate">{s.topic}</div>
              <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-between">
                <span>{new Date(s.sessionDate).toLocaleDateString('vi-VN')}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteSession(s) }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                >✕</button>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Chưa có buổi học</p>
          )}
        </div>
      </div>

      {/* Bảng điểm danh */}
      <div className="flex-1">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            ← Chọn buổi học để điểm danh
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="text-xs font-medium text-blue-600 mb-0.5">{selected.className} · {selected.subject}</div>
              <h3 className="font-semibold text-gray-800">{selected.topic}</h3>
              <p className="text-sm text-gray-400">
                {new Date(selected.sessionDate).toLocaleDateString('vi-VN')} · {records.length} học sinh
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Học sinh</th>
                    <th className="px-4 py-3 text-left">Trạng thái</th>
                    <th className="px-4 py-3 text-left">Lý do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map(r => (
                    <tr key={r.studentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.studentName}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {['Present', 'Absent', 'Excused'].map(s => (
                            <button
                              key={s}
                              onClick={() => setStatus(r.studentId, s)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                                r.status === s
                                  ? statusColor(s)
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              {statusLabel(s)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.status !== 'Present' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Nhập lý do..."
                              defaultValue={r.reason}
                              onBlur={e => {
                                if (e.target.value !== r.reason) saveReason(r.studentId, e.target.value)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  const val = (e.target as HTMLInputElement).value
                                  if (val !== r.reason) saveReason(r.studentId, val)
                                }
                              }}
                              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {savingId === r.studentId && (
                              <span className="text-green-500 text-xs">✓</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                        Lớp này chưa có học sinh nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
