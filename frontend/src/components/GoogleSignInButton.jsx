import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Google Identity Services button wrapper.
//
// Renders the official Google Sign-In button (GIS "ID token" flow) into
// a ref'd div, hands the resulting ID token back to the caller, and
// surfaces its own loading / missing-config / error states so the caller
// page does not have to care about GSI lifecycle.
//
// Configuration: reads the OAuth 2.0 Web client id from
// `VITE_GOOGLE_CLIENT_ID` at build time. When the variable is unset we
// render a small explanatory notice instead of the button so developers
// who haven't wired up Google Cloud yet still see a clean Login page.
//
// Props:
//   onCredential(credential: string): called with the raw Google ID
//     token after a successful sign-in. The caller should POST it to
//     `/api/auth/google` and persist the backend-issued session token.
//   onError?(err: Error | string): optional error callback.
//   disabled?: boolean — hides the button while a parent-level async
//     action (e.g. our /api/auth/google round trip) is in flight.
export default function GoogleSignInButton({ onCredential, onError, disabled }) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef(null)
  // `ready` goes true once the GIS <script> has loaded AND we have
  // rendered the button into our container.
  const [ready, setReady] = useState(false)

  // Vite exposes env vars on `import.meta.env`. We fall back to the
  // deprecated `window.GOOGLE_CLIENT_ID` so ops can inject the value at
  // runtime (e.g. via a tiny pre-bundle script) without rebuilding.
  const clientId =
    (import.meta && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) ||
    (typeof window !== 'undefined' && window.GOOGLE_CLIENT_ID) ||
    ''

  useEffect(() => {
    if (!clientId) return
    if (!containerRef.current) return

    // `google.accounts.id` shows up asynchronously when the GSI script
    // loaded in index.html finishes downloading. Poll briefly rather
    // than race it.
    let cancelled = false
    let attempts = 0
    const init = () => {
      if (cancelled) return
      const google = typeof window !== 'undefined' ? window.google : null
      if (!google || !google.accounts || !google.accounts.id) {
        attempts += 1
        if (attempts > 40) {
          // ~4s — GSI should have loaded by now.
          if (onError) onError(new Error('Google Identity Services failed to load.'))
          return
        }
        setTimeout(init, 100)
        return
      }

      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response && response.credential) {
              onCredential(response.credential)
            } else if (onError) {
              onError(new Error('Google sign-in returned no credential.'))
            }
          },
          // `popup` avoids full-page redirects so the SPA state is
          // preserved across the sign-in round trip.
          ux_mode: 'popup',
          // Do NOT auto-select on subsequent visits — we want an explicit
          // user gesture each time so it composes with the existing
          // password login UX.
          auto_select: false,
        })

        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left',
          // Use the current i18n locale so the button reads naturally in
          // Chinese when the user has switched language. `en` / `zh_CN`
          // are the two values we care about here.
          locale: i18n.language && i18n.language.startsWith('zh') ? 'zh_CN' : 'en',
          width: 320,
        })

        setReady(true)
      } catch (initErr) {
        if (onError) onError(initErr)
      }
    }

    init()

    return () => {
      cancelled = true
    }
    // `onCredential` / `onError` are intentionally omitted — callers
    // should keep them stable. Re-running the effect on every render
    // would re-render the Google button and reset its click state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, i18n.language])

  if (!clientId) {
    // Dev / misconfigured state. Keep the message low-key; production
    // deployments must set VITE_GOOGLE_CLIENT_ID at build time.
    return (
      <div
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          padding: '10px 14px',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center',
          background: 'var(--bg)',
        }}
      >
        {t('auth.googleNotConfigured')}
      </div>
    )
  }

  return (
    <div
      // Let the parent layout control width; the Google button renders
      // with a fixed width set above.
      style={{
        display: 'flex',
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        minHeight: 44,
      }}
    >
      <div ref={containerRef} />
      {!ready && (
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            alignSelf: 'center',
          }}
        >
          {t('common.loading')}
        </span>
      )}
    </div>
  )
}
