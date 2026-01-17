import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Switch } from './ui/switch'

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  
  const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (stored) return stored
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function Header() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center">
          <h1 className="text-xl font-bold">MiniDB</h1>
        </div>
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4" />
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            aria-label="Toggle theme"
          />
          <Moon className="h-4 w-4" />
        </div>
      </div>
    </header>
  )
}
