import type { MortgageInput, AssessmentResponse } from '.'

export interface UserProfile {
  id: string
  name: string
  email: string
  createdAt: string      // ISO date string
  lastUpdated: string    // ISO date string
  stateCode: string
  mortgageInput: MortgageInput
  assessment: AssessmentResponse
  goals: {
    timeline: string
    firstHome: boolean
    workingWithAgent: boolean
    topConcern: string
  }
  stepProgress: boolean[]
}
