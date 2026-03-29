import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { importApi, classesApi } from '../api'

// ── Column aliases (khớp BE) ─────────────────────────────────────
const KNOWN_COLUMNS: Record<string, { aliases: string[]; label: string }> = {
  fullName:     { aliases: ['họ tên', 'họ tên *', 'họ và tên', 'tên học sinh', 'tên hs', 'fullname'], label: 'Họ tên' },
  address:      { aliases: ['địa chỉ', 'address'], label: 'Địa chỉ' },
  parentPhone:  { aliases: ['sđt phụ huynh', 'sđt ph', 'sđt', 'số điện thoại', 'phone', 'sdt'], label: 'SĐT phụ huynh' },
  dateOfBirth:  { aliases: ['ngày sinh', 'date of birth', 'dob'], label: 'Ngày sinh' },
  enrolledDate: { aliases: ['ngày nhập học', 'ngày đăng ký', 'ngày đăng kí', 'enrolled date'], label: 'Ngày nhập học' },
  notes:        { aliases: ['ghi chú', 'notes', 'ghi chu'], label: 'Ghi chú' },
}

function matchColumn(header: string): string | null {
  const n = header.trim().toLowerCase()
  for (const [field, def] of Object.entries(KNOWN_COLUMNS)) {
    if (def.aliases.some(a => a === n)) return field
  }
  return null
}

// ── Helpers ──────────────────────────────────────────────────────
function validatePhone(raw: string): { clean: string | null; invalid: string | null } {
  if (!raw) return { clean: null, invalid: null }
  const cleaned = raw.replace(/[\s.\-()]/g, '')
  let digits = cleaned.replace(/\D/g, '')
  if (digits.length !== cleaned.length || digits.length < 9)
    return { clean: null, invalid: raw }
  if (digits.length === 9 && digits[0] !== '0') digits = '0' + digits
  if (digits.length === 10 && digits[0] === '0') return { clean: digits, invalid: null }
  return { clean: null, invalid: raw }
}

function validateDate(raw: string): boolean {
  if (!raw) return true
  const patterns = [/^\d{1,2}\/\d{1,2}\/\d{2,4}$/, /^\d{1,2}-\d{1,2}-\d{2,4}$/, /^\d{4}-\d{1,2}-\d{1,2}$/]
  return patterns.some(p => p.test(raw.trim()))
}

function normalizeName(name: string): string {
  return name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

// ── Types ────────────────────────────────────────────────────────
interface ColumnMap { index: number; header: string; field: string | null }

interface PreviewRow {
  sourceRow: number
  fullName: string
  address: string
  parentPhone: string
  dateOfBirth: string
  enrolledDate: string
  notes: string
  warnings: string[]
}

interface DuplicateSuspect {
  row: number; name: string; phone: string; dateOfBirth: string | null
  existingId: number; existingName: string; existingPhone: string; existingDob: string | null
  matchType: string
}

interface ImportResult {
  created: number; skipped: number
  errors: { row: number; message: string }[]
  warnings?: { row: number; message: string }[]
  suspects?: DuplicateSuspect[]
}

interface ClassOption { id: number; name: string; subject: string; teacherName: string | null; startDate: string | null }

interface Props {
  mode: 'students' | 'class'
  classId?: number
  onClose: () => void
  onDone: () => void
}

export default function ImportModal({ mode, classId, onClose, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [columnMaps, setColumnMaps] = useState<ColumnMap[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)

  // Dedup decisions
  const [dupDecisions, setDupDecisions] = useState<Record<number, string>>({})
  const [pendingSuspects, setPendingSuspects] = useState<DuplicateSuspect[]>([])

  // Chọn lớp
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const selectedClass = classes.find(c => c.id === selectedClassId) ?? null

  useEffect(() => {
    if (mode === 'students') classesApi.getAll().then(res => setClasses(res.data))
  }, [mode])

  const resolvedClassId = mode === 'class' ? classId : (selectedClassId || undefined)

  // ── Parse file ──────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.xlsx')) { setError('Chỉ hỗ trợ file .xlsx'); return }
    setFile(f); setError(''); setResult(null); setPendingSuspects([]); setDupDecisions({})

    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const allRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null })

      // Find header row
      let headerRowIdx = -1
      const aliases = KNOWN_COLUMNS.fullName.aliases
      for (let r = 0; r < Math.min(allRows.length, 20); r++) {
        const row = allRows[r]
        if (!row) continue
        for (let c = 0; c < row.length; c++) {
          if (aliases.includes(String(row[c] ?? '').trim().toLowerCase())) { headerRowIdx = r; break }
        }
        if (headerRowIdx >= 0) break
      }

      if (headerRowIdx < 0) {
        setError('Không tìm thấy cột "Họ tên" trong file.')
        setPreview([]); setColumnMaps([]); return
      }

      // Map columns
      const headerRow = allRows[headerRowIdx]
      const maps: ColumnMap[] = []
      for (let c = 0; c < (headerRow?.length ?? 0); c++) {
        const h = String(headerRow![c] ?? '').trim()
        if (!h) continue
        maps.push({ index: c, header: h, field: matchColumn(h) })
      }
      setColumnMaps(maps)

      // Parse data
      const getField = (row: (string | number | null)[], field: string): string => {
        const m = maps.find(m => m.field === field)
        if (!m) return ''
        return String(row[m.index] ?? '').trim()
      }

      const parsed: PreviewRow[] = []
      for (let r = headerRowIdx + 1; r < allRows.length; r++) {
        const row = allRows[r]
        if (!row) continue
        const rawName = getField(row, 'fullName')
        if (!rawName) continue

        const fullName = normalizeName(rawName)
        const rawPhone = getField(row, 'parentPhone')
        const rawDob = getField(row, 'dateOfBirth')
        const rawEnrolled = getField(row, 'enrolledDate')
        const warnings: string[] = []

        if (rawPhone) {
          const p = validatePhone(rawPhone)
          if (p.invalid) warnings.push(`SĐT "${rawPhone}" -> ghi chú`)
        }
        if (rawDob && !validateDate(rawDob)) warnings.push(`Ngày sinh "${rawDob}" -> ghi chú`)
        if (rawEnrolled && !validateDate(rawEnrolled)) warnings.push(`Ngày nhập học "${rawEnrolled}" -> ghi chú`)

        parsed.push({
          sourceRow: r + 1, fullName, address: getField(row, 'address'),
          parentPhone: rawPhone, dateOfBirth: rawDob, enrolledDate: rawEnrolled,
          notes: getField(row, 'notes'), warnings,
        })
      }
      setPreview(parsed)
    }
    reader.readAsArrayBuffer(f)
  }

  // ── Import ──────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) return
    setLoading(true); setError('')
    try {
      if (resolvedClassId && startDate) {
        const cls = classes.find(c => c.id === resolvedClassId)
        if (cls) await classesApi.update(resolvedClassId as number, { name: cls.name, subject: cls.subject, teacherId: null, notes: '', startDate })
      }

      const decisions = Object.keys(dupDecisions).length > 0 ? dupDecisions : undefined
      const res = resolvedClassId
        ? await importApi.importToClass(resolvedClassId as number, file, decisions)
        : await importApi.importStudents(file, decisions)

      const data = res.data as ImportResult

      // Nếu có suspects → hiện UI cho user quyết định
      if (data.suspects && data.suspects.length > 0) {
        setPendingSuspects(data.suspects)
        // Pre-fill decisions = "ask" (chưa quyết)
        const newDec: Record<number, string> = { ...dupDecisions }
        data.suspects.forEach(s => { if (!(s.row in newDec)) newDec[s.row] = 'create' })
        setDupDecisions(newDec)
        setResult(data)
      } else {
        setResult(data)
        onDone()
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  // ── Re-import with decisions ────────────────────────────────────
  const handleReimportWithDecisions = async () => {
    if (!file) return
    setLoading(true); setError(''); setPendingSuspects([])
    try {
      const res = resolvedClassId
        ? await importApi.importToClass(resolvedClassId as number, file, dupDecisions)
        : await importApi.importStudents(file, dupDecisions)
      setResult(res.data)
      onDone()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  const validCount = preview.filter(r => r.fullName).length
  const warningCount = preview.filter(r => r.warnings.length > 0).length
  const missingPhoneCount = preview.filter(r => !r.parentPhone).length
  const mappedCols = columnMaps.filter(m => m.field !== null)
  const ignoredCols = columnMaps.filter(m => m.field === null)

  const matchTypeLabel = (t: string) => {
    if (t === 'name_phone') return 'Trùng tên + SĐT'
    if (t === 'name_dob') return 'Trùng tên + ngày sinh'
    if (t === 'name_only') return 'Trùng tên (thiếu SĐT & ngày sinh)'
    return t
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Import học sinh</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* ── Dedup decision UI ─────────────────────────────────── */}
        {pendingSuspects.length > 0 && (
          <div className="flex-1 overflow-auto">
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="font-medium text-amber-800 text-sm mb-1">Phát hiện {pendingSuspects.length} học sinh nghi trùng</p>
              <p className="text-xs text-amber-600">Vui lòng chọn hành động cho mỗi học sinh:</p>
            </div>

            {result && result.created > 0 && (
              <p className="text-sm text-green-600 mb-3">&#10003; Đã tạo {result.created} học sinh mới{result.skipped > 0 ? `, bỏ qua ${result.skipped} trùng chính xác` : ''}</p>
            )}

            <div className="space-y-3 mb-4">
              {pendingSuspects.map(s => (
                <div key={s.row} className="border border-amber-200 rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-gray-800">
                        Row {s.row}: <span className="text-amber-700">{s.name}</span>
                        {s.phone && <span className="text-gray-400 ml-2">{s.phone}</span>}
                        {s.dateOfBirth && <span className="text-gray-400 ml-2">{s.dateOfBirth}</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {matchTypeLabel(s.matchType)} với HS #{s.existingId}: <strong>{s.existingName}</strong>
                        {s.existingPhone && <span className="ml-1">({s.existingPhone})</span>}
                        {s.existingDob && <span className="ml-1">- {s.existingDob}</span>}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setDupDecisions(d => ({ ...d, [s.row]: 'create' }))}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          dupDecisions[s.row] === 'create'
                            ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                        }`}
                      >Tạo mới</button>
                      <button
                        onClick={() => setDupDecisions(d => ({ ...d, [s.row]: 'skip' }))}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          dupDecisions[s.row] === 'skip'
                            ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                        }`}
                      >Bỏ qua</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={handleReimportWithDecisions} disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50">
                {loading ? 'Đang xử lý...' : 'Xác nhận & Import'}
              </button>
              <button onClick={() => { setPendingSuspects([]); setResult(null) }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
                Quay lại
              </button>
            </div>
          </div>
        )}

        {/* ── Main flow (no suspects pending) ──────────────────── */}
        {pendingSuspects.length === 0 && !result && (
          <>
            {/* Bước 1: Chọn lớp */}
            {mode === 'students' && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bước 1 — Chọn lớp (tuỳ chọn)</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lớp</label>
                  <select value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="">— Không gán vào lớp —</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.subject}{c.teacherName ? ` (${c.teacherName})` : ''}</option>
                    ))}
                  </select>
                </div>
                {selectedClass && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Môn học</label>
                      <div className="border border-gray-100 rounded-lg px-3 py-2 text-sm bg-white text-gray-600">{selectedClass.subject}</div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Giáo viên</label>
                      <div className="border border-gray-100 rounded-lg px-3 py-2 text-sm bg-white text-gray-600">
                        {selectedClass.teacherName ?? <span className="text-gray-300 italic">Chưa có GV</span>}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Ngày khai giảng</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bước 2: Chọn file */}
            <div className="mb-4">
              {mode === 'students' && <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Bước 2 — Chọn file Excel</p>}
              <div className="flex items-center gap-3">
                <button onClick={() => fileRef.current?.click()}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Chọn file .xlsx</button>
                <button onClick={() => setShowTemplate(v => !v)}
                  className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                  {showTemplate ? 'Ẩn file mẫu' : 'Xem file mẫu'}
                </button>
                {file && <span className="text-sm text-gray-500 truncate max-w-xs">{file.name}</span>}
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
              </div>
            </div>

            {showTemplate && (
              <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                  File mẫu — chỉ cần cột "Họ tên", các cột khác tuỳ chọn. Có thể dùng file export để import lại.
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-green-50 text-green-800">
                    <tr>
                      {['Họ tên *', 'Địa chỉ', 'SĐT phụ huynh', 'Ngày sinh', 'Ngày nhập học', 'Ghi chú'].map(h => (
                        <th key={h} className="px-3 py-2 text-left border-r border-green-100 last:border-r-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-600">
                    <tr>
                      <td className="px-3 py-1.5 border-r border-gray-100">Nguyễn Văn A</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">123 Trần Hưng Đạo, Q.1</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">0901234567</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">15/06/2010</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">01/09/2024</td>
                      <td className="px-3 py-1.5"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            {/* Column mapping */}
            {columnMaps.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg text-xs space-y-1">
                <p className="font-medium text-blue-800">Nhận diện cột:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {mappedCols.map(m => (
                    <span key={m.index} className="text-blue-700">
                      <span className="text-green-600 font-medium">&#10003;</span> {m.header} &rarr; {KNOWN_COLUMNS[m.field!].label}
                    </span>
                  ))}
                  {ignoredCols.map(m => (
                    <span key={m.index} className="text-gray-400">
                      <span className="text-amber-500">&#9888;</span> {m.header} &rarr; bỏ qua
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <>
                <div className="flex flex-wrap gap-4 mb-3 text-sm">
                  <span className="text-green-600 font-medium">&#10003; {validCount} học sinh</span>
                  {warningCount > 0 && <span className="text-amber-600 font-medium">&#9888; {warningCount} có dữ liệu cần xử lý</span>}
                  {missingPhoneCount > 0 && <span className="text-gray-400">{missingPhoneCount} chưa có SĐT</span>}
                </div>

                <div className="flex-1 overflow-auto border border-gray-100 rounded-lg mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Row</th>
                        <th className="px-3 py-2 text-left">Họ tên</th>
                        <th className="px-3 py-2 text-left">Địa chỉ</th>
                        <th className="px-3 py-2 text-left">SĐT PH</th>
                        <th className="px-3 py-2 text-left">Ngày sinh</th>
                        <th className="px-3 py-2 text-left">Nhập học</th>
                        <th className="px-3 py-2 text-left">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {preview.map((row, i) => (
                        <tr key={i} className={row.warnings.length > 0 ? 'bg-amber-50' : ''}>
                          <td className="px-3 py-1.5 text-gray-400">{row.sourceRow}</td>
                          <td className="px-3 py-1.5 font-medium">{row.fullName}</td>
                          <td className="px-3 py-1.5 text-gray-500">{row.address || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {row.parentPhone ? (
                              validatePhone(row.parentPhone).invalid
                                ? <span className="text-amber-600">{row.parentPhone} &#9888;</span>
                                : <span>{validatePhone(row.parentPhone).clean || row.parentPhone}</span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {row.dateOfBirth ? (
                              !validateDate(row.dateOfBirth)
                                ? <span className="text-amber-600">{row.dateOfBirth} &#9888;</span>
                                : row.dateOfBirth
                            ) : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">{row.enrolledDate || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-400">{row.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {warningCount > 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 space-y-1">
                    <p className="font-medium">Dữ liệu không hợp lệ sẽ tự động chuyển sang ghi chú:</p>
                    {preview.filter(r => r.warnings.length > 0).slice(0, 10).map((r, i) => (
                      <p key={i}>Row {r.sourceRow}: {r.warnings.join('; ')}</p>
                    ))}
                    {warningCount > 10 && <p className="text-amber-500">... và {warningCount - 10} dòng khác</p>}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={handleImport} disabled={loading || validCount === 0}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50">
                    {loading ? 'Đang import...' : `Import ${validCount} học sinh${resolvedClassId ? ' vào lớp' : ''}`}
                  </button>
                  <button onClick={onClose}
                    className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">Hủy</button>
                </div>
              </>
            )}

            {preview.length === 0 && !file && (
              <p className="text-sm text-gray-400 text-center py-8">Chọn file Excel để xem trước dữ liệu</p>
            )}
          </>
        )}

        {/* ── Result (no suspects) ─────────────────────────────── */}
        {pendingSuspects.length === 0 && result && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
            <div className="text-5xl">{result.created > 0 ? '\u2705' : '\u26A0\uFE0F'}</div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-gray-800">Import hoàn tất</p>
              <p className="text-green-600 text-sm">&#10003; Tạo mới: <strong>{result.created}</strong> học sinh</p>
              {result.skipped > 0 && <p className="text-gray-400 text-sm">&#8631; Bỏ qua (trùng): <strong>{result.skipped}</strong></p>}
              {(result.warnings?.length ?? 0) > 0 && (
                <p className="text-amber-600 text-sm">&#9888; {result.warnings!.length} giá trị không hợp lệ đã chuyển sang ghi chú</p>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2 text-left bg-red-50 rounded-lg p-3 text-xs text-red-600 space-y-1">
                  {result.errors.map((e, i) => <p key={i}>Hàng {e.row}: {e.message}</p>)}
                </div>
              )}
            </div>
            <button onClick={onClose}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition">Đóng</button>
          </div>
        )}
      </div>
    </div>
  )
}
