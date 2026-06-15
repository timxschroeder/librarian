import { useState } from 'react'
import { parseReadingList } from '../lib/librarian'
import { matchEntry } from '../lib/openLibrary'
import { bulkAddBooks } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import Bertha from './Bertha'
import type { UserBook } from '../types'

/** What the import hands back to the shelf to drive the "just added" review banner. */
export interface ImportResult {
  added: UserBook[]
  skipped: number
  unmatched: string[]
  flaggedBookIds: string[]
}

interface Props {
  onClose: () => void
  onImported: (result: ImportResult) => void
}

export default function BulkImportModal({ onClose, onImported }: Props) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!user || !text.trim()) return
    setWorking(true)
    setError(null)
    try {
      setStatus('Reading your list…')
      const entries = await parseReadingList(text)
      if (entries.length === 0) {
        setError("Couldn't find any books in that text. Try listing some titles.")
        setWorking(false)
        return
      }

      setStatus(`Matching ${entries.length} book${entries.length === 1 ? '' : 's'}…`)
      const matched = await Promise.all(entries.map(matchEntry))
      const found = matched.filter((m) => m.book)
      const unmatched = matched.filter((m) => !m.book).map((m) => m.sourceLine)
      const flaggedBookIds = found.filter((m) => m.flagged).map((m) => m.book!.id)

      if (found.length === 0) {
        setError("Couldn't match any of those to a real book. Try adding the author too.")
        setWorking(false)
        return
      }

      setStatus('Adding to your shelf…')
      const { added, skipped } = await bulkAddBooks(user.id, found.map((m) => m.book!))

      onImported({ added, skipped, unmatched, flaggedBookIds })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed. Try again.'
      setError(msg)
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h2 className="font-display text-xl text-ink">Import a list</h2>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors p-1 -mr-1" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {working ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <Bertha expression="thinking" size={96} className="mb-4" />
              <p className="font-display text-lg text-ink">{status || 'Reading your list…'}</p>
              <p className="text-sm text-muted mt-1">Matching each line to a real book.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted mb-3">
                Paste anything — a list, your reading notes, or a half-remembered paragraph.
                I'll figure out the titles. Wrong guesses are easy to remove after.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'The Left Hand of Darkness\nthat new Sally Rooney one\nall of the Wayfarers books by Becky Chambers\nProject Hail Mary'}
                className="w-full h-44 resize-none border border-border rounded-lg px-3 py-2.5 text-sm font-body text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-forest-700 disabled:opacity-60"
                autoFocus
              />
              {error && <p className="text-burgundy-700 text-sm mt-3">{error}</p>}
            </>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-muted">{working ? 'Working…' : 'Gemini resolves each line to a real book'}</span>
          <button
            onClick={run}
            disabled={working || !text.trim()}
            className="bg-forest-700 text-white px-5 py-2 rounded-full text-sm font-body font-medium disabled:opacity-40 hover:bg-forest-900 transition-colors flex items-center justify-center gap-2 min-w-[120px]"
          >
            {working ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Match books'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
