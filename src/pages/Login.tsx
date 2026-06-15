import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
    // on success the browser redirects — no need to reset state
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2C5F2E" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
              <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h1 className="font-display text-5xl text-ink mb-2">Librarian</h1>
          <p className="text-muted text-sm">Your shared reading companion</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-border text-center">
            <p className="text-3xl mb-3">✉️</p>
            <h2 className="font-display text-xl text-ink mb-2">Check your inbox</h2>
            <p className="text-muted text-sm leading-relaxed">
              We sent a magic link to <strong className="text-ink">{email}</strong>. Click it to sign in — no password needed.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-border space-y-4">
            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 border border-border rounded-lg px-3 py-2.5 text-sm font-body font-medium text-ink hover:bg-parchment transition-colors disabled:opacity-50"
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Magic link */}
            <form onSubmit={handleSubmit}>
              <label className="block mb-1.5 text-sm font-body font-medium text-ink">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-body text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-forest-700 mb-4"
              />
              {error && (
                <p className="text-burgundy-700 text-xs mb-3 -mt-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || googleLoading || !email}
                className="w-full bg-forest-700 text-white py-2.5 rounded-lg text-sm font-body font-semibold hover:bg-forest-900 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send magic link'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
