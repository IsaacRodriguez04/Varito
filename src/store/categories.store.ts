'use client'

import { create } from 'zustand'
import type { Category } from '@/types/app.types'

interface CategoriesState {
  categories: Category[]
  setCategories: (categories: Category[]) => void
  upsertCategory: (category: Category) => void
  removeCategory: (id: string) => void
}

export const useCategoriesStore = create<CategoriesState>((set) => ({
  categories: [],
  setCategories: (categories) => set({ categories }),
  upsertCategory: (category) =>
    set((state) => {
      const exists = state.categories.some((c) => c.id === category.id)
      return {
        categories: exists
          ? state.categories.map((c) => (c.id === category.id ? category : c))
          : [...state.categories, category],
      }
    }),
  removeCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    })),
}))
