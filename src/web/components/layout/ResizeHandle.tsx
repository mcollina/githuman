import type { PointerEvent, KeyboardEvent } from 'react'
import { cn } from '../../lib/utils'

interface ResizeHandleProps {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onAdjust?: (delta: number) => void
  ariaLabel?: string
  className?: string
}

const KEYBOARD_STEP = 16

/**
 * Vertical drag handle that sits between two horizontally-arranged panels.
 * Hidden on mobile; visible from the `md` breakpoint upward.
 */
export function ResizeHandle ({
  onPointerDown,
  onAdjust,
  ariaLabel = 'Resize panel',
  className,
}: ResizeHandleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onAdjust) return
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        onAdjust(-KEYBOARD_STEP)
        break
      case 'ArrowRight':
        event.preventDefault()
        onAdjust(KEYBOARD_STEP)
        break
      default:
    }
  }

  return (
    <div
      role='separator'
      aria-orientation='vertical'
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={handleKeyDown}
      className={cn(
        'hidden md:block relative w-1 shrink-0 cursor-col-resize touch-none',
        'bg-transparent hover:bg-[var(--gh-accent-primary)]/40 active:bg-[var(--gh-accent-primary)]',
        'transition-colors focus:outline-none focus-visible:bg-[var(--gh-accent-primary)]/60',
        className
      )}
    >
      {/* Expanded invisible hit area — 44px wide for touch devices */}
      <span aria-hidden='true' className='absolute inset-y-0 -left-[22px] -right-[22px]' />
    </div>
  )
}
