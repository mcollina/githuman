import { useCallback, useMemo, useState } from 'react'
import type { DiffFile, DiffFileMetadata } from '../../shared/types'

const STORAGE_KEY_PREFIX = 'githuman.reviewedFiles:'

// Map of file path -> fingerprint of the diff content when it was marked reviewed
type ReviewedMap = Record<string, string>

/**
 * Compute a fingerprint of a file's diff so that a reviewed mark is
 * invalidated when the staged content of the file changes.
 */
export function fingerprintDiffFile (file: DiffFile | DiffFileMetadata): string {
  // FNV-1a 32-bit hash over the status, paths, and every hunk line
  let hash = 0x811c9dc5
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  feed(`${file.status}\0${file.oldPath}\0${file.newPath}\0${file.additions}\0${file.deletions}\0`)
  // Review snapshots only carry metadata; hunks are lazily loaded
  const hunks = 'hunks' in file && Array.isArray(file.hunks) ? file.hunks : []
  for (const hunk of hunks) {
    feed(`@@${hunk.oldStart},${hunk.oldLines},${hunk.newStart},${hunk.newLines}\n`)
    for (const line of hunk.lines) {
      feed(`${line.type[0]}${line.content}\n`)
    }
  }
  return (hash >>> 0).toString(16)
}

function readStored (storageKey: string): ReviewedMap {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStored (storageKey: string, value: ReviewedMap) {
  if (typeof window === 'undefined') return
  try {
    if (Object.keys(value).length === 0) {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    }
  } catch {
    // ignore quota / privacy mode errors
  }
}

export interface UseReviewedFilesResult {
  reviewedFiles: Set<string>
  setFileReviewed: (filePath: string, reviewed: boolean) => void
}

/**
 * Tracks which diff files the user has marked as fully reviewed, persisting
 * the marks to localStorage under the given scope (e.g. a repository path or
 * a review id). A mark only applies while the file's diff is unchanged.
 */
export function useReviewedFiles (files: (DiffFile | DiffFileMetadata)[], scope: string | undefined): UseReviewedFilesResult {
  const storageKey = `${STORAGE_KEY_PREFIX}${scope ?? ''}`
  const [state, setState] = useState(() => ({ key: storageKey, map: readStored(storageKey) }))

  // Re-read synchronously when the repository changes (e.g. once the diff
  // loads) so files mount with the correct collapsed state on first render.
  let stored = state.map
  if (state.key !== storageKey) {
    stored = readStored(storageKey)
    setState({ key: storageKey, map: stored })
  }

  const fingerprints = useMemo(() => {
    const map = new Map<string, string>()
    for (const file of files) {
      map.set(file.newPath || file.oldPath, fingerprintDiffFile(file))
    }
    return map
  }, [files])

  const reviewedFiles = useMemo(() => {
    const set = new Set<string>()
    for (const [path, fingerprint] of fingerprints) {
      if (stored[path] === fingerprint) set.add(path)
    }
    return set
  }, [fingerprints, stored])

  const setFileReviewed = useCallback((filePath: string, reviewed: boolean) => {
    const fingerprint = fingerprints.get(filePath)
    if (!fingerprint) return
    setState((prev) => {
      const current = prev.key === storageKey ? prev.map : readStored(storageKey)
      // Drop marks for files that are no longer part of the diff or have changed
      const next: ReviewedMap = {}
      for (const [path, fp] of fingerprints) {
        if (current[path] === fp) next[path] = fp
      }
      if (reviewed) {
        next[filePath] = fingerprint
      } else {
        delete next[filePath]
      }
      writeStored(storageKey, next)
      return { key: storageKey, map: next }
    })
  }, [fingerprints, storageKey])

  return { reviewedFiles, setFileReviewed }
}
