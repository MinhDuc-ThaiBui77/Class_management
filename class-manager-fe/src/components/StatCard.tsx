interface Props {
  label: string
  value: string | number
  icon?: string
  color?: 'teal' | 'emerald' | 'red' | 'amber' | 'gray'
  subtitle?: string
}

const colors = {
  teal:    'bg-red-50 text-red-700 border-red-100',
  emerald: 'bg-amber-50 text-amber-700 border-amber-100',
  red:     'bg-red-50 text-red-700 border-red-100',
  amber:   'bg-amber-50 text-amber-700 border-amber-100',
  gray:    'bg-gray-50 text-gray-700 border-gray-100',
}

const iconBg = {
  teal:    'bg-red-100 text-red-600',
  emerald: 'bg-amber-100 text-amber-600',
  red:     'bg-red-100 text-red-600',
  amber:   'bg-amber-100 text-amber-600',
  gray:    'bg-gray-100 text-gray-600',
}

export default function StatCard({ label, value, icon, color = 'teal', subtitle }: Props) {
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-lg ${iconBg[color]} flex items-center justify-center text-sm`}>{icon}</span>
        )}
      </div>
      <p className="text-xl font-bold">{value}</p>
      {subtitle && <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>}
    </div>
  )
}
