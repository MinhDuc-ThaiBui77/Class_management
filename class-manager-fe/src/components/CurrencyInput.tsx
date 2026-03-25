import { useState, useEffect } from 'react'

interface Props {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  min?: number
  required?: boolean
}

function formatNumber(val: string | number): string {
  const num = typeof val === 'number' ? val : parseInt(String(val).replace(/\D/g, ''), 10)
  if (isNaN(num) || num === 0) return ''
  return num.toLocaleString('vi-VN')
}

function parseNumber(formatted: string): string {
  const digits = formatted.replace(/\D/g, '')
  return digits || ''
}

export default function CurrencyInput({ value, onChange, placeholder = '500.000', className = '', min, required }: Props) {
  const [display, setDisplay] = useState(() => formatNumber(value))

  useEffect(() => {
    setDisplay(formatNumber(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseNumber(e.target.value)
    setDisplay(raw ? parseInt(raw).toLocaleString('vi-VN') : '')
    onChange(raw)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={className || 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm'}
    />
  )
}
