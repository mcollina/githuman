import { useSettings, type InterfaceFont, type CodeFont } from '../../contexts/SettingsContext'
import { cn } from '../../lib/utils'

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FontOption<T> {
  value: T;
  label: string;
  description: string;
}

const interfaceFonts: FontOption<InterfaceFont>[] = [
  { value: 'default', label: 'Default (Syne)', description: 'GitHuman\'s distinctive sans-serif' },
  { value: 'system', label: 'System UI', description: 'Native OS font stack' },
  { value: 'serif', label: 'Serif', description: 'Traditional serif typeface' },
  { value: 'sans', label: 'Sans Serif', description: 'Clean sans-serif stack' },
]

const codeFonts: FontOption<CodeFont>[] = [
  { value: 'default', label: 'Default (JetBrains Mono)', description: 'Developer-friendly monospace' },
  { value: 'jetbrains', label: 'JetBrains Mono', description: 'Same as default' },
  { value: 'fira', label: 'Fira Code', description: 'With programming ligatures' },
  { value: 'sf', label: 'SF Mono', description: 'Apple\'s monospace font' },
  { value: 'consolas', label: 'Consolas', description: 'Microsoft\'s monospace' },
  { value: 'monaco', label: 'Monaco', description: 'Classic macOS font' },
]

export function SettingsModal ({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings()

  if (!isOpen) return null

  return (
    <>
      <div
        className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50'
        onClick={onClose}
      />
      <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
        <div
          className='bg-[var(--gh-bg-elevated)] border border-[var(--gh-border)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='sticky top-0 bg-[var(--gh-bg-elevated)] border-b border-[var(--gh-border)] px-6 py-4 flex items-center justify-between'>
            <h2 className='text-xl font-bold text-[var(--gh-text-primary)]'>Settings</h2>
            <button
              onClick={onClose}
              className='p-1 text-[var(--gh-text-muted)] hover:text-[var(--gh-text-primary)] hover:bg-[var(--gh-bg-surface)] rounded transition-colors'
              aria-label='Close settings'
            >
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
          </div>

          <div className='p-6 space-y-8'>
            <section>
              <h3 className='text-lg font-semibold text-[var(--gh-text-primary)] mb-4'>Interface Font</h3>
              <p className='text-sm text-[var(--gh-text-secondary)] mb-4'>
                Choose the typeface for buttons, labels, and UI elements throughout GitHuman.
              </p>
              <div className='space-y-2'>
                {interfaceFonts.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => updateSettings({ interfaceFont: font.value })}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-lg border transition-all',
                      settings.interfaceFont === font.value
                        ? 'bg-[var(--gh-accent-primary)]/10 border-[var(--gh-accent-primary)] text-[var(--gh-accent-primary)]'
                        : 'bg-[var(--gh-bg-secondary)] border-[var(--gh-border)] text-[var(--gh-text-primary)] hover:border-[var(--gh-accent-primary)]/50'
                    )}
                  >
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='font-semibold'>{font.label}</div>
                        <div className={cn(
                          'text-sm',
                          settings.interfaceFont === font.value
                            ? 'text-[var(--gh-accent-primary)]/80'
                            : 'text-[var(--gh-text-secondary)]'
                        )}
                        >
                          {font.description}
                        </div>
                      </div>
                      {settings.interfaceFont === font.value && (
                        <svg className='w-5 h-5 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                          <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className='text-lg font-semibold text-[var(--gh-text-primary)] mb-4'>Code Font</h3>
              <p className='text-sm text-[var(--gh-text-secondary)] mb-4'>
                Choose the monospace typeface for code diffs and code blocks.
              </p>
              <div className='space-y-2'>
                {codeFonts.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => updateSettings({ codeFont: font.value })}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-lg border transition-all',
                      settings.codeFont === font.value
                        ? 'bg-[var(--gh-accent-primary)]/10 border-[var(--gh-accent-primary)] text-[var(--gh-accent-primary)]'
                        : 'bg-[var(--gh-bg-secondary)] border-[var(--gh-border)] text-[var(--gh-text-primary)] hover:border-[var(--gh-accent-primary)]/50'
                    )}
                  >
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='font-semibold font-mono'>{font.label}</div>
                        <div className={cn(
                          'text-sm',
                          settings.codeFont === font.value
                            ? 'text-[var(--gh-accent-primary)]/80'
                            : 'text-[var(--gh-text-secondary)]'
                        )}
                        >
                          {font.description}
                        </div>
                      </div>
                      {settings.codeFont === font.value && (
                        <svg className='w-5 h-5 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                          <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
