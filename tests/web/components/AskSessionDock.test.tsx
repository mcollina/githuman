import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AskSessionDock } from '../../../src/web/components/layout/AskSessionDock'

const refetch = vi.fn()
const continueAsk = vi.fn()

vi.mock('../../../src/web/hooks/useAsks', () => ({
  useAskSession: vi.fn(() => ({
    data: {
      id: 'ask-1',
      repositoryPath: '/repo',
      reviewId: null,
      message: 'Please review the latest changes.',
      status: 'waiting_for_human',
      assistantContext: null,
      createdAt: '2026-04-04T10:00:00.000Z',
      updatedAt: '2026-04-04T10:00:00.000Z',
      completedAt: null,
      review: null,
      feedback: {
        reviewStatus: null,
        todoCount: 0,
        commentCount: 0,
        unresolvedCommentCount: 0,
      },
    },
    refetch,
  })),
  useContinueAsk: vi.fn(() => ({
    mutate: continueAsk,
    loading: false,
    error: null,
  })),
}))

describe('AskSessionDock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders handoff actions when ask query parameter is present', () => {
    render(
      <MemoryRouter initialEntries={['/reviews?ask=ask-1']}>
        <AskSessionDock />
      </MemoryRouter>
    )

    expect(screen.getByText('Assistant handoff active')).toBeDefined()
    expect(screen.getByText('Continue assistant')).toBeDefined()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/ask/ask-1')
  })

  it('does not render without ask query parameter', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/reviews']}>
        <AskSessionDock />
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })
})
