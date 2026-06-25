import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUserBooks } from '../lib/db'
import { recomputeTaste } from '../lib/librarian'
import Bertha from '../components/Bertha'
import type { TasteAxes, TasteAxis } from '../types'

// Below this confidence an axis is shown as an unknown "gap" rather than a position.
const CONFIDENCE_GAP = 0.25

const SOURCE_SEGMENTS = [
  { key: 'language', label: 'Language' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'character', label: 'Character' },
  { key: 'story', label: 'Story' },
] as const

// A single-hue forest scale, applied darkest→lightest by share. The bar is a
// part-to-whole composition, so a sequential ramp reads cleaner than four
// unrelated colours — and the biggest source is always the most prominent.
const RANK_FILL = ['bg-forest-900', 'bg-forest-700', 'bg-forest-400', 'bg-forest-100']

function CompositionBar({ source }: { source: TasteAxes['source_of_reward'] }) {
  const ranked = SOURCE_SEGMENTS.map((seg) => ({ ...seg, pct: Math.round(source[seg.key] * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .map((seg, i) => ({ ...seg, cls: RANK_FILL[i] }))

  return (
    <div>
      {/* gap-px over a border-coloured track draws hairline dividers between segments */}
      <div className="flex h-7 rounded-md overflow-hidden border border-border bg-border gap-px">
        {ranked.map(({ key, cls, pct }) => (
          <div key={key} className={cls} style={{ width: `${pct}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {ranked.map(({ key, label, cls, pct }) => (
          <span key={key} className="flex items-center gap-1.5 text-sm text-ink">
            <span className={`w-2.5 h-2.5 rounded-sm ${cls} inline-block`} />
            {label} <span className="text-muted">{pct}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function AxisRow({ left, right, axis }: { left: string; right: string; axis: TasteAxis }) {
  const isGap = axis.confidence < CONFIDENCE_GAP
  const pct = ((axis.value + 1) / 2) * 100
  // The band widens as confidence drops — visible uncertainty around the marker.
  const bandPx = Math.round((1 - axis.confidence) * 70) + 16
  const dotCls = 'bg-forest-700'
  const bandCls = 'bg-forest-700/15'

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

      // Show the cached profile instantly, then ask the server to recompute. The edge
      // function is the authority on staleness — its signature folds in conversation
      // as well as the shelf, and it no-ops cheaply (no model call) when nothing has
      // changed — so we always trigger it and let it decide.
      const cached = profile?.taste_axes ?? null
      if (cached) setAxes(cached)

      setComputing(true)
      const { taste_axes } = await recomputeTaste()
      setAxes(taste_axes)
      await refreshProfile()
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
        <Bertha expression="oops" size={84} className="mb-3" />
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
        <Bertha expression="reading" size={96} className="mb-4" />
        <h1 className="font-display text-3xl text-ink mb-2">Your taste</h1>
        <p className="text-muted text-sm leading-relaxed max-w-xs">
          I'm still reading you in. Add and rate a few books on your shelf and your taste will take shape here.
        </p>
      </div>
    )
  }

  // First-ever computation, nothing cached to show meanwhile.
  if (!axes && computing) {
    return (
      <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4">
        <h1 className="font-display text-3xl text-ink mb-1">Your taste</h1>
        <p className="text-muted text-sm mb-8 flex items-center gap-2">
          <Bertha expression="thinking" size={28} />
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

  const hasGap = [axes.weight, axes.propulsion, axes.darkness, axes.tone].some(
    (a) => a.confidence < CONFIDENCE_GAP,
  )

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
          <AxisRow left="effortless" right="demanding" axis={axes.weight} />
          <AxisRow left="slow burn" right="page-turner" axis={axes.propulsion} />
          <AxisRow left="warm" right="bleak" axis={axes.darkness} />
          <AxisRow left="earnest" right="playful" axis={axes.tone} />
        </div>
        {hasGap && (
          <p className="text-xs text-muted mt-5 pt-4 border-t border-border">
            Faded axes marked “?” are ones your librarian hasn't figured out yet — talk to it about those books and they'll fill in.
          </p>
        )}
      </section>
    </div>
  )
}
