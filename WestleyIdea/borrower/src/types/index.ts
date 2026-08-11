export interface MortgageInput {
  submission_reference?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  consent_to_share?: boolean
  website?: string
  annual_income: number
  monthly_debts: number
  credit_score: number
  credit_range: '500-580' | '580-620' | '620-660' | '660+'
  available_savings?: number
  down_payment: number
  home_price: number
  employment_years: number
  income_source: 'employment' | 'schooling'
  school_program?: string
  graduation_date?: string
  school_gpa?: number
  expected_salary?: number
  loan_type: 'conventional' | 'fha' | 'va' | 'usda'
  state?: string
  county?: string
  va_usage?: 'first' | 'subsequent'
  va_funding_fee_exempt?: boolean
}

export interface AssessmentResponse {
  qualifies: boolean
  summary: string
  details: string[]
  action_steps: string[]
  estimated_monthly_payment: number | null
  dti_ratio: number
  ltv_ratio: number
  demo_mode: boolean
}

export interface ChecklistItem {
  task: string
  detail: string
  done?: boolean
}

export interface StepHelpResponse {
  title: string
  explanation: string
  checklist: ChecklistItem[]
  documents: string[]
  tips: string[]
  timeline: string
  demo_mode: boolean
}
