import MortgageCalculator from './MortgageCalculator'
import BrandMark from './BrandMark'
import LoanOfficerCard from './LoanOfficerCard'
import { MortgageInput } from '../types'
import type { Branding } from '../types/branding'
import { APP_VERSION } from '../version'

interface Props {
  lastProfile: MortgageInput
  onBack: () => void
  branding: Branding
  onCustomize?: () => void
}

export default function Dashboard({
  lastProfile,
  onBack,
  branding,
  onCustomize,
}: Props) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-topbar">
        <div className="dashboard-brand">
          <div className="brand-version-lockup">
            <BrandMark branding={branding} size="sm" />
            <span className="brand-version">Version {APP_VERSION}</span>
          </div>
        </div>
        <div className="dashboard-topbar-actions">
          {onCustomize && (
            <button className="brand-customize-btn" onClick={onCustomize}>⚙️ Customize</button>
          )}
          <button className="dashboard-start-over" onClick={onBack}>Start Over</button>
        </div>
      </div>

      {branding.officerName && (
        <div className="dashboard-lo-row">
          <LoanOfficerCard branding={branding} />
        </div>
      )}

      <div className="dashboard-content">
        <MortgageCalculator prefill={lastProfile} />
      </div>
    </div>
  )
}
