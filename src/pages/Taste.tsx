import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUserBooks } from '../lib/db'
import { recomputeTasteProfile } from '../lib/librarian'
import type { TasteAxes, TasteAxis, UserBook } from '../types'

// Below this confidence an axis is shown as an unknown "gap" rather than a position.
const CONFIDENCE_GAP = 0.25

function shelfSignature(books: UserBook[]): string {
  const ratingSum = books.reduce((s, b) => s + (b.rating ?? 0), 0)
  return `${books.length}:${ratingSum}`
}

const SOURCE_SEGMENTS = [
  { key: 'language', label: 'Language', cls: 'bg-forest-700' },
  { key: 'ideas', label: 'Ideas', cls: 'bg-burgundy-700' },
  { key: 'character', label: 'Character', cls: 'bg-muted' },
  { key: 'story', label: 'Story', cls: 'bg-border' },
] as const

function CompositionBar({ source }: { source: TasteAxes['source_of_reward'] }) {
  return (
    <div>
      <div className="flex h-7 rounded-md overflow-hidden border border-border">
        {SOURCE_SEGMENTS.map(({ key, cls }) => (
          <div key={key} className={cls} style={{ width: `${Math.round(source[key] * 100)}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {SOURCE_SEGMENTS.map(({ key, label, cls }) => (
          <span key={key} className="flex items-center gap-1.5 text-sm text-ink">
            <span className={`w-2.5 h-2.5 rounded-sm ${cls} inline-block`} />
            {label} <span className="text-muted">{Math.round(source[key] * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function AxisRow({
  left,
  right,
  axis,
  accent,
}: {
  left: string
  right: string
  axis: TasteAxis
  accent: 'forest' | 'burgundy'
}) {
  const isGap = axis.confidence < CONFIDENCE_GAP
  const pct = ((axis.value + 1) / 2) * 100
  // The band widens as confidence drops — visible uncertainty around the marker.
  const bandPx = Math.round((1 - axis.confidence) * 70) + 16
  const dotCls = accent === 'forest' ? 'bg-forest-700' : 'bg-burgundy-700'
  const bandCls = accent === 'forest' ? 'bg-forest-700/15' : 'bg-burgundy-700/15'

  const leftEmph = !isGap && axis.value < 0
  const rightEmph = !isGap && axis.value > 0

  return (
    <div className="grid grid-cols-[84px_1fr_84px] items-center gap-3">
      <span className={`text-sm text-right ${leftEmph ? 'text-ink' : 'text-muted'} ${isGap ? 'opacity-50' : ''}`}>
        {left}
      </span>
      {isGap ? (
        <div className="relative h-2 rounded-full bg-parchment border border-dashed border-border">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cream border border-dashed border-muted text-muted text-[10px] flex items-center justify-center"
            aria-label="not enough signal yet"
          >
            ?
          </div>
        </div>
      ) : (
        <div className="relative h-2 rounded-full bg-border">
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 rounded-full ${bandCls}`}
            style={{ left: `${pct}%`, width: `${bandPx}px` }}
          />
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full ${dotCls} border-2 border-cream`}
            style={{ left: `${pct}%` }}
          />
        </div>
      )}
      <span className={`text-sm text-left ${rightEmph ? 'text-ink' : 'text-muted'} ${isGap ? 'opacity-50' : ''}`}>
        {right}
      </span>
    </div>
  )
}

export default function Taste() {
  const { user, profile, refreshProfile } = useAuth()
  const [axes, setAxes] = useState<TasteAxes | null>(profile?.taste_axes ?? null)
  const [bookCount, setBookCount] = useState<number | null>(null)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  const sync = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      const books = await getUserBooks(user.id)
      setBookCount(books.length)

      if (books.length === 0) {
        setAxes(null)
        return
      }

      const sig = shelfSignature(books)
      const cached = profile?.taste_axes ?? null
      if (cached) setAxes(cached)

      // Recompute when we have nothing cached, or the shelf changed since last time.
      if (!cached || cached.signature !== sig) {
        setComputing(true)
        const fresh = await recomputeTasteProfile()
        setAxes(fresh)
        await refreshProfile()
      }
    } catch (err) {
      console.error('Taste sync failed', err)
      setError('Could not load your taste profile. Please try again.')
    } finally {
      setComputing(false)
    }
  }, [user, profile, refreshProfile])

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    sync()
  }, [sync])

  const portrait = profile?.taste_summary ?? null

  // ── States ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <p className="font-display text-xl text-ink mb-2">Something went wrong</p>
        <p className="text-muted text-sm mb-6">{error}</p>
        <button
          onClick={() => { ranRef.current = false; sync() }}
          className="bg-forest-700 text-white px-5 py-2.5 rounded-full text-sm font-body font-medium hover:bg-forest-900 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  // Empty shelf — nothing to infer from yet.
  if (bookCount === 0) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="font-display text-3xl text-ink mb-2">Your taste</h1>
        <p className="text-muted text-sm leading-relaxed max-w-xs">
          Your librarian is still reading you in. Add and rate a few books on your shelf and your taste will take shape here.
        </p>
      </div>
    )
  }

  // First-ever computation, nothing cached to show meanwhile.
  if (!axes && computing) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4">
        <h1 className="font-display text-3xl text-ink mb-1">Your taste</h1>
        <p className="text-muted text-sm mb-8 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-forest-700 rounded-full animate-pulse inline-block" />
          Reading your shelf…
        </p>
        <div className="space-y-4">
          <div className="h-24 bg-parchment rounded-xl animate-pulse" />
          <div className="h-40 bg-parchment rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!axes) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4">
        <h1 className="font-display text-3xl text-ink mb-1">Your taste</h1>
        <p className="text-muted text-sm">Your taste profile isn't ready yet.</p>
      </div>
    )
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 md:px-8 pt-8 md:pt-10 pb-10 max-w-2xl">
      <h1 className="font-display text-3xl text-ink mb-1">Your taste</h1>
      <p className="text-muted text-sm mb-7 flex items-center gap-1.5">
        What your librarian knows so far
        {computing && (
          <span className="w-1.5 h-1.5 bg-forest-700 rounded-full animate-pulse inline-block" title="updating" />
        )}
      </p>

      {/* Portrait header */}
      {portrait && (
        <div className="mb-5">
          <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted mb-2">
            In your librarian's words
          </p>
          <p className="font-display text-xl text-forest-900 leading-relaxed">{portrait}</p>
          {bookCount != null && (
            <p className="text-xs text-muted mt-2">Drawn from {bookCount} book{bookCount === 1 ? '' : 's'} on your shelf</p>
          )}
        </div>
      )}

      {/* What you read for — composition */}
      <section className="bg-parchment border border-border rounded-xl p-5 mb-4">
        <h2 className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted mb-1">
          What you read for
        </h2>
        <p className="text-sm text-muted mb-4">The share of your reading reward from each source.</p>
        <CompositionBar source={axes.source_of_reward} />
      </section>

      {/* How you like it to read — bipolar axes */}
      <section className="bg-parchment border border-border rounded-xl p-5">
        <h2 className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted mb-5">
          How you like it to read
        </h2>
        <div className="flex flex-col gap-5">
          <AxisRow left="effortless" right="demanding" axis={axes.weight} accent="forest" />
          <AxisRow left="slow burn" right="page-turner" axis={axes.propulsion} accent="forest" />
          <AxisRow left="warm" right="bleak" axis={axes.darkness} accent="burgundy" />
          <AxisRow left="earnest" right="playful" axis={axes.tone} accent="burgundy" />
        </div>
        <p className="text-xs text-muted mt-5 pt-4 border-t border-border">
          Faded axes marked “?” are ones your librarian hasn't figured out yet — talk to it about those books and they'll fill in.
        </p>
      </section>
    </div>
  )
}
