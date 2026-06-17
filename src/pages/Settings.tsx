import { useState } from 'react'
import { updateProfile } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import Bertha from '../components/Bertha'

export default function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [goal, setGoal] = useState(profile?.reading_goal != null ? String(profile.reading_goal) : '')
  const [savingGoal, setSavingGoal] = useState(false)
  const [savedGoal, setSavedGoal] = useState(false)
  const [goalError, setGoalError] = useState<string | null>(null)

  const [kindleEmail, setKindleEmail] = useState(profile?.kindle_email ?? '')
  const [savingKindle, setSavingKindle] = useState(false)
  const [savedKindle, setSavedKindle] = useState(false)
  const [kindleError, setKindleError] = useState<string | null>(null)

  const [redoing, setRedoing] = useState(false)
  const [redoError, setRedoError] = useState<string | null>(null)

  // Clearing onboarded_at trips the App routing gate back to <Onboarding />.
  // Existing shelf books and genres are untouched until the flow is completed again.
  async function redoOnboarding() {
    if (!user) return
    setRedoing(true)
    setRedoError(null)
    try {
      await updateProfile(user.id, { onboarded_at: null })
      await refreshProfile()
    } catch (err) {
      console.error('Failed to restart onboarding', err)
      setRedoError((err as { message?: string })?.message ?? 'Could not restart. Try again.')
      setRedoing(false)
    }
  }

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

  async function saveGoal() {
    if (!user) return
    const trimmed = goal.trim()
    const n = trimmed === '' ? null : Number(trimmed)
    if (n != null && (!Number.isInteger(n) || n <= 0)) {
      setGoalError('Enter a whole number greater than 0.')
      return
    }
    setSavingGoal(true)
    setGoalError(null)
    try {
      await updateProfile(user.id, { reading_goal: n })
      await refreshProfile()
      setSavedGoal(true)
      setTimeout(() => setSavedGoal(false), 2000)
    } catch (err) {
      console.error('Failed to save reading goal', err)
      setGoalError((err as { message?: string })?.message ?? 'Could not save. Try again.')
    } finally {
      setSavingGoal(false)
    }
  }

  async function saveKindle() {
    if (!user) return
    setSavingKindle(true)
    setKindleError(null)
    try {
      await updateProfile(user.id, { kindle_email: kindleEmail.trim() || null })
      await refreshProfile()
      setSavedKindle(true)
      setTimeout(() => setSavedKindle(false), 2000)
    } catch (err) {
      console.error('Failed to save Kindle email', err)
      setKindleError((err as { message?: string })?.message ?? 'Could not save. Try again.')
    } finally {
      setSavingKindle(false)
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
              aria-label="Save display name"
              className="bg-forest-700 text-white px-4 py-2 rounded-lg text-sm font-body font-medium disabled:opacity-40 hover:bg-forest-900 transition-colors min-w-[56px]"
            >
              {saved ? '✓' : saving ? '...' : 'Save'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <h2 className="text-xs font-body font-semibold text-muted uppercase tracking-widest mb-4">Reading goal</h2>
          <p className="text-sm text-muted mb-3">
            Set how many books you want to read. Your shelf will track progress and celebrate when you hit it.
          </p>
          <label className="block text-xs font-body text-muted mb-1.5">Books to read</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
              placeholder="e.g. 24"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-body text-ink focus:outline-none focus:ring-2 focus:ring-forest-700"
            />
            <button
              onClick={saveGoal}
              disabled={savingGoal}
              aria-label="Save reading goal"
              className="bg-forest-700 text-white px-4 py-2 rounded-lg text-sm font-body font-medium disabled:opacity-40 hover:bg-forest-900 transition-colors min-w-[56px]"
            >
              {savedGoal ? '✓' : savingGoal ? '...' : 'Save'}
            </button>
          </div>
          {goalError && <p className="mt-2 text-sm text-red-600">{goalError}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <h2 className="text-xs font-body font-semibold text-muted uppercase tracking-widest mb-4">Kindle delivery</h2>
          <label className="block text-xs font-body text-muted mb-1.5">Your Kindle email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={kindleEmail}
              onChange={(e) => setKindleEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveKindle()}
              placeholder="you@kindle.com"
              className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm font-body text-ink focus:outline-none focus:ring-2 focus:ring-forest-700"
            />
            <button
              onClick={saveKindle}
              disabled={savingKindle}
              className="bg-forest-700 text-white px-4 py-2 rounded-lg text-sm font-body font-medium disabled:opacity-40 hover:bg-forest-900 transition-colors min-w-[56px]"
            >
              {savedKindle ? '✓' : savingKindle ? '...' : 'Save'}
            </button>
          </div>
          {kindleError && <p className="mt-2 text-sm text-red-600">{kindleError}</p>}
          <p className="mt-3 text-xs text-muted leading-relaxed">
            Find it under <span className="text-ink">Manage Your Content and Devices → Preferences → Personal Document Settings</span> on Amazon.
            You'll also need to add Librarian's sending address to your <span className="text-ink">Approved Personal Document Email List</span> there, or deliveries get rejected.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <h2 className="text-xs font-body font-semibold text-muted uppercase tracking-widest mb-4">Onboarding</h2>
          <button
            onClick={redoOnboarding}
            disabled={redoing}
            className="w-full py-2.5 rounded-lg border border-border text-sm font-body font-medium text-forest-700 hover:bg-forest-700/5 disabled:opacity-40 transition-colors"
          >
            {redoing ? 'Restarting…' : 'Redo onboarding'}
          </button>
          <p className="mt-3 text-xs text-muted leading-relaxed">
            Pick your genres and starter books again. Your existing shelf stays put.
          </p>
          {redoError && <p className="mt-2 text-sm text-red-600">{redoError}</p>}
        </div>

        <button
          onClick={signOut}
          className="w-full py-3.5 rounded-2xl border border-border text-sm font-body font-medium text-burgundy-700 hover:bg-burgundy-100/40 transition-colors"
        >
          Sign out
        </button>

        <div className="flex flex-col items-center gap-1.5 pt-4 text-muted/60">
          <Bertha expression="happy" size={40} />
          <p className="text-center text-xs">Librarian · Just for us</p>
        </div>
      </div>
    </div>
  )
}
