import { useEffect, useMemo, useState } from 'react'

import { TrackedLinkContext } from '../types/branding'

type TrackingState =
  | { status: 'untracked' | 'loading'; link: null; message: null }
  | { status: 'ready'; link: TrackedLinkContext; message: null }
  | { status: 'not_found' | 'error'; link: null; message: string }

function pathSlug(): string | null {
  const raw = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (!raw) return null
  try {
    return decodeURIComponent(raw).toLowerCase()
  } catch {
    return null
  }
}

function apiSlug(slug: string): string {
  return slug.split('/').map(encodeURIComponent).join('/')
}

export function useTrackedLink(): TrackingState {
  const slug = useMemo(pathSlug, [])
  const [state, setState] = useState<TrackingState>(slug
    ? { status: 'loading', link: null, message: null }
    : { status: 'untracked', link: null, message: null })

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    const visitKey = `mortgageai_link_view:${slug}`
    const alreadyRecorded = sessionStorage.getItem(visitKey) === '1'

    fetch(`/api/public/links/${apiSlug(slug)}?record_visit=${alreadyRecorded ? 'false' : 'true'}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async response => {
        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            throw new Error('This borrower link is unavailable or has expired.')
          }
          throw new Error('We could not load this borrower link. Please try again.')
        }
        return response.json() as Promise<TrackedLinkContext>
      })
      .then(link => {
        sessionStorage.setItem(visitKey, '1')
        setState({ status: 'ready', link, message: null })
      })
      .catch(error => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'We could not load this borrower link.'
        setState({ status: message.includes('unavailable') ? 'not_found' : 'error', link: null, message })
      })

    return () => controller.abort()
  }, [slug])

  return state
}
