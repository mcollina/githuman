import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAskSession, useCancelAsk, useContinueAsk } from '../hooks/useAsks'
import { useServerEvents } from '../hooks/useServerEvents'

function sourceLabel (sourceType: 'staged' | 'branch' | 'commits', sourceRef: string | null) {
  if (sourceType === 'staged') return 'Staged changes'
  if (sourceType === 'branch') return sourceRef ? `Branch ${sourceRef}` : 'Branch review'
  if (sourceType === 'commits') return sourceRef ? `Commits ${sourceRef}` : 'Commit review'
  return 'Review'
}

export function AskPage () {
  const { id } = useParams<{ id: string }>()
  const { data, loading, refetch } = useAskSession(id!)
  const { mutate: continueAsk, loading: continuing } = useContinueAsk()
  const { mutate: cancelAsk, loading: cancelling } = useCancelAsk()

  useEffect(() => {
    if (!id) return

    const timer = setInterval(() => {
      refetch().catch(() => {})
    }, 2000)

    return () => clearInterval(timer)
  }, [id, refetch])

  useServerEvents({
    eventTypes: ['asks', 'reviews', 'comments', 'todos'],
    onEvent: () => {
      refetch().catch(() => {})
    },
    enabled: !!id,
  })

  if (loading && !data) {
    return (
      <div className='min-h-screen bg-[var(--gh-bg-primary)] flex items-center justify-center p-6'>
        <div className='text-center'>
          <div className='gh-spinner w-8 h-8 mx-auto' />
          <p className='mt-4 text-[var(--gh-text-secondary)]'>Loading assistant handoff...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className='min-h-screen bg-[var(--gh-bg-primary)] flex items-center justify-center p-6'>
        <div className='gh-card max-w-lg w-full p-6 text-center'>
          <h1 className='text-xl font-bold text-[var(--gh-text-primary)]'>Ask session not found</h1>
          <p className='mt-3 text-[var(--gh-text-secondary)]'>
            This assistant handoff could not be loaded.
          </p>
          <Link to='/' className='gh-btn gh-btn-primary inline-flex mt-6'>
            Back to GitHuman
          </Link>
        </div>
      </div>
    )
  }

  const isDone = data.status !== 'waiting_for_human'
  const askQuery = `?ask=${encodeURIComponent(data.id)}`

  return (
    <div className='min-h-screen bg-[var(--gh-bg-primary)] text-[var(--gh-text-primary)]'>
      <div className='max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-10'>
        <div className='gh-card p-6 sm:p-8'>
          <div className='flex flex-col gap-4'>
            <div>
              <span className='gh-badge gh-badge-purple'>Assistant review request</span>
              <h1 className='mt-4 text-2xl sm:text-3xl font-bold'>
                Review this work and hand it back to the assistant
              </h1>
              <p className='mt-3 text-[var(--gh-text-secondary)] text-sm sm:text-base'>
                Leave your comments in GitHuman, add todos if helpful, then click <strong>Continue assistant</strong> when you are done.
              </p>
            </div>

            {data.status === 'ready_for_agent' && (
              <div className='rounded-xl border border-[var(--gh-success)]/30 bg-[var(--gh-success)]/10 p-4'>
                <p className='font-semibold text-[var(--gh-success)]'>Assistant can continue now.</p>
                <p className='mt-1 text-sm text-[var(--gh-text-secondary)]'>
                  This handoff has been marked ready for the assistant.
                </p>
              </div>
            )}

            {data.status === 'cancelled' && (
              <div className='rounded-xl border border-[var(--gh-error)]/30 bg-[var(--gh-error)]/10 p-4'>
                <p className='font-semibold text-[var(--gh-error)]'>This request was cancelled.</p>
                <p className='mt-1 text-sm text-[var(--gh-text-secondary)]'>
                  The assistant will not resume from this handoff.
                </p>
              </div>
            )}

            <div className='rounded-xl border border-[var(--gh-border)] bg-[var(--gh-bg-secondary)] p-4 sm:p-5'>
              <p className='text-xs uppercase tracking-wide text-[var(--gh-text-muted)]'>Assistant message</p>
              <p className='mt-2 text-base sm:text-lg leading-7'>{data.message}</p>
              {data.assistantContext && (
                <div className='mt-4 rounded-lg bg-[var(--gh-bg-elevated)] p-3 text-sm text-[var(--gh-text-secondary)] whitespace-pre-wrap'>
                  {data.assistantContext}
                </div>
              )}
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='rounded-xl border border-[var(--gh-border)] bg-[var(--gh-bg-secondary)] p-4 sm:p-5'>
                <p className='text-xs uppercase tracking-wide text-[var(--gh-text-muted)]'>Where to leave feedback</p>
                {data.review
                  ? (
                    <>
                      <p className='mt-2 font-semibold'>{sourceLabel(data.review.sourceType, data.review.sourceRef)}</p>
                      <p className='mt-1 text-sm text-[var(--gh-text-secondary)]'>
                        Open the linked review, add comments or todos there, then return here.
                      </p>
                      <div className='mt-4 flex flex-wrap gap-3'>
                        <Link to={`/reviews/${data.review.id}${askQuery}`} className='gh-btn gh-btn-primary text-sm'>
                          Open review
                        </Link>
                        <Link to={`/reviews${askQuery}`} className='gh-btn gh-btn-secondary text-sm'>
                          All reviews
                        </Link>
                      </div>
                    </>
                    )
                  : (
                    <>
                      <p className='mt-2 font-semibold'>No linked review</p>
                      <p className='mt-1 text-sm text-[var(--gh-text-secondary)]'>
                        Use GitHuman to inspect the current changes, then come back here to continue the assistant.
                      </p>
                      <div className='mt-4 flex flex-wrap gap-3'>
                        <Link to={`/${askQuery}`} className='gh-btn gh-btn-primary text-sm'>
                          Open changes
                        </Link>
                        <Link to={`/reviews${askQuery}`} className='gh-btn gh-btn-secondary text-sm'>
                          Browse reviews
                        </Link>
                      </div>
                    </>
                    )}
              </div>

              <div className='rounded-xl border border-[var(--gh-border)] bg-[var(--gh-bg-secondary)] p-4 sm:p-5'>
                <p className='text-xs uppercase tracking-wide text-[var(--gh-text-muted)]'>Feedback in this handoff</p>
                <div className='mt-4 grid grid-cols-2 gap-3'>
                  <div className='rounded-lg bg-[var(--gh-bg-elevated)] p-3'>
                    <p className='text-xs text-[var(--gh-text-muted)]'>Comments</p>
                    <p className='mt-1 text-2xl font-bold'>{data.feedback.commentCount}</p>
                  </div>
                  <div className='rounded-lg bg-[var(--gh-bg-elevated)] p-3'>
                    <p className='text-xs text-[var(--gh-text-muted)]'>Unresolved</p>
                    <p className='mt-1 text-2xl font-bold'>{data.feedback.unresolvedCommentCount}</p>
                  </div>
                  <div className='rounded-lg bg-[var(--gh-bg-elevated)] p-3 col-span-2'>
                    <p className='text-xs text-[var(--gh-text-muted)]'>Todos</p>
                    <p className='mt-1 text-2xl font-bold'>{data.feedback.todoCount}</p>
                  </div>
                </div>
                <p className='mt-4 text-sm text-[var(--gh-text-secondary)]'>
                  Review status:{' '}
                  <span className='font-semibold text-[var(--gh-text-primary)]'>
                    {data.feedback.reviewStatus ?? 'unknown'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='sticky bottom-0 border-t border-[var(--gh-border)] bg-[var(--gh-bg-primary)]/95 backdrop-blur px-4 py-4'>
        <div className='max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end'>
          <button
            onClick={async () => {
              if (!id || isDone) return
              await cancelAsk(id)
              await refetch()
            }}
            disabled={isDone || cancelling || continuing}
            className='gh-btn gh-btn-secondary text-sm sm:text-base disabled:opacity-50'
          >
            {cancelling ? 'Cancelling…' : 'Cancel request'}
          </button>
          <button
            onClick={async () => {
              if (!id || isDone) return
              await continueAsk(id)
              await refetch()
            }}
            disabled={isDone || continuing || cancelling}
            className='gh-btn gh-btn-primary text-sm sm:text-base px-6 py-3 font-semibold disabled:opacity-50'
          >
            {continuing ? 'Continuing…' : 'Continue assistant'}
          </button>
        </div>
      </div>
    </div>
  )
}
