import { useEffect } from 'react'
import { cn } from '../../lib/utils'
import { useHighlighterContext } from '../../contexts/HighlighterContext'
import type { DiffHunk as DiffHunkType, DiffLine } from '../../../shared/types'

interface SideBySideDiffViewProps {
  hunks: DiffHunkType[];
  filePath: string;
}

interface SplitLine {
  left: DiffLine | null;
  right: DiffLine | null;
}

function buildSplitLines (hunks: DiffHunkType[]): SplitLine[] {
  const result: SplitLine[] = []

  for (const hunk of hunks) {
    const removedQueue: DiffLine[] = []
    const addedQueue: DiffLine[] = []

    for (const line of hunk.lines) {
      if (line.type === 'removed') {
        removedQueue.push(line)
      } else if (line.type === 'added') {
        addedQueue.push(line)
      } else {
        // Flush queues before context line
        while (removedQueue.length > 0 || addedQueue.length > 0) {
          result.push({
            left: removedQueue.shift() || null,
            right: addedQueue.shift() || null,
          })
        }
        // Context lines appear on both sides
        result.push({ left: line, right: line })
      }
    }

    // Flush remaining lines after the hunk
    while (removedQueue.length > 0 || addedQueue.length > 0) {
      result.push({
        left: removedQueue.shift() || null,
        right: addedQueue.shift() || null,
      })
    }
  }

  return result
}

function SplitLineCell ({ line, filePath, side }: { line: DiffLine | null; filePath: string; side: 'left' | 'right' }) {
  const highlighter = useHighlighterContext()

  if (!line) {
    return (
      <div className='flex font-mono text-sm bg-[var(--gh-bg-secondary)] min-h-[1.5rem]'>
        <span className='w-12 px-2 py-0.5 text-right text-[var(--gh-text-muted)] select-none bg-[var(--gh-bg-secondary)] border-r border-[var(--gh-border)] shrink-0' />
        <pre className='flex-1 py-0.5 pr-2 pl-1' />
      </div>
    )
  }

  const highlightedHtml = highlighter?.getHighlightedLine(filePath, line.content)
  const lineNumber = side === 'left' ? line.oldLineNumber : line.newLineNumber

  const bgClass = {
    added: 'bg-[var(--diff-added-bg)]',
    removed: 'bg-[var(--diff-removed-bg)]',
    context: 'bg-[var(--gh-bg-elevated)]',
  }[line.type]

  const textClass = {
    added: 'text-[var(--gh-success)]',
    removed: 'text-[var(--gh-error)]',
    context: 'text-[var(--gh-text-primary)]',
  }[line.type]

  return (
    <div className={cn('flex font-mono text-sm min-h-[1.5rem]', bgClass)}>
      <span className='w-12 px-2 py-0.5 text-right text-[var(--gh-text-muted)] select-none bg-[var(--gh-bg-secondary)] border-r border-[var(--gh-border)] shrink-0'>
        {lineNumber ?? ''}
      </span>
      <pre className={cn('flex-1 py-0.5 pr-2 pl-1 whitespace-pre overflow-hidden text-ellipsis', textClass)}>
        {highlightedHtml
          ? (
            <code className='shiki-line' dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
            )
          : (
            <code>{line.content || ' '}</code>
            )}
      </pre>
    </div>
  )
}

export function SideBySideDiffView ({ hunks, filePath }: SideBySideDiffViewProps) {
  const highlighter = useHighlighterContext()
  const splitLines = buildSplitLines(hunks)

  // Trigger highlighting for this file
  useEffect(() => {
    if (highlighter?.isReady) {
      const allLines = hunks.flatMap((h) => h.lines.map((l) => l.content))
      highlighter.highlightFile(filePath, allLines)
    }
  }, [highlighter?.isReady, filePath, hunks, highlighter])

  return (
    <div className='border-b border-[var(--gh-border)] last:border-b-0'>
      <div className='flex'>
        <div className='flex-1 border-r border-[var(--gh-border)] min-w-0'>
          <div className='bg-[var(--gh-bg-surface)] px-3 py-1 text-xs font-medium text-[var(--gh-text-muted)] border-b border-[var(--gh-border)]'>
            Original
          </div>
          {splitLines.map((split, idx) => (
            <SplitLineCell key={`left-${idx}`} line={split.left} filePath={filePath} side='left' />
          ))}
        </div>
        <div className='flex-1 min-w-0'>
          <div className='bg-[var(--gh-bg-surface)] px-3 py-1 text-xs font-medium text-[var(--gh-text-muted)] border-b border-[var(--gh-border)]'>
            Modified
          </div>
          {splitLines.map((split, idx) => (
            <SplitLineCell key={`right-${idx}`} line={split.right} filePath={filePath} side='right' />
          ))}
        </div>
      </div>
    </div>
  )
}
