import Bertha from './Bertha'

interface Props {
  goal: number
  onDismiss: () => void
}

// Reuses brand + accent tokens already in play elsewhere (see BookCard's
// SPINE_COLORS) rather than introducing new ones.
const CONFETTI_COLORS = ['bg-forest-700', 'bg-burgundy-700', 'bg-amber-400', 'bg-teal-400', 'bg-rose-300', 'bg-forest-400']
const CONFETTI_COUNT = 28

export default function GoalCelebration({ goal, onDismiss }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reading goal reached"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
          const left = (i * 37) % 100
          const delay = ((i * 13) % 60) / 100
          const duration = 2.2 + ((i * 7) % 12) / 10
          const rotate = (i * 53) % 360
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
          return (
            <span
              key={i}
              className={`absolute top-[-5%] w-2.5 h-2.5 rounded-sm ${color} animate-confetti-fall`}
              style={{
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                transform: `rotate(${rotate}deg)`,
              }}
            />
          )
        })}
      </div>

      <div className="relative bg-cream rounded-3xl shadow-xl border border-border px-8 py-8 text-center max-w-sm animate-pop-in">
        <div className="flex justify-center mb-2">
          <Bertha expression="delighted" size={120} className="animate-bertha-dance" title="Bertha dancing" />
        </div>
        <h2 className="font-display text-2xl text-ink mb-1">Goal reached!</h2>
        <p className="text-muted text-sm mb-6">
          You've read {goal} {goal === 1 ? 'book' : 'books'} — Bertha is doing a happy dance.
        </p>
        <button
          onClick={onDismiss}
          className="bg-forest-700 text-white px-6 py-2.5 rounded-full text-sm font-body font-medium hover:bg-forest-900 transition-colors"
        >
          Yay!
        </button>
      </div>
    </div>
  )
}
