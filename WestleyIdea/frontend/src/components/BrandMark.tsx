import { Branding } from '../types/branding'

// Company logo + name, used in the app header, dashboard topbar, and loading
// screen. Falls back to the styled text mark when no logo is uploaded.
export default function BrandMark({ branding, size = 'md' }: { branding: Branding; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`brand-mark brand-mark--${size}`}>
      {branding.logoDataUrl && (
        <img className="brand-mark-logo" src={branding.logoDataUrl} alt={`${branding.companyName} logo`} />
      )}
      <span className="brand-mark-name">{branding.companyName}</span>
    </div>
  )
}
