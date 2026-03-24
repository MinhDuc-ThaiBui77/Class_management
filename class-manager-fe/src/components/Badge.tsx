interface Props {
  children: React.ReactNode
  color?: 'teal' | 'emerald' | 'red' | 'amber' | 'gray' | 'blue' | 'purple'
  size?: 'sm' | 'md'
}

const colorMap = {
  teal:    'bg-red-100 text-red-700',
  emerald: 'bg-amber-100 text-amber-700',
  red:     'bg-red-100 text-red-700',
  amber:   'bg-amber-100 text-amber-700',
  gray:    'bg-gray-100 text-gray-600',
  blue:    'bg-blue-100 text-blue-700',
  purple:  'bg-purple-100 text-purple-700',
}

const sizeMap = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
}

export default function Badge({ children, color = 'teal', size = 'sm' }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colorMap[color]} ${sizeMap[size]}`}>
      {children}
    </span>
  )
}
