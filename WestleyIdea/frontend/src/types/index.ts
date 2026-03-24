export interface MortgageInput {
  annual_income: number
  monthly_debts: number
  credit_score: number
  down_payment: number
  home_price: number
  employment_years: number
  loan_type: 'conventional' | 'fha' | 'va' | 'usda'
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
