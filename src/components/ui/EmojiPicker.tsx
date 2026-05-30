'use client'

import { cn } from '@/lib/utils'

const EMOJIS = [
  '🍔','🍕','🥗','☕','🍺','🛒','🚗','🚌','⛽','✈️','🏠','💡',
  '🎬','🎮','🎵','📚','🏥','💊','👕','👟','💄','🏋️','🐶','🐱',
  '💼','💻','📱','🎁','💰','💳','🏦','🔄','💸','📦','🌟','❤️',
  '🏖️','🍽️','🎉','🛍️','🚿','🧹','🪴','⚽','🎸','🎨','🧘','🛵',
]

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto rounded-md border p-2">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors',
            value === emoji
              ? 'bg-primary/10 ring-2 ring-primary'
              : 'hover:bg-muted'
          )}
          aria-label={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
