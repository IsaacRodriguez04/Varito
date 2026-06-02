export type AccountType = 'credit' | 'debit' | 'cash'
export type MovementType = 'expense' | 'income' | 'saving' | 'transfer'
export type MSIOption = number

export interface Profile {
  id: string
  name: string
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  bank: string | null
  type: AccountType
  color: string
  is_active: boolean
  created_at: string
  credit_limit: number | null
  cut_day: number | null
  days_to_due: number | null
  initial_balance: number
}

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  is_system: boolean
  created_at: string
}

export interface Movement {
  id: string
  user_id: string
  date: string
  description: string
  type: MovementType
  category_id: string
  account_id: string | null
  destination_account_id: string | null
  amount: number
  installments: MSIOption
  is_recurring: boolean
  notes: string | null
  created_at: string
  category?: Category
  account?: Account
  destination_account?: Account
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  month: string
  amount: number
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  target_amount: number
  saved_amount: number
  target_date: string | null
  notes: string | null
  is_completed: boolean
  created_at: string
}

export interface Installment {
  id: string
  movement_id: string
  user_id: string
  installment_number: number
  due_date: string
  amount: number
  is_paid: boolean
  paid_at: string | null
  created_at: string
  movement?: Movement
}

export interface MonthlyPaymentSummary {
  account_id: string
  account_name: string
  account_color: string
  total: number
  installments: Installment[]
}

export interface DashboardData {
  month: string
  total_income: number
  total_expenses: number
  total_savings: number
  balance: number
  by_category: { category: Category; total: number }[]
  debt_by_account: { account: Account; pending: number }[]
  upcoming_payments: Installment[]
}

export interface MSIScheduleItem {
  installment_number: number
  due_date: string
  amount: number
}
