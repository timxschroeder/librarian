interface Props {
  count: number
  goal: number
}

export default function GoalProgress({ count, goal }: Props) {
  const pct = Math.min(100, Math.round((count / goal) * 100))
  const reached = count >= goal

  // Green deepens with progress: soft sage → brand forest → deep forest on completion.
  const barColor = reached ? 'bg-forest-900' : pct < 50 ? 'bg-forest-400' : 'bg-forest-700'
  const pctClass = reached
    ? 'text-cream bg-forest-900 px-2 rounded-full'
    : pct < 50
      ? 'text-muted'
      : 'text-forest-700'

  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className={`text-xs ${reached ? 'font-medium text-forest-900' : 'text-muted'}`}>
          {reached
            ? `Goal reached — ${count} of ${goal} books read 🎉`
            : `${count} of ${goal} books read this year`}
        </p>
        <p className={`text-xs font-medium ${pctClass}`}>{pct}%</p>
      </div>
      <div
        className="h-2 rounded-full bg-parchment overflow-hidden"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={goal}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
