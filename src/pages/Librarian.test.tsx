import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SlateBook } from '../types'

const getChatHistory = vi.fn()
const saveChatMessage = vi.fn()
vi.mock('../lib/db', () => ({
  getChatHistory: (...a: unknown[]) => getChatHistory(...a),
  saveChatMessage: (...a: unknown[]) => saveChatMessage(...a),
}))

const converse = vi.fn()
vi.mock('../lib/librarian', () => ({
  converse: (...a: unknown[]) => converse(...a),
}))

// A STABLE auth object — returning fresh callbacks each call would change the load
// effect's identity every render, re-fire it, and wipe messages.
const scheduleTasteRefresh = vi.fn()
const auth = {
  user: { id: 'u1' },
  profile: { taste_summary: 'You love voice.' },
  refreshProfile: vi.fn(),
  scheduleTasteRefresh,
}
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }))

import Librarian from './Librarian'

const book = (title: string, pinned = false): SlateBook => ({
  title,
  author: 'An Author',
  type: 'comfort',
  reasoning: 'fits your taste',
  pinned,
})

beforeEach(() => {
  getChatHistory.mockReset().mockResolvedValue([])
  saveChatMessage.mockReset().mockResolvedValue(undefined)
  converse.mockReset()
  scheduleTasteRefresh.mockReset()
})

async function sendMessage(user: ReturnType<typeof userEvent.setup>, text: string) {
  // The input only mounts once chat history has loaded (skeleton shows first).
  const input = await screen.findByPlaceholderText(/Talk to your librarian/)
  await user.type(input, text)
  await user.click(screen.getByRole('button', { name: 'Send' }))
}

describe('Librarian (Chat)', () => {
  it('renders the slate cards a turn puts on the table', async () => {
    converse.mockResolvedValue({
      message: 'Three to weigh.',
      recommendations: [book('Piranesi'), book('The Starless Sea')],
    })
    const user = userEvent.setup()
    render(<Librarian />)

    await sendMessage(user, 'what should I read')

    expect(await screen.findByText('Piranesi')).toBeInTheDocument()
    expect(screen.getByText('The Starless Sea')).toBeInTheDocument()
    // The slate is persisted so it survives a refresh.
    expect(saveChatMessage).toHaveBeenCalledWith(
      'u1', 'assistant', 'Three to weigh.', expect.arrayContaining([expect.objectContaining({ title: 'Piranesi' })]),
    )
    // Conversation feeds taste: each completed turn nudges a (debounced) recompute.
    await waitFor(() => expect(scheduleTasteRefresh).toHaveBeenCalled())
  })

  it('keeps the table sticky through a pure-conversation turn', async () => {
    converse
      .mockResolvedValueOnce({ message: 'Here.', recommendations: [book('Piranesi')] })
      .mockResolvedValueOnce({ message: 'What did the ending leave you with?', recommendations: [] })
    const user = userEvent.setup()
    render(<Librarian />)

    await sendMessage(user, 'recommend something')
    expect(await screen.findByText('Piranesi')).toBeInTheDocument()

    await sendMessage(user, 'I am gutted')
    expect(await screen.findByText('What did the ending leave you with?')).toBeInTheDocument()
    // Card stays on screen even though this turn returned no books.
    expect(screen.getByText('Piranesi')).toBeInTheDocument()
  })

  it('pins a book and rides the pin along on the next turn', async () => {
    converse
      .mockResolvedValueOnce({ message: 'Here.', recommendations: [book('Piranesi'), book('The Starless Sea')] })
      .mockResolvedValueOnce({ message: 'Re-rolled.', recommendations: [book('Piranesi', true), book('The Night Circus')] })
    const user = userEvent.setup()
    render(<Librarian />)

    await sendMessage(user, 'recommend something')
    const pinBtn = await screen.findByRole('button', { name: 'Pin Piranesi' })
    await user.click(pinBtn)

    // The card reflects the pinned state immediately.
    expect(await screen.findByRole('button', { name: 'Unpin Piranesi' })).toBeInTheDocument()

    await sendMessage(user, 'more like that')

    // The second converse call received the table with Piranesi pinned.
    await waitFor(() => expect(converse).toHaveBeenCalledTimes(2))
    const tableArg = converse.mock.calls[1][2] as SlateBook[]
    expect(tableArg.find((b) => b.title === 'Piranesi')?.pinned).toBe(true)
  })

  it('only the latest slate is interactive', async () => {
    converse
      .mockResolvedValueOnce({ message: 'First.', recommendations: [book('Piranesi')] })
      .mockResolvedValueOnce({ message: 'Second.', recommendations: [book('The Night Circus')] })
    const user = userEvent.setup()
    render(<Librarian />)

    await sendMessage(user, 'one')
    await screen.findByText('Piranesi')
    await sendMessage(user, 'two')
    await screen.findByText('The Night Circus')

    // The older card's pin button is disabled; the live one's is not.
    expect(screen.getByRole('button', { name: 'Pin Piranesi' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Pin The Night Circus' })).not.toBeDisabled()
  })
})
