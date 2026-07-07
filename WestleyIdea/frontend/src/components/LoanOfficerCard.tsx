import { Branding } from '../types/branding'

// Compact contact card for the loan officer — shown wherever a client might
// want to reach out. Renders nothing until an officer name is set.
export default function LoanOfficerCard({ branding, compact }: { branding: Branding; compact?: boolean }) {
  const { officerName, officerTitle, officerPhotoDataUrl, phone, email, website, nmlsId, companyName } = branding
  if (!officerName) return null

  const initials = officerName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const siteHref = website ? (website.startsWith('http') ? website : `https://${website}`) : null

  return (
    <div className={`lo-card${compact ? ' compact' : ''}`}>
      {officerPhotoDataUrl
        ? <img className="lo-photo" src={officerPhotoDataUrl} alt={officerName} />
        : <div className="lo-photo lo-initials">{initials}</div>}
      <div className="lo-info">
        <div className="lo-name">{officerName}</div>
        <div className="lo-title">
          {officerTitle}{companyName ? ` · ${companyName}` : ''}
          {nmlsId && <span className="lo-nmls"> · NMLS #{nmlsId}</span>}
        </div>
        <div className="lo-contact">
          {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>📞 {phone}</a>}
          {email && <a href={`mailto:${email}`}>✉️ {email}</a>}
          {siteHref && <a href={siteHref} target="_blank" rel="noopener noreferrer">🌐 {website.replace(/^https?:\/\//, '')}</a>}
        </div>
      </div>
    </div>
  )
}
