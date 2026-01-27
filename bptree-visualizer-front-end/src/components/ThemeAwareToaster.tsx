import { useEffect, useState } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

export function ThemeAwareToaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Helper to get current theme
    const getTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    
    // Initial check
    setTheme(getTheme())

    // Observe changes to html class
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
           setTheme(getTheme())
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  return <SonnerToaster position="bottom-right" richColors theme={theme} />
}
