'use client'

import { create } from 'zustand'
import { currentYearMonth } from '@/lib/date-utils'

interface UIState {
  selectedMonth: string
  setSelectedMonth: (month: string) => void
  isMovementSheetOpen: boolean
  setMovementSheetOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedMonth: currentYearMonth(),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  isMovementSheetOpen: false,
  setMovementSheetOpen: (open) => set({ isMovementSheetOpen: open }),
}))
