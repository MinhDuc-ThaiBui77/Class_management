import { useState, useEffect } from 'react'
import { attendanceApi, classesApi } from '../api'
import { useAuth } from '../hooks/useAuth'

interface ClassItem { id: number; name: string; subject: string; teacherName: string | null }
interface Session {
  id: number; classId: number; className: string; subject: string; teacherName: string | null
  sessionDate: string; room: string; timeSlot: string; topic: string; notes: string
  sessionIndex: number; totalSessions: number | null
}
interface AttendanceItem { studentId: number; studentName: string; status: string; reason: string }

const ROOMS = ['Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 4', 'Phòng 5']
const SLOTS = ['Sáng', 'Chiều', 'Tối']
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mini Calendar Component — highlight ngày có lớp
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MiniCalendar({ selectedDate, onSelect, sessionDates, mode = 'day' }: {
  selectedDate: string
  onSelect: (date: string) => void
  sessionDates: Set<string>
  mode?: 'day' | 'week' // day = highlight 1 ngày, week = highlight cả tuần
}) {
  const sel = new Date(selectedDate + 'T00:00')
  const [viewYear, setViewYear] = useState(sel.getFullYear())
  const [viewMonth, setViewMonth] = useState(sel.getMonth())

  const today = toDateStr(new Date())
  const firstDay = new Date(viewYear, viewMonth, 1)
  const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  // Week highlight: tính monday + sunday của tuần đang chọn
  const selMonday = getMonday(sel)
  const selSunday = addDays(selMonday, 6)
  const isInSelectedWeek = (ds: string) => {
    if (mode !== 'week') return false
    return ds >= toDateStr(selMonday) && ds <= toDateStr(selSunday)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })

  // Build calendar cells: startOffset empty + daysInMonth cells
  const cells: { day: number; ds: string }[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, ds: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}` })
  }

  // Group cells into rows of 7 (for week outline)
  const rows: (typeof cells[0] | null)[][] = []
  let row: (typeof cells[0] | null)[] = Array.from({ length: startOffset }, () => null)
  for (const cell of cells) {
    row.push(cell)
    if (row.length === 7) { rows.push(row); row = [] }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null)
    rows.push(row)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 w-64">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 px-1">◀</button>
        <span className="text-sm font-semibold text-gray-700 capitalize">{monthLabel}</span>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700 px-1">▶</button>
      </div>
      <div className="text-center">
        {/* Header */}
        <div className="grid grid-cols-7 gap-0.5">
          {['T2','T3','T4','T5','T6','T7','CN'].map(d => (
            <div key={d} className="text-[10px] text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>
        {/* Rows */}
        {rows.map((weekRow, ri) => {
          const weekHasSelection = mode === 'week' && weekRow.some(c => c && isInSelectedWeek(c.ds))
          return (
            <div
              key={ri}
              className={`grid grid-cols-7 gap-0.5 my-0.5 ${weekHasSelection ? 'ring-2 ring-red-400 rounded-lg bg-red-50/40 relative z-10' : ''}`}
            >
              {weekRow.map((cell, ci) => {
                if (!cell) return <div key={`e${ri}-${ci}`} className="w-8 h-8" />
                const { day, ds } = cell
                const isSelected = mode === 'day' && ds === selectedDate
                const inWeek = mode === 'week' && isInSelectedWeek(ds)
                const isToday = ds === today
                const hasSession = sessionDates.has(ds)

                return (
                  <button
                    key={day}
                    onClick={() => onSelect(ds)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition relative ${
                      isSelected
                        ? 'bg-red-600 text-white'
                        : inWeek
                          ? hasSession
                            ? 'text-red-800 font-bold'
                            : 'text-red-700 font-semibold'
                          : isToday
                            ? 'bg-red-50 text-red-700 font-bold'
                            : hasSession
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {day}
                    {hasSession && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" />
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Có lớp</span>
        {mode === 'day'
          ? <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600" /> Đang chọn</span>
          : <span className="flex items-center gap-1"><span className="w-6 h-3 rounded ring-2 ring-red-400 bg-red-50" /> Tuần chọn</span>
        }
      </div>
    </div>
  )
}

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

export default function AttendancePage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<'attendance' | 'schedule'>('attendance')

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('attendance')}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 ${
            tab === 'attendance' ? 'text-blue-700 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >Điểm danh</button>
        <button
          onClick={() => setTab('schedule')}
          className={`px-4 py-2.5 text-sm font-medium transition border-b-2 ${
            tab === 'schedule' ? 'text-blue-700 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >Lịch dạy</button>
      </div>

      {tab === 'attendance' ? <AttendanceTab /> : <ScheduleTab />}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 1: Điểm danh — danh sách buổi theo ngày, click → điểm danh
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AttendanceTab() {
  const [date, setDate] = useState(toDateStr(new Date()))
  const [sessions, setSessions] = useState<Session[]>([])
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [records, setRecords] = useState<AttendanceItem[]>([])
  const [savingId, setSavingId] = useState<number | null>(null)
  const [editingTopic, setEditingTopic] = useState(false)

  // Load all sessions (for calendar dots)
  useEffect(() => {
    attendanceApi.getSessions().then(r => setAllSessions(r.data))
  }, [])

  useEffect(() => { loadDay() }, [date])

  const loadDay = async () => {
    const monday = getMonday(new Date(date + 'T00:00'))
    const res = await attendanceApi.getByWeek(toDateStr(monday))
    const daySessions = (res.data as Session[]).filter(s => s.sessionDate.slice(0, 10) === date)
    setSessions(daySessions)
    setSelectedSession(null)
    setRecords([])
  }

  const sessionDates = new Set(allSessions.map(s => s.sessionDate.slice(0, 10)))

  const openAttendance = async (session: Session) => {
    setSelectedSession(session)
    setEditingTopic(false)
    const res = await attendanceApi.getForSession(session.id)
    setRecords(res.data)
  }

  const setStatus = (studentId: number, status: string) => {
    setRecords(r => r.map(x =>
      x.studentId === studentId ? { ...x, status, reason: status === 'Present' ? '' : x.reason } : x
    ))
    autoSave(studentId, status)
  }

  const autoSave = async (changedId: number, changedStatus: string) => {
    if (!selectedSession) return
    setSavingId(changedId)
    const current = records.map(r =>
      r.studentId === changedId ? { ...r, status: changedStatus, reason: changedStatus === 'Present' ? '' : r.reason } : r
    )
    await attendanceApi.save(selectedSession.id, current)
    setSavingId(null)
  }

  const saveReason = async (studentId: number, reason: string) => {
    if (!selectedSession) return
    setRecords(r => r.map(x => x.studentId === studentId ? { ...x, reason } : x))
    setSavingId(studentId)
    const current = records.map(r => r.studentId === studentId ? { ...r, reason } : r)
    await attendanceApi.save(selectedSession.id, current)
    setSavingId(null)
  }

  const handleSaveTopic = async (topic: string) => {
    if (!selectedSession) return
    await attendanceApi.updateTopic(selectedSession.id, topic)
    setSelectedSession(prev => prev ? { ...prev, topic } : null)
    setSessions(ss => ss.map(s => s.id === selectedSession.id ? { ...s, topic } : s))
    setEditingTopic(false)
  }

  const statusColor = (s: string) =>
    s === 'Present' ? 'bg-green-100 text-green-700' :
    s === 'Absent'  ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-700'
  const statusLabel = (s: string) =>
    s === 'Present' ? 'Có mặt' : s === 'Absent' ? 'Vắng' : 'Có phép'

  const displayDate = new Date(date + 'T00:00')

  return (
    <div className="flex gap-4">
      {/* Mini Calendar sidebar */}
      <div className="flex-shrink-0">
        <MiniCalendar selectedDate={date} onSelect={setDate} sessionDates={sessionDates} />
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-4">
        {/* Date header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setDate(toDateStr(addDays(displayDate, -1)))} className="text-gray-400 hover:text-gray-700 text-lg">◀</button>
          <h3 className="text-lg font-semibold text-gray-800">
            {displayDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </h3>
          <button onClick={() => setDate(toDateStr(addDays(displayDate, 1)))} className="text-gray-400 hover:text-gray-700 text-lg">▶</button>
          <button onClick={() => setDate(toDateStr(new Date()))} className="text-red-600 hover:text-red-800 text-sm ml-1">Hôm nay</button>
          <span className="text-sm text-gray-400 ml-auto">{sessions.length} buổi học</span>
        </div>

        {/* Session list */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            Không có buổi học nào trong ngày này
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => openAttendance(s)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition hover:shadow-md ${
                selectedSession?.id === s.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {s.className} {s.subject}
                </span>
                <span className="text-xs text-gray-400">{s.room} · {s.timeSlot}{s.totalSessions ? ` · Buổi ${s.sessionIndex}/${s.totalSessions}` : ''}</span>
              </div>
              {s.teacherName && <p className="text-sm text-gray-600">GV: {s.teacherName}</p>}
              {s.topic && <p className="text-xs text-gray-400 mt-1 truncate">{s.topic}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Attendance panel */}
      {selectedSession && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {selectedSession.className} {selectedSession.subject}
                </span>
                <span className="text-xs text-gray-500">
                  {selectedSession.room} · {selectedSession.timeSlot}
                </span>
              </div>
              {selectedSession.teacherName && (
                <p className="text-sm text-gray-500">GV: {selectedSession.teacherName}</p>
              )}
              <div className="mt-2">
                <span className="text-xs text-gray-400">Nội dung buổi dạy: </span>
                {editingTopic ? (
                  <input
                    autoFocus
                    defaultValue={selectedSession.topic}
                    onBlur={e => handleSaveTopic(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTopic((e.target as HTMLInputElement).value) }}
                    className="border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-64"
                  />
                ) : (
                  <span onClick={() => setEditingTopic(true)} className="text-sm text-gray-700 cursor-pointer hover:text-blue-600">
                    {selectedSession.topic || '(click để nhập)'}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => { setSelectedSession(null); setRecords([]) }} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Học sinh</th>
                <th className="px-4 py-2 text-left">Trạng thái</th>
                <th className="px-4 py-2 text-left">Lý do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map(r => (
                <tr key={r.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{r.studentName}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      {['Present', 'Absent', 'Excused'].map(s => (
                        <button
                          key={s}
                          onClick={() => setStatus(r.studentId, s)}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                            r.status === s ? statusColor(s) : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >{statusLabel(s)}</button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {r.status !== 'Present' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Nhập lý do..."
                          defaultValue={r.reason}
                          onBlur={e => { if (e.target.value !== r.reason) saveReason(r.studentId, e.target.value) }}
                          onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; if (v !== r.reason) saveReason(r.studentId, v) } }}
                          className="flex-1 border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        {savingId === r.studentId && <span className="text-green-500 text-xs">✓</span>}
                      </div>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Lớp này chưa có học sinh</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 2: Lịch dạy — Calendar tuần, admin tạo/xóa, GV xem
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ScheduleTab() {
  const { isAdmin } = useAuth()
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [sessions, setSessions] = useState<Session[]>([])
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ classId: '' as string | number, room: '', timeSlot: '', date: '', topic: '', notes: '' })
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    classesApi.getAll().then(r => setClasses(r.data))
    attendanceApi.getSessions().then(r => setAllSessions(r.data))
  }, [])
  useEffect(() => { loadWeek() }, [weekStart])

  const sessionDates = new Set(allSessions.map(s => s.sessionDate.slice(0, 10)))

  const loadWeek = async () => {
    const res = await attendanceApi.getByWeek(toDateStr(weekStart))
    setSessions(res.data)
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = addDays(weekStart, 6)

  const getSession = (date: Date, room: string, slot: string) =>
    sessions.find(s => s.sessionDate.slice(0, 10) === toDateStr(date) && s.room === room && s.timeSlot === slot)

  const openCreate = (date: Date, room: string, slot: string) => {
    if (!isAdmin) return
    setCreateForm({ classId: '', room, timeSlot: slot, date: toDateStr(date), topic: '', notes: '' })
    setCreateError('')
    setShowCreate(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    try {
      await attendanceApi.createSession({
        classId: Number(createForm.classId),
        sessionDate: createForm.date,
        room: createForm.room,
        timeSlot: createForm.timeSlot,
        topic: createForm.topic,
        notes: createForm.notes,
      })
      setShowCreate(false)
      loadWeek()
    } catch (err: any) {
      setCreateError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    }
  }

  const handleDelete = async (session: Session) => {
    if (!confirm(`Xóa buổi: ${session.className} ${session.subject} - ${session.room} ${session.timeSlot}?`)) return
    await attendanceApi.deleteSession(session.id)
    loadWeek()
  }

  const handleCalendarSelect = (ds: string) => {
    setWeekStart(getMonday(new Date(ds + 'T00:00')))
  }

  return (
    <div className="flex gap-4">
      {/* Mini Calendar sidebar */}
      <div className="flex-shrink-0">
        <MiniCalendar selectedDate={toDateStr(weekStart)} onSelect={handleCalendarSelect} sessionDates={sessionDates} mode="week" />
      </div>

      <div className="flex-1 space-y-4">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="text-gray-400 hover:text-gray-700 text-lg">◀</button>
        <h3 className="text-lg font-semibold text-gray-800">
          {weekStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} — {weekEnd.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </h3>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="text-gray-400 hover:text-gray-700 text-lg">▶</button>
        <button onClick={() => setWeekStart(getMonday(new Date()))} className="text-red-600 hover:text-red-800 text-sm ml-1">Tuần này</button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-left text-gray-500 w-24 border-r border-gray-100">Phòng / Ca</th>
              {weekDates.map((d, i) => {
                const isToday = toDateStr(d) === toDateStr(new Date())
                return (
                  <th key={i} className={`px-1 py-2 text-center border-r border-gray-100 ${isToday ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>
                    <div className="font-semibold">{DAY_LABELS[i]}</div>
                    <div className="text-[10px] font-normal">{d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROOMS.map(room => SLOTS.map((slot, si) => (
              <tr key={`${room}-${slot}`} className={si === 0 ? 'border-t-2 border-gray-200' : 'border-t border-gray-50'}>
                <td className="px-2 py-1 text-gray-500 border-r border-gray-100 whitespace-nowrap">
                  {si === 0 && <div className="font-semibold text-gray-700">{room}</div>}
                  <div>{slot}</div>
                </td>
                {weekDates.map((d, di) => {
                  const session = getSession(d, room, slot)
                  const isToday = toDateStr(d) === toDateStr(new Date())
                  return (
                    <td
                      key={di}
                      className={`px-1 py-1 border-r border-gray-100 h-14 align-top transition ${
                        isToday ? 'bg-blue-50/30' : ''
                      } ${session ? 'hover:bg-blue-50' : isAdmin ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                      onClick={() => !session && openCreate(d, room, slot)}
                    >
                      {session && (
                        <div className="relative group">
                          <div className="bg-red-100 text-red-800 rounded px-1 py-0.5 text-[11px] font-medium leading-tight">
                            {session.className} {session.subject}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate mt-0.5 px-0.5">
                            {session.teacherName}
                            {session.totalSessions && <span className="text-gray-400 ml-1">({session.sessionIndex}/{session.totalSessions})</span>}
                          </div>
                          {session.topic && <div className="text-[10px] text-gray-400 truncate px-0.5">{session.topic}</div>}
                          {isAdmin && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(session) }}
                              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-[10px] px-1"
                            >✕</button>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      {/* Create session modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-1">Tạo buổi học</h3>
            <p className="text-sm text-gray-400 mb-4">
              {createForm.room} · {createForm.timeSlot} · {new Date(createForm.date + 'T00:00').toLocaleDateString('vi-VN')}
            </p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lớp *</label>
                <select
                  required
                  value={createForm.classId}
                  onChange={e => setCreateForm(f => ({ ...f, classId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.subject} {c.teacherName ? `(${c.teacherName})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nội dung buổi dạy</label>
                <input
                  type="text"
                  value={createForm.topic}
                  onChange={e => setCreateForm(f => ({ ...f, topic: e.target.value }))}
                  placeholder="GV có thể tự nhập sau"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ghi chú</label>
                <input
                  type="text"
                  value={createForm.notes}
                  onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              {createError && <p className="text-red-500 text-sm">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition">Tạo</button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
