import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useReviewedFiles,
  fingerprintDiffFile,
} from '../../../src/web/hooks/useReviewedFiles'
import type { DiffFile } from '../../../src/shared/types'

function makeFile (path: string, content: string): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    status: 'modified',
    additions: 1,
    deletions: 0,
    hunks: [
      {
        oldStart: 1,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [{ type: 'added', content, oldLineNumber: null, newLineNumber: 1 }],
      },
    ],
  }
}

describe('useReviewedFiles', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.mocked(window.localStorage.getItem).mockReset()
    vi.mocked(window.localStorage.setItem).mockReset()
    vi.mocked(window.localStorage.removeItem).mockReset()
    vi.mocked(window.localStorage.getItem).mockImplementation((key) => store[key] ?? null)
    vi.mocked(window.localStorage.setItem).mockImplementation((key, value) => { store[key] = value })
    vi.mocked(window.localStorage.removeItem).mockImplementation((key) => { delete store[key] })
  })

  it('starts with no reviewed files', () => {
    const files = [makeFile('a.ts', 'a')]
    const { result } = renderHook(() => useReviewedFiles(files, '/repo'))
    expect(result.current.reviewedFiles.size).toBe(0)
  })

  it('marks and unmarks files as reviewed', () => {
    const files = [makeFile('a.ts', 'a'), makeFile('b.ts', 'b')]
    const { result } = renderHook(() => useReviewedFiles(files, '/repo'))

    act(() => result.current.setFileReviewed('a.ts', true))
    expect([...result.current.reviewedFiles]).toEqual(['a.ts'])

    act(() => result.current.setFileReviewed('a.ts', false))
    expect(result.current.reviewedFiles.size).toBe(0)
    expect(store['githuman.reviewedFiles:/repo']).toBeUndefined()
  })

  it('restores reviewed files after a remount', () => {
    const files = [makeFile('a.ts', 'a'), makeFile('b.ts', 'b')]
    const first = renderHook(() => useReviewedFiles(files, '/repo'))
    act(() => first.result.current.setFileReviewed('b.ts', true))
    first.unmount()

    const second = renderHook(() => useReviewedFiles(files, '/repo'))
    expect([...second.result.current.reviewedFiles]).toEqual(['b.ts'])
  })

  it('reports stored marks on the first render once the repository is known', () => {
    const files = [makeFile('a.ts', 'a')]
    store['githuman.reviewedFiles:/repo'] = JSON.stringify({ 'a.ts': fingerprintDiffFile(files[0]) })

    const seen: number[] = []
    const { rerender } = renderHook(
      ({ f, repo }: { f: DiffFile[], repo?: string }) => {
        const r = useReviewedFiles(f, repo)
        seen.push(r.reviewedFiles.size)
        return r
      },
      { initialProps: { f: [] as DiffFile[], repo: undefined as string | undefined } }
    )
    seen.length = 0
    rerender({ f: files, repo: '/repo' })
    expect(seen.every((size) => size === 1)).toBe(true)
  })

  it('invalidates the mark when the file content changes', () => {
    const { result, rerender } = renderHook(
      ({ files }) => useReviewedFiles(files, '/repo'),
      { initialProps: { files: [makeFile('a.ts', 'a')] } }
    )
    act(() => result.current.setFileReviewed('a.ts', true))
    expect(result.current.reviewedFiles.has('a.ts')).toBe(true)

    rerender({ files: [makeFile('a.ts', 'changed')] })
    expect(result.current.reviewedFiles.has('a.ts')).toBe(false)
  })

  it('supports file metadata without hunks', () => {
    const files = [{ oldPath: 'a.ts', newPath: 'a.ts', status: 'modified' as const, additions: 2, deletions: 1 }]
    const first = renderHook(() => useReviewedFiles(files, 'review:1'))
    act(() => first.result.current.setFileReviewed('a.ts', true))
    first.unmount()

    const second = renderHook(() => useReviewedFiles(files, 'review:1'))
    expect([...second.result.current.reviewedFiles]).toEqual(['a.ts'])
  })

  it('keeps marks separate per repository', () => {
    const files = [makeFile('a.ts', 'a')]
    const first = renderHook(() => useReviewedFiles(files, '/repo-one'))
    act(() => first.result.current.setFileReviewed('a.ts', true))

    const second = renderHook(() => useReviewedFiles(files, '/repo-two'))
    expect(second.result.current.reviewedFiles.size).toBe(0)
  })
})
