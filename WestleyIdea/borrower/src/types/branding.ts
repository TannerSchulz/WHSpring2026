export interface Branding {
  companyName: string
  logoDataUrl: string | null        // uploaded logo (png/jpg/svg/webp/gif) as data URL
  officerName: string
  officerTitle: string
  officerPhotoDataUrl: string | null
  primaryColor: string              // hex, e.g. #6366f1
  accentColor: string               // hex, e.g. #8b5cf6
  phone: string
  email: string
  website: string
  nmlsId: string
}

export const DEFAULT_BRANDING: Branding = {
  companyName: 'MortgageAI',
  logoDataUrl: null,
  officerName: '',
  officerTitle: 'Loan Officer',
  officerPhotoDataUrl: null,
  primaryColor: '#6366f1',
  accentColor: '#8b5cf6',
  phone: '',
  email: '',
  website: '',
  nmlsId: '',
}
