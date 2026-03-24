export interface UserProfile {
  employmentStatus: string;
  employmentLength: string;
  annualIncome: string;
  hasCoBorrower: string;
  coBorrowerIncome: string;
  creditScore: string;
  downPayment: string;
  monthlyDebt: string;
  bankruptcyForeclosure: string;
  mortgageType: string;
  propertyUse: string;
  propertyType: string;
  state: string;
  firstTimeBuyer: string;
  timeline: string;
}

export interface KeyFactor {
  name: string;
  description: string;
  positive: boolean;
}

export interface AssessmentResult {
  eligibilityStatus: 'Excellent Fit' | 'Good Fit' | 'Moderate Fit' | 'Needs Work';
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  estimatedMonthlyPayment: number;
  currentRate: number;
  loanType: string;
  locationInsight: string;
  locationLearnMoreUrl: string;
  keyFactors: KeyFactor[];
  recommendations: string[];
  summary: string;
}

export type AppScreen = 'landing' | 'questions' | 'loading' | 'results';

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionConfig {
  id: keyof UserProfile;
  emoji: string;
  title: string;
  subtitle?: string;
  type: 'choice' | 'text';
  options?: QuestionOption[];
  placeholder?: string;
  prefix?: string;
  skipIf?: (profile: UserProfile) => boolean;
}
