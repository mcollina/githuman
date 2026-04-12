import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useResizablePanel,
  RESIZABLE_PANEL_LIMITS,
} from '../../../src/web/hooks/useResizablePanel'

const { DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH, STORAGE_KEY } = RESIZABLE_PANEL_LIMITS

describe('useResizablePanel', () => {
  beforeEach(() => {
    vi.mocked(window.localStorage.getItem).mockReset()
    vi.mocked(window.localStorage.setItem).mockReset()
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)
    // Ensure a wide viewport so MAX_WIDTH clamping isn't dominated by
    // the 60% viewport cap in these tests.
    Object.defineProperty(window, 'innerWidth', {
      value: 1600,
      configurable: true,
      writable: true,
    })
  })

  it('returns the default width when nothing is stored', () => {
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(DEFAULT_WIDTH)
  })

  it('restores the stored width from localStorage', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('320')
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(320)
  })

  it('clamps an out-of-range stored width', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('9999')
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(MAX_WIDTH)
  })

  it('falls back to default when stored value is not a number', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('not-a-number')
    const { result } = renderHook(() => useResizablePanel())
    expect(result.current.width).toBe(DEFAULT_WIDTH)
  })

  it('setWidth clamps and persists the new width', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.setWidth(400)
    })
    expect(result.current.width).toBe(400)
    expect(window.localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, '400')
  })

  it('setWidth clamps below minimum', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.setWidth(10)
    })
    expect(result.current.width).toBe(MIN_WIDTH)
  })

  it('adjustWidth adds a delta and persists it', () => {
    const { result } = renderHook(() => useResizablePanel())
    act(() => {
      result.current.adjustWidth(16)
    })
    expect(result.current.width).toBe(DEFAULT_WIDTH + 16)
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      String(DEFAULT_WIDTH + 16)
    )
  })

  it('startResize updates width via pointer drag and persists on release', () => {
    const { result } = renderHook(() => useResizablePanel())

    act(() => {
      const syntheticDown = {
        clientX: 100,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>
      result.current.startResize(syntheticDown)
    })

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 150 })
      )
    })
    expect(result.current.width).toBe(DEFAULT_WIDTH + 50)

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'))
    })
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      String(DEFAULT_WIDTH + 50)
    )
  })

  it('pointer drag clamps below minimum', () => {
    const { result } = renderHook(() => useResizablePanel())

    act(() => {
      const syntheticDown = {
        clientX: 500,
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLElement>
      result.current.startResize(syntheticDown)
    })

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 0 })
      )
    })
    expect(result.current.width).toBe(MIN_WIDTH)
  })
})
