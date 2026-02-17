import { useEffect } from 'react'
import { useSettings } from '../contexts/SettingsContext'

export function FontApplier () {
  const { settings } = useSettings()

  useEffect(() => {
    document.documentElement.setAttribute('data-interface-font', settings.interfaceFont)
    document.documentElement.setAttribute('data-code-font', settings.codeFont)
  }, [settings.interfaceFont, settings.codeFont])

  return null
}
