import { useState, useRef } from 'react'
import { Branding, DEFAULT_BRANDING } from '../types/branding'
import { ACCEPTED_IMAGE_TYPES, processImageFile } from '../lib/imageUpload'
import { isValidHex, normalizeHex } from '../lib/color'

interface Props {
  branding: Branding
  onSave: (b: Branding) => void
  onReset: () => void
  onClose: () => void
}

// Progressive US phone formatting: 8015550123 → (801) 555-0123
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const PRESET_THEMES: { name: string; primary: string; accent: string }[] = [
  { name: 'Indigo',   primary: '#6366f1', accent: '#8b5cf6' },
  { name: 'Navy',     primary: '#1d4ed8', accent: '#0ea5e9' },
  { name: 'Forest',   primary: '#047857', accent: '#65a30d' },
  { name: 'Crimson',  primary: '#be123c', accent: '#f97316' },
  { name: 'Slate',    primary: '#475569', accent: '#0891b2' },
  { name: 'Gold',     primary: '#b45309', accent: '#ca8a04' },
]

function ImageUpload({ label, hint, value, maxDim, previewClass, onChange }: {
  label: string; hint: string; value: string | null; maxDim: number
  previewClass: string; onChange: (dataUrl: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      onChange(await processImageFile(file, maxDim))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  return (
    <div className="brand-field">
      <label className="brand-label">{label}</label>
      <div
        className={`brand-dropzone${dragging ? ' dragging' : ''}${value ? ' has-image' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      >
        {value ? (
          <img src={value} alt={label} className={previewClass} />
        ) : (
          <div className="brand-dropzone-empty">
            <span className="brand-dropzone-icon">🖼️</span>
            <span>Click or drag an image here</span>
            <span className="brand-dropzone-hint">{hint}</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        style={{ display: 'none' }}
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
      {value && (
        <button className="brand-remove-btn" onClick={() => onChange(null)}>✕ Remove image</button>
      )}
      {error && <div className="brand-error">{error}</div>}
    </div>
  )
}

function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (hex: string) => void
}) {
  const [text, setText] = useState(value)
  const commit = (v: string) => {
    setText(v)
    if (isValidHex(v)) onChange(normalizeHex(v))
  }
  return (
    <div className="brand-field">
      <label className="brand-label">{label}</label>
      <div className="brand-color-row">
        <input
          type="color"
          className="brand-color-swatch"
          value={isValidHex(text) ? normalizeHex(text) : value}
          onChange={e => commit(e.target.value)}
        />
        <input
          className="brand-input brand-hex-input"
          type="text"
          value={text}
          placeholder="#1d4ed8"
          onChange={e => commit(e.target.value)}
          onBlur={() => { if (!isValidHex(text)) setText(value) }}
        />
      </div>
    </div>
  )
}

export default function BrandingSettings({ branding, onSave, onReset, onClose }: Props) {
  const [draft, setDraft] = useState<Branding>({ ...branding })
  const set = <K extends keyof Branding>(key: K, val: Branding[K]) =>
    setDraft(d => ({ ...d, [key]: val }))

  const handleSave = () => {
    onSave({ ...draft, companyName: draft.companyName.trim() || DEFAULT_BRANDING.companyName })
    onClose()
  }

  return (
    <div className="brand-overlay" onClick={onClose}>
      <div className="brand-modal" onClick={e => e.stopPropagation()}>
        <div className="brand-modal-header">
          <h2>Customize Your Branding</h2>
          <p>Make this tool yours — your clients will see your company, your face, and your colors.</p>
          <button className="brand-close" onClick={onClose}>✕</button>
        </div>

        <div className="brand-modal-body">
          <div className="brand-section">
            <div className="brand-section-title">🏢 Company</div>
            <div className="brand-field">
              <label className="brand-label">Company Name</label>
              <input
                className="brand-input"
                type="text"
                value={draft.companyName}
                placeholder="Wasatch Home Loans"
                onChange={e => set('companyName', e.target.value)}
              />
            </div>
            <ImageUpload
              label="Company Logo"
              hint="PNG, JPG, SVG, WebP, or GIF · transparent PNG or SVG looks best"
              value={draft.logoDataUrl}
              maxDim={600}
              previewClass="brand-logo-preview"
              onChange={v => set('logoDataUrl', v)}
            />
          </div>

          <div className="brand-section">
            <div className="brand-section-title">👤 Loan Officer</div>
            <div className="brand-two-col">
              <div className="brand-field">
                <label className="brand-label">Name</label>
                <input
                  className="brand-input"
                  type="text"
                  value={draft.officerName}
                  placeholder="Jane Smith"
                  onChange={e => set('officerName', e.target.value)}
                />
              </div>
              <div className="brand-field">
                <label className="brand-label">Title</label>
                <input
                  className="brand-input"
                  type="text"
                  value={draft.officerTitle}
                  placeholder="Senior Loan Officer"
                  onChange={e => set('officerTitle', e.target.value)}
                />
              </div>
            </div>
            <ImageUpload
              label="Photo / Headshot"
              hint="A square photo works best"
              value={draft.officerPhotoDataUrl}
              maxDim={400}
              previewClass="brand-photo-preview"
              onChange={v => set('officerPhotoDataUrl', v)}
            />
          </div>

          <div className="brand-section">
            <div className="brand-section-title">🎨 Brand Colors</div>
            <div className="brand-preset-row">
              {PRESET_THEMES.map(t => (
                <button
                  key={t.name}
                  className="brand-preset"
                  title={t.name}
                  onClick={() => setDraft(d => ({ ...d, primaryColor: t.primary, accentColor: t.accent }))}
                >
                  <span style={{ background: t.primary }} />
                  <span style={{ background: t.accent }} />
                  {t.name}
                </button>
              ))}
            </div>
            <div className="brand-two-col">
              <ColorField label="Primary Color" value={draft.primaryColor} onChange={v => set('primaryColor', v)} />
              <ColorField label="Accent Color" value={draft.accentColor} onChange={v => set('accentColor', v)} />
            </div>
            <div className="brand-color-preview" style={{ background: `linear-gradient(135deg, ${draft.primaryColor}, ${draft.accentColor})` }}>
              Buttons &amp; highlights will use these colors
            </div>
          </div>

          <div className="brand-section">
            <div className="brand-section-title">📞 Contact Information</div>
            <div className="brand-two-col">
              <div className="brand-field">
                <label className="brand-label">Phone</label>
                <input className="brand-input" type="tel" value={draft.phone} placeholder="(801) 555-0123"
                  onChange={e => set('phone', formatPhone(e.target.value))} />
              </div>
              <div className="brand-field">
                <label className="brand-label">Email</label>
                <input className="brand-input" type="email" value={draft.email} placeholder="jane@wasatchloans.com"
                  onChange={e => set('email', e.target.value)} />
              </div>
              <div className="brand-field">
                <label className="brand-label">Website</label>
                <input className="brand-input" type="text" value={draft.website} placeholder="wasatchloans.com"
                  onChange={e => set('website', e.target.value)} />
              </div>
              <div className="brand-field">
                <label className="brand-label">NMLS ID</label>
                <input className="brand-input" type="text" value={draft.nmlsId} placeholder="123456"
                  onChange={e => set('nmlsId', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="brand-modal-footer">
          <button className="brand-reset-btn" onClick={() => { onReset(); onClose() }}>
            Reset to Defaults
          </button>
          <div className="brand-footer-actions">
            <button className="brand-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="brand-save-btn" onClick={handleSave}>Save Branding</button>
          </div>
        </div>
      </div>
    </div>
  )
}
