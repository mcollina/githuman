import { Link, useSearchParams } from 'react-router-dom'
import { useAskSession, useContinueAsk } from '../../hooks/useAsks'

export function AskSessionDock () {
  const [searchParams] = useSearchParams()
  const askId = searchParams.get('ask')
  const { data, refetch } = useAskSession(askId ?? '')
  const { mutate: continueAsk, loading: continuing } = useContinueAsk()

  if (!askId || !data) {
    return null
  }

  const isDone = data.status !== 'waiting_for_human'

  if (isDone) {
    return null
  }

  return (
    <div className='pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2'>
      <div className='pointer-events-auto rounded-full border border-[var(--gh-border)] bg-[var(--gh-bg-primary)]/95 px-3 py-2 text-xs text-[var(--gh-text-secondary)] shadow-lg backdrop-blur'>
        Assistant handoff active
      </div>

      <div className='pointer-events-auto flex items-center gap-2'>
        <Link
          to={`/ask/${askId}`}
          className='rounded-full border border-[var(--gh-border)] bg-[var(--gh-bg-primary)]/95 px-3 py-2 text-sm font-medium text-[var(--gh-text-primary)] shadow-lg backdrop-blur transition hover:bg-[var(--gh-bg-secondary)]'
        >
          <span className='sm:hidden'>Handoff</span>
          <span className='hidden sm:inline'>Back to handoff</span>
        </Link>
        <button
          onClick={async () => {
            await continueAsk(askId)
            await refetch()
          }}
          disabled={continuing}
          className='rounded-full bg-[var(--gh-accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-50 sm:px-5'
        >
          {continuing ? 'Continuing…' : 'Continue assistant'}
        </button>
      </div>
    </div>
  )
}
