interface Props {
  count: number
  goal: number
}

export default function GoalProgress({ count, goal }: Props) {
  const pct = Math.min(100, Math.round((count / goal) * 100))
  const reached = count >= goal

  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-xs text-muted">
          {reached
            ? `Goal reached — ${count} of ${goal} books read 🎉`
            : `${count} of ${goal} books read this year`}
        </p>
        <p className="text-xs font-medium text-forest-700">{pct}%</p>
      </div>
      <div
        className="h-2 rounded-full bg-parchment overflow-hidden"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={goal}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${reached ? 'bg-burgundy-700' : 'bg-forest-700'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
