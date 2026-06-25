import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfile } from '../lib/db'
import { recomputeTaste } from '../lib/librarian'
import { reportError, installGlobalErrorReporting, setErrorUserProvider } from '../lib/errorLog'
import type { Profile } from '../types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /**
   * Debounced, fire-and-forget request to recompute the taste profile (portrait +
   * axes). Call after any change that affects taste — a book added/rated/removed, or
   * a chat turn. Rapid bursts coalesce into one server call, and the edge function
   * no-ops cheaply when nothing actually changed, so it's safe to call liberally.
   */
  scheduleTasteRefresh: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Latest user id for the error reporter (reads a ref so the getter never goes stale).
  const userIdRef = useRef<string | null>(null)

  async function fetchProfile(userId: string) {
    try {
      setProfile(await getProfile(userId))
    } catch (err) {
      // Don't crash the auth gate on a profile read failure — log and treat as
      // no profile so the user lands on onboarding/login rather than a blank app.
      console.error('Failed to load profile', err)
      reportError('AuthContext.fetchProfile', err)
      setProfile(null)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  // Debounce timer for taste recomputes. A burst of mutations (e.g. a bulk import
  // adding many books) collapses into a single recompute once the burst settles.
  const tasteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleTasteRefresh() {
    if (tasteTimer.current) clearTimeout(tasteTimer.current)
    tasteTimer.current = setTimeout(() => {
      tasteTimer.current = null
      recomputeTaste()
        .then(({ taste_summary, taste_axes }) => {
          // Merge the freshly computed fields into the in-context profile so the
          // Taste tab and chat see them without an extra round-trip.
          setProfile((prev) => (prev ? { ...prev, taste_summary, taste_axes } : prev))
        })
        .catch((err) => {
          // Non-fatal: the app works without an up-to-date taste profile, and the
          // Taste tab will retry on its next visit.
          console.error('Taste refresh failed', err)
          reportError('AuthContext.scheduleTasteRefresh', err)
        })
    }, 4000)
  }

  useEffect(() => {
    // Route unhandled errors into app_errors, attributed to the current user.
    setErrorUserProvider(() => userIdRef.current)
    installGlobalErrorReporting()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      userIdRef.current = session?.user?.id ?? null
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      userIdRef.current = session?.user?.id ?? null
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile, scheduleTasteRefresh }}>
      {children}
    </AuthContext.Provider>
  )
}

// Co-located with the provider on purpose: the component tests mock this whole module
// (`vi.mock('../contexts/AuthContext')`) to supply `useAuth`, so splitting it into its
// own file to satisfy react-refresh would break every mock for no runtime benefit.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
