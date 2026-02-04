import { useState, useEffect } from 'react'
import { lt } from 'semver'
import { version as CURRENT_VERSION } from '../../../package.json'

const DISMISSED_KEY = 'githuman-version-dismissed'

interface VersionInfo {
  latest: string | null;
  hasUpdate: boolean;
}

export function VersionBanner() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({ latest: null, hasUpdate: false })
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(DISMISSED_KEY) === 'true'
  })

  useEffect(() => {
    if (dismissed) return

    const checkVersion = async () => {
      try {
        const response = await fetch('https://registry.npmjs.org/githuman/latest')
        if (!response.ok) return

        const data = await response.json()
        const latestVersion = data.version
        const hasUpdate = lt(CURRENT_VERSION, latestVersion)
        setVersionInfo({ latest: latestVersion, hasUpdate })
      } catch {
        // Silently fail - version check is non-critical
      }
    }

    checkVersion()
  }, [dismissed])

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem(DISMISSED_KEY, 'true')
  }

  if (dismissed || !versionInfo.hasUpdate || !versionInfo.latest) {
    return null
  }

  return (
    <div className='bg-[var(--gh-accent-primary)]/10 border-b border-[var(--gh-accent-primary)]/30 px-4 py-2 flex items-center justify-between gap-4'>
      <div className='flex items-center gap-2 text-sm'>
        <svg className='w-4 h-4 text-[var(--gh-accent-primary)]' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
        </svg>
        <span className='text-[var(--gh-text-secondary)]'>
          A new version of GitHuman is available:
          <span className='font-semibold text-[var(--gh-accent-primary)] ml-1'>v{versionInfo.latest}</span>
        </span>
        <span className='text-[var(--gh-text-muted)]'>
          (current: v{CURRENT_VERSION})
        </span>
        <span className='hidden sm:inline text-[var(--gh-text-muted)]'>
          — Run <code className='bg-[var(--gh-bg-elevated)] px-1.5 py-0.5 rounded text-xs font-mono'>npm update -g githuman</code> to update
        </span>
      </div>
      <button
        onClick={handleDismiss}
        className='text-[var(--gh-text-muted)] hover:text-[var(--gh-text-primary)] transition-colors p-1'
        aria-label='Dismiss'
      >
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
        </svg>
      </button>
    </div>
  )
}
