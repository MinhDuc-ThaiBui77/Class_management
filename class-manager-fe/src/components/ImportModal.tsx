import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { importApi, classesApi } from '../api'

interface PreviewRow {
  fullName: string
  address: string
  parentPhone: string
  dateOfBirth: string
  notes: string
  error?: string
}

interface ImportResult {
  created: number
  skipped: number
  errors: { row: number; message: string }[]
}

interface ClassOption {
  id: number
  name: string
  subject: string
  teacherName: string | null
  startDate: string | null
}

interface Props {
  mode: 'students' | 'class'
  classId?: number
  onClose: () => void
  onDone: () => void
}

export default function ImportModal({ mode, classId, onClose, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState<PreviewRow[]>([])
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Bước chọn lớp (chỉ dành cho mode='students')
  const [classes, setClasses]           = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('')
  const [startDate, setStartDate]       = useState('')

  const selectedClass = classes.find(c => c.id === selectedClassId) ?? null

  useEffect(() => {
    if (mode === 'students') {
      classesApi.getAll().then(res => setClasses(res.data))
    }
  }, [mode])

  // Xác định classId thực sự dùng để import
  const resolvedClassId = mode === 'class' ? classId : (selectedClassId || undefined)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.xlsx')) {
      setError('Chỉ hỗ trợ file .xlsx')
      return
    }
    setFile(f)
    setError('')
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb   = XLSX.read(data, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

      const parsed: PreviewRow[] = rows.slice(1).filter(r => r.some(c => c)).map(r => ({
        fullName:    r[0]?.toString().trim() ?? '',
        address:     r[1]?.toString().trim() ?? '',
        parentPhone: r[2]?.toString().trim() ?? '',
        dateOfBirth: r[3]?.toString().trim() ?? '',
        notes:       r[4]?.toString().trim() ?? '',
        error:       !r[0]?.toString().trim() ? 'Thiếu họ tên' : undefined,
      }))
      setPreview(parsed)
    }
    reader.readAsArrayBuffer(f)
  }

  const handleDownloadTemplate = async () => {
    const res = await importApi.downloadTemplate()
    const url = URL.createObjectURL(new Blob([res.data]))
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'template-hoc-sinh.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      // Nếu chọn lớp → cập nhật StartDate cho lớp rồi import+enroll
      if (resolvedClassId && startDate) {
        const cls = classes.find(c => c.id === resolvedClassId)
        if (cls) {
          await classesApi.update(resolvedClassId as number, {
            name: cls.name,
            subject: cls.subject,
            teacherId: null,
            notes: '',
            startDate,
          })
        }
      }

      const res = resolvedClassId
        ? await importApi.importToClass(resolvedClassId as number, file)
        : await importApi.importStudents(file)
      setResult(res.data)
      onDone()
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra.')
    } finally {
      setLoading(false)
    }
  }

  const validCount   = preview.filter(r => !r.error).length
  const invalidCount = preview.filter(r => r.error).length

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Import học sinh</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {!result && (
          <>
            {/* Bước 1: Chọn lớp (chỉ khi mode=students) */}
            {mode === 'students' && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bước 1 — Chọn lớp (tuỳ chọn)</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lớp</label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Không gán vào lớp —</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {selectedClass && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Môn học</label>
                      <div className="border border-gray-100 rounded-lg px-3 py-2 text-sm bg-white text-gray-600">
                        {selectedClass.subject}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Giáo viên</label>
                      <div className="border border-gray-100 rounded-lg px-3 py-2 text-sm bg-white text-gray-600">
                        {selectedClass.teacherName ?? <span className="text-gray-300 italic">Chưa có GV</span>}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Ngày khai giảng</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bước 2: Chọn file */}
            <div className="mb-4">
              {mode === 'students' && (
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Bước 2 — Chọn file Excel</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Chọn file .xlsx
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Tải file mẫu
                </button>
                {file && <span className="text-sm text-gray-500 truncate max-w-xs">{file.name}</span>}
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            {preview.length > 0 && (
              <>
                <div className="flex gap-4 mb-3 text-sm">
                  <span className="text-green-600 font-medium">✓ {validCount} hàng hợp lệ</span>
                  {invalidCount > 0 && (
                    <span className="text-red-500 font-medium">✗ {invalidCount} hàng lỗi</span>
                  )}
                </div>

                <div className="flex-1 overflow-auto border border-gray-100 rounded-lg mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Họ tên</th>
                        <th className="px-3 py-2 text-left">Địa chỉ</th>
                        <th className="px-3 py-2 text-left">SĐT PH</th>
                        <th className="px-3 py-2 text-left">Ngày sinh</th>
                        <th className="px-3 py-2 text-left">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {preview.map((row, i) => (
                        <tr key={i} className={row.error ? 'bg-red-50' : ''}>
                          <td className="px-3 py-1.5 text-gray-400">{i + 2}</td>
                          <td className="px-3 py-1.5">
                            {row.fullName || <span className="text-red-400 italic">Trống</span>}
                            {row.error && <span className="ml-1 text-red-400">— {row.error}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">{row.address || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500">{row.parentPhone || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500">{row.dateOfBirth || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500 max-w-[150px] truncate">{row.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={loading || validCount === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
                  >
                    {loading ? 'Đang import...' : `Import ${validCount} học sinh${resolvedClassId ? ' vào lớp' : ''}`}
                  </button>
                  <button onClick={onClose}
                    className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
                    Hủy
                  </button>
                </div>
              </>
            )}

            {preview.length === 0 && !file && (
              <p className="text-sm text-gray-400 text-center py-8">
                Chọn file Excel để xem trước dữ liệu
              </p>
            )}
          </>
        )}

        {/* Kết quả sau khi import */}
        {result && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
            <div className="text-5xl">{result.created > 0 ? '✅' : '⚠️'}</div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-gray-800">Import hoàn tất</p>
              <p className="text-green-600 text-sm">✓ Tạo mới: <strong>{result.created}</strong> học sinh</p>
              {result.skipped > 0 && (
                <p className="text-gray-400 text-sm">↷ Bỏ qua (trùng): <strong>{result.skipped}</strong></p>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2 text-left bg-red-50 rounded-lg p-3 text-xs text-red-600 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i}>Hàng {e.row}: {e.message}</p>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition">
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
