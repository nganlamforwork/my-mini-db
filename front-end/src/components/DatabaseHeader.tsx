import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sun, Moon } from 'lucide-react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  
  const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (stored) return stored
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface DatabaseHeaderProps {
  databaseName: string
  onBackClick?: () => void
}

export function DatabaseHeader({ databaseName, onBackClick }: DatabaseHeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const navigate = useNavigate()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick()
    } else {
      navigate('/')
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">{databaseName}</h1>
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
