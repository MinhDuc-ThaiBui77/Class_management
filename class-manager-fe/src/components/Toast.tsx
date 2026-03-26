import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'warning'

interface Toast {
  id: number
  type: ToastType
  message: string
  removing?: boolean
}

interface ToastContextType {
  toast: (type: ToastType, message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 200)
    }, type === 'error' ? 5000 : 3000)
  }, [])

  const ctx: ToastContextType = {
    toast: addToast,
    success: msg => addToast('success', msg),
    error: msg => addToast('error', msg),
    warning: msg => addToast('warning', msg),
  }

  const icons: Record<ToastType, string> = { success: '✓', error: '✕', warning: '!' }
  const colors: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  }
  const iconBg: Record<ToastType, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-4 px-8 py-5 rounded-2xl border-2 shadow-2xl backdrop-blur-sm ${colors[t.type]} ${t.removing ? 'animate-toast-out' : 'animate-toast-in'}`}
          >
            <span className={`w-9 h-9 rounded-full ${iconBg[t.type]} text-white text-lg flex items-center justify-center font-bold flex-shrink-0`}>
              {icons[t.type]}
            </span>
            <span className="text-base font-semibold">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
