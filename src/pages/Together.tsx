import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import BookCard from '../components/BookCard'
import type { UserBook, Profile } from '../types'

export default function Together() {
  const { user } = useAuth()
  const [partner, setPartner] = useState<Profile | null>(null)
  const [partnerBooks, setPartnerBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!user) return
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)

      if (profiles?.[0]) {
        const p = profiles[0] as Profile
        setPartner(p)
        const { data: books } = await supabase
          .from('user_books')
          .select('*, book:books(*), profile:profiles(id, name)')
          .eq('user_id', p.id)
          .order('created_at', { ascending: false })
        setPartnerBooks((books as UserBook[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="px-5 pt-8">
        <h1 className="font-display text-3xl text-ink mb-6">Together</h1>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-parchment rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pt-8 pb-4">
      <h1 className="font-display text-3xl text-ink mb-1">Together</h1>
      <p className="text-muted text-sm mb-6">What the other one is reading</p>

      {!partner ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">💌</p>
          <p className="font-display text-xl text-ink mb-2">Waiting for Michelle</p>
          <p className="text-muted text-sm leading-relaxed">
            Once Michelle joins and adds books, her shelf will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5 bg-white rounded-xl px-4 py-3 border border-border">
            <div className="w-9 h-9 rounded-full bg-forest-700 flex items-center justify-center text-white font-display text-sm flex-shrink-0">
              {partner.name[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-body font-semibold text-ink">{partner.name}</p>
              <p className="text-xs text-muted">{partnerBooks.length} {partnerBooks.length === 1 ? 'book' : 'books'} read</p>
            </div>
          </div>

          {partnerBooks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-sm">{partner.name} hasn't added any books yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {partnerBooks.map((ub) => (
                <BookCard key={ub.id} userBook={ub} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
