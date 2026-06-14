import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import RecommendationCard from '../components/RecommendationCard'
import type { Recommendation } from '../types'

export default function Discover() {
  const { user } = useAuth()
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchRecs = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('recommendations')
      .select('*, book:books(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRecs((data as Recommendation[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchRecs()
  }, [fetchRecs])

  async function getRecommendations() {
    if (!user) return
    setGenerating(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('recommend', {
        body: { userId: user.id, prompt: prompt.trim() || null },
      })
      if (fnError) throw fnError
      if (data?.error) {
        setError(data.error)
        return
      }
      await fetchRecs()
      setPrompt('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || 'Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="px-5 pt-8 pb-4">
      <h1 className="font-display text-3xl text-ink mb-1">Discover</h1>
      <p className="text-muted text-sm mb-6">AI-powered picks based on your taste</p>

      <div className="bg-white rounded-2xl border border-border p-4 mb-6 shadow-sm">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={'Optional prompt — e.g. "Something like Cosmos but more poetic, less technical"'}
          className="w-full text-sm font-body text-ink placeholder:text-muted/70 resize-none focus:outline-none leading-relaxed"
          rows={3}
        />
        {error && (
          <div className="mb-3 p-3 bg-burgundy-100/50 rounded-lg border border-burgundy-700/20">
            <p className="text-burgundy-700 text-xs leading-relaxed">{error}</p>
          </div>
        )}
        <button
          onClick={getRecommendations}
          disabled={generating}
          className="w-full bg-forest-700 text-white py-2.5 rounded-xl text-sm font-body font-semibold hover:bg-forest-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Thinking...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Get recommendations
            </>
          )}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl h-44 animate-pulse border border-border" />
          ))}
        </div>
      ) : recs.length === 0 ? (
        <div className="text-center py-14">
          <p className="text-5xl mb-4">✨</p>
          <p className="font-display text-xl text-ink mb-2">No picks yet</p>
          <p className="text-muted text-sm">Hit the button above to get your first recommendations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted">{recs.length} waiting for you</p>
          {recs.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} onUpdate={fetchRecs} />
          ))}
        </div>
      )}
    </div>
  )
}
