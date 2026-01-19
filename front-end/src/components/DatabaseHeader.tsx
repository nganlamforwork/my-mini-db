import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sun, Moon, Eye, EyeOff } from 'lucide-react'
import { Button } from './ui/button'
import { IconSwitch } from './ui/icon-switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  
  const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (stored) return stored
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface DatabaseHeaderProps {
  databaseName: string
  onBackClick?: () => void
  showVisualizer?: boolean
  onVisualizerToggle?: (show: boolean) => void
}

export function DatabaseHeader({ databaseName, onBackClick, showVisualizer = false, onVisualizerToggle }: DatabaseHeaderProps) {
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
        <div className="flex items-center gap-4">
          {/* Visualizer Toggle */}
          {onVisualizerToggle && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 border-r border-border pr-4">
                    <IconSwitch
                      id="visualizer-toggle"
                      checked={showVisualizer}
                      onCheckedChange={onVisualizerToggle}
                      activeIcon={EyeOff}
                      inactiveIcon={Eye}
                      aria-label="Show/Hide Graph"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show/Hide Graph</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Theme Toggle */}
          <div className="flex items-center gap-2">
            <IconSwitch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              activeIcon={Moon}
              inactiveIcon={Sun}
              aria-label="Toggle theme"
            />
          </div>
        </div>
      </div>
    </header>
  )
}
