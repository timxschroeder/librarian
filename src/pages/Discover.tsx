export default function Discover() {
  return (
    <div className="px-5 md:px-8 pt-8 md:pt-10 pb-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-forest-700/10 flex items-center justify-center mb-5">
        <svg viewBox="0 0 24 24" fill="none" stroke="#2C5F2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      </div>
      <h1 className="font-display text-3xl text-ink mb-2">Discover</h1>
      <p className="text-muted text-sm leading-relaxed max-w-xs">
        AI-powered recommendations are coming soon. Build your shelf first — the more you add, the better the picks.
      </p>
    </div>
  )
}
