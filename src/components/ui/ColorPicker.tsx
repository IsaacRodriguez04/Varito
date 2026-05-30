'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#64748b', '#94a3b8',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'h-8 w-8 rounded-full transition-transform active:scale-90',
            value === color && 'ring-2 ring-offset-2 ring-ring scale-110'
          )}
          style={{ backgroundColor: color }}
          aria-label={color}
        >
          {value === color && (
            <Check className="mx-auto h-4 w-4 text-white drop-shadow" strokeWidth={3} />
          )}
        </button>
      ))}
    </div>
  )
}
