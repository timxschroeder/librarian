import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
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
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-border">
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
              disabled={loading || !email}
              className="w-full bg-forest-700 text-white py-2.5 rounded-lg text-sm font-body font-semibold hover:bg-forest-900 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
