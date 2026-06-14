import { useState } from 'react'
import { updateProfile } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveName() {
    if (!user || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await updateProfile(user.id, { name: name.trim() })
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save name', err)
      setError((err as { message?: string })?.message ?? 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4">
      <h1 className="font-display text-3xl text-ink mb-6">Settings</h1>

      <div className="space-y-4 md:max-w-xl">
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <h2 className="text-xs font-body font-semibold text-muted uppercase tracking-widest mb-4">Profile</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-forest-700 flex items-center justify-center text-white font-display text-lg flex-shrink-0">
              {(name || profile?.name || '?')[0]?.toUpperCase()}
            </div>
            <p className="text-sm text-muted">{user?.email}</p>
          </div>
          <label className="block text-xs font-body text-muted mb-1.5">Display name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-body text-ink focus:outline-none focus:ring-2 focus:ring-forest-700"
            />
            <button
              onClick={saveName}
              disabled={saving || !name.trim()}
              className="bg-forest-700 text-white px-4 py-2 rounded-lg text-sm font-body font-medium disabled:opacity-40 hover:bg-forest-900 transition-colors min-w-[56px]"
            >
              {saved ? '✓' : saving ? '...' : 'Save'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <h2 className="text-xs font-body font-semibold text-muted uppercase tracking-widest mb-2">AI Recommendations</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            Powered by Claude. The API key lives securely in Supabase — add it once and both of you can use it.
          </p>
          <div className="bg-parchment rounded-lg p-3 space-y-1">
            <p className="text-xs font-body font-medium text-ink">To enable recommendations:</p>
            <p className="text-xs text-muted">1. Open your Supabase project dashboard</p>
            <p className="text-xs text-muted">2. Go to Edge Functions → Secrets</p>
            <p className="text-xs text-muted">3. Add <code className="bg-white/70 px-1 rounded font-mono">ANTHROPIC_API_KEY</code></p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full py-3.5 rounded-2xl border border-border text-sm font-body font-medium text-burgundy-700 hover:bg-burgundy-100/40 transition-colors"
        >
          Sign out
        </button>

        <p className="text-center text-xs text-muted/60 pt-2">Librarian · Just for us</p>
      </div>
    </div>
  )
}
