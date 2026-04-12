import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'githuman.reviewSidebarWidth'
const DEFAULT_WIDTH = 256 // matches former Tailwind w-64
const MIN_WIDTH = 180
const MAX_WIDTH = 600
const MAX_VIEWPORT_FRACTION = 0.6

function clampWidth (raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_WIDTH
  const viewportCap = typeof window !== 'undefined'
    ? Math.max(MIN_WIDTH, Math.floor(window.innerWidth * MAX_VIEWPORT_FRACTION))
    : MAX_WIDTH
  const upper = Math.min(MAX_WIDTH, viewportCap)
  return Math.min(Math.max(raw, MIN_WIDTH), upper)
}

function readStoredWidth (): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored == null) return DEFAULT_WIDTH
    const parsed = Number.parseInt(stored, 10)
    return clampWidth(parsed)
  } catch {
    return DEFAULT_WIDTH
  }
}

export interface UseResizablePanelResult {
  width: number
  startResize: (event: React.PointerEvent<HTMLElement>) => void
  adjustWidth: (delta: number) => void
  setWidth: (next: number) => void
}

/**
 * Hook that manages the width of a resizable panel via pointer drag,
 * persisting the user's preference to localStorage.
 */
export function useResizablePanel (): UseResizablePanelResult {
  const [width, setWidthState] = useState<number>(readStoredWidth)
  const dragStateRef = useRef<{ startX: number, startWidth: number } | null>(null)

  // Re-clamp if the viewport shrinks below the current width.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      setWidthState((current) => {
        const clamped = clampWidth(current)
        return clamped === current ? current : clamped
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const persist = useCallback((next: number) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // ignore quota / privacy mode errors
    }
  }, [])

  const setWidth = useCallback((next: number) => {
    const clamped = clampWidth(next)
    setWidthState(clamped)
    persist(clamped)
  }, [persist])

  const adjustWidth = useCallback((delta: number) => {
    setWidthState((current) => {
      const clamped = clampWidth(current + delta)
      persist(clamped)
      return clamped
    })
  }, [persist])

  const startResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault()
    dragStateRef.current = { startX: event.clientX, startWidth: width }

    // Capture the pointer so touch devices keep delivering events even
    // when the finger moves off the handle element.
    const target = event.currentTarget
    const pointerId = event.pointerId
    try { target.setPointerCapture(pointerId) } catch { /* not supported */ }

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (e: PointerEvent) => {
      const state = dragStateRef.current
      if (!state) return
      const next = clampWidth(state.startWidth + (e.clientX - state.startX))
      setWidthState(next)
    }

    const cleanup = () => {
      const state = dragStateRef.current
      dragStateRef.current = null
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      try { target.releasePointerCapture(pointerId) } catch { /* already released */ }
      if (state) {
        setWidthState((current) => {
          persist(current)
          return current
        })
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
  }, [persist, width])

  return { width, startResize, adjustWidth, setWidth }
}

export const RESIZABLE_PANEL_LIMITS = {
  DEFAULT_WIDTH,
  MIN_WIDTH,
  MAX_WIDTH,
  STORAGE_KEY,
}
