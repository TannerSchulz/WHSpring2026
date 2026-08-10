import BrandMark from './BrandMark'
import { Branding } from '../types/branding'

export default function LoadingScreen({ branding }: { branding: Branding }) {
  return (
    <div className="loading-screen">
      <div className="ls-brand"><BrandMark branding={branding} size="md" /></div>

      {/* Orbiting ring */}
      <div className="ls-orbit-wrap">
        <div className="ls-orbit" />
        <div className="ls-orbit ls-orbit--2" />
        <div className="ls-core">
          <div className="ls-core-inner">🏠</div>
        </div>
        {/* Orbiting dots */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`ls-dot ls-dot--${i}`} />
        ))}
      </div>

      <h2 className="ls-title">Analyzing Your Profile</h2>
      <p className="ls-subtitle">Calculating your mortgage estimates…</p>
    </div>
  )
}
