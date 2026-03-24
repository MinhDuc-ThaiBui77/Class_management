interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

const variants = {
  danger: { btn: 'bg-red-600 hover:bg-red-700', icon: 'bg-red-100 text-red-600', iconChar: '!' },
  warning: { btn: 'bg-amber-600 hover:bg-amber-700', icon: 'bg-amber-100 text-amber-600', iconChar: '?' },
  info: { btn: 'bg-red-600 hover:bg-red-700', icon: 'bg-red-100 text-red-600', iconChar: 'i' },
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', variant = 'danger', onConfirm, onCancel }: Props) {
  const v = variants[variant]
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-10 h-10 rounded-full ${v.icon} flex items-center justify-center text-lg font-bold flex-shrink-0`}>
            {v.iconChar}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 ${v.btn} text-white rounded-xl py-2.5 text-sm font-medium transition`}
          >{confirmLabel}</button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-medium transition"
          >{cancelLabel}</button>
        </div>
      </div>
    </div>
  )
}
