import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getChatHistory, saveChatMessage, updateProfile, getUserBooks } from '../lib/db'
import { chat, recommend, initializeTastePortrait, type RecommendationSlate } from '../lib/librarian'
import Bertha from '../components/Bertha'

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  slate?: { intro: string; recommendations: RecommendationSlate[] }
}

const TYPE_LABEL: Record<RecommendationSlate['type'], string> = {
  comfort: 'Comfort read',
  stretch: 'Stretch pick',
  sure_thing: 'Sure thing',
}

export default function Librarian() {
  const { user, profile, refreshProfile } = useAuth()
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const tasteSummary = profile?.taste_summary ?? null

  const loadHistory = useCallback(async () => {
    if (!user) return
    try {
      const history = await getChatHistory(user.id)
      if (history.length > 0) {
        setMessages(history.map((m) => ({ id: m.id, role: m.role, content: m.content })))
      } else {
        const welcomeContent = tasteSummary
          ? `Welcome back. What are you in the mood for, or is there a book you'd like to talk about?`
          : `Hello! I'm your personal librarian. Tell me about a book you've loved recently — what made it special to you?`
        setMessages([{ id: 'welcome', role: 'assistant', content: welcomeContent }])
      }
    } catch {
      setMessages([{ id: 'welcome', role: 'assistant', content: `Hello! I'm your personal librarian. What would you like to read next?` }])
    } finally {
      setHistoryLoaded(true)
    }
  }, [user, tasteSummary])

  // Generate initial taste portrait if it doesn't exist yet
  const maybeInitialize = useCallback(async () => {
    if (!user || profile?.taste_summary) return
    // Only initialize if they have books on their shelf (otherwise nothing to infer from)
    const userBooks = await getUserBooks(user.id)
    const lovedBooks = userBooks
      .filter((ub) => ub.rating && ub.rating >= 4)
      .map((ub) => ({ title: ub.book.title, author: ub.book.author ?? '' }))
    if (lovedBooks.length === 0) return

    setInitializing(true)
    try {
      const tasteSummary = await initializeTastePortrait(lovedBooks)
      if (tasteSummary) {
        await updateProfile(user.id, { taste_summary: tasteSummary })
        await refreshProfile()
      }
    } catch {
      // Non-fatal — librarian still works without taste portrait
    } finally {
      setInitializing(false)
    }
  }, [user, profile?.taste_summary, refreshProfile])

  useEffect(() => {
    loadHistory()
    maybeInitialize()
  }, [loadHistory, maybeInitialize])

  const getHistory = () =>
    messages
      .filter((m) => m.id !== 'welcome' && !m.slate)
      .map((m) => ({ role: m.role, content: m.content }))

  async function send(messageText: string) {
    if (!user || !messageText.trim() || loading) return
    const text = messageText.trim()
    setInput('')

    const userMsg: LocalMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      await saveChatMessage(user.id, 'user', text)
      const history = getHistory()
      const { message: reply, taste_summary_update } = await chat(text, history)

      const assistantMsg: LocalMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply }
      setMessages((prev) => [...prev, assistantMsg])
      await saveChatMessage(user.id, 'assistant', reply)

      if (taste_summary_update) {
        await updateProfile(user.id, { taste_summary: taste_summary_update })
      }
    } catch (err) {
      const errMsg: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Hm. That didn\'t land — try me again?',
      }
      setMessages((prev) => [...prev, errMsg])
      console.error(err)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function getRecommendations() {
    if (!user || loading) return
    setLoading(true)

    const promptMsg: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'What should I read next?',
    }
    setMessages((prev) => [...prev, promptMsg])

    try {
      await saveChatMessage(user.id, 'user', 'What should I read next?')
      const history = getHistory()
      const result = await recommend(input.trim(), history)

      const slateMsg: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.intro,
        slate: result,
      }
      setMessages((prev) => [...prev, slateMsg])
      await saveChatMessage(user.id, 'assistant', result.intro)
      setInput('')
    } catch (err) {
      const errMsg: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Hm, the recommendations got away from me. Give me another try?',
      }
      setMessages((prev) => [...prev, errMsg])
      console.error(err)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  if (!historyLoaded) {
    return (
      <div className="flex flex-col h-[calc(100vh-56px)] md:h-screen px-5 md:px-8 pt-8 pb-4">
        <h1 className="font-display text-3xl text-ink mb-6">Your Librarian</h1>
        <div className="flex-1 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className={`flex ${i === 2 ? 'justify-end' : ''}`}>
              <div className="h-12 w-64 bg-parchment rounded-2xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] md:h-screen">
      {/* Header */}
      <div className="px-5 md:px-8 pt-8 pb-4 border-b border-border flex-shrink-0">
        <h1 className="font-display text-3xl text-ink">Your Librarian</h1>
        {initializing && (
          <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
            <Bertha expression="thinking" size={22} />
            Getting to know your taste…
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 md:px-8 py-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <Bertha expression={msg.slate ? 'delighted' : 'happy'} size={32} className="flex-shrink-0 mt-0.5" />
            )}
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-last' : ''}`}>
              {/* Message bubble */}
              <div
                className={`px-4 py-3 rounded-2xl font-body text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-forest-700 text-white rounded-br-sm'
                    : 'bg-parchment text-ink rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>

              {/* Recommendation slate embedded in assistant message */}
              {msg.slate && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {msg.slate.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="bg-white border border-border rounded-xl p-4 flex flex-col gap-2"
                    >
                      <span className="text-[10px] font-body font-semibold uppercase tracking-wider text-forest-700">
                        {TYPE_LABEL[rec.type]}
                      </span>
                      <div>
                        <p className="font-display text-sm text-ink leading-snug">{rec.title}</p>
                        {rec.author && <p className="text-xs text-muted mt-0.5">{rec.author}</p>}
                      </div>
                      <p className="text-xs text-muted leading-relaxed flex-1">{rec.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2.5 justify-start items-center">
            <Bertha expression="thinking" size={32} className="flex-shrink-0" />
            <div className="bg-parchment px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-border bg-cream px-5 md:px-8 py-4 space-y-3">
        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={getRecommendations}
            disabled={loading}
            className="text-xs font-body px-3 py-1.5 rounded-full border border-forest-700 text-forest-700 hover:bg-forest-700/10 transition-colors disabled:opacity-40"
          >
            What should I read?
          </button>
          <button
            onClick={() => { setInput('I just finished '); inputRef.current?.focus() }}
            disabled={loading}
            className="text-xs font-body px-3 py-1.5 rounded-full border border-border text-muted hover:border-forest-700/40 hover:text-ink transition-colors disabled:opacity-40"
          >
            I just finished…
          </button>
        </div>

        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk to your librarian…"
            disabled={loading}
            className="flex-1 resize-none bg-white border border-border rounded-xl px-4 py-3 text-sm font-body text-ink placeholder:text-muted focus:outline-none focus:border-forest-700 transition-colors disabled:opacity-60 max-h-32"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = `${t.scrollHeight}px`
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-full bg-forest-700 text-white flex items-center justify-center hover:bg-forest-900 transition-colors disabled:opacity-40 flex-shrink-0"
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
