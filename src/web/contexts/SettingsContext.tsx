import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type InterfaceFont = 'default' | 'system' | 'serif' | 'sans'
export type CodeFont = 'default' | 'jetbrains' | 'fira' | 'sf' | 'consolas' | 'monaco'

interface Settings {
  interfaceFont: InterfaceFont;
  codeFont: CodeFont;
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  interfaceFont: 'default',
  codeFont: 'default',
}

const STORAGE_KEY = 'githuman-settings'

const SettingsContext = createContext<SettingsContextValue | null>(null)

function loadSettings (): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...defaultSettings, ...parsed }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
  return defaultSettings
}

function saveSettings (settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

export function SettingsProvider ({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings () {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
