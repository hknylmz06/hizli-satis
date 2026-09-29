import { createContext, useContext, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const ThemeContext = createContext(null)

export function readTheme() {
  return localStorage.getItem('app_theme') === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.classList.toggle('light', theme === 'light')
  root.classList.toggle('dark', theme !== 'light')
}

applyTheme(readTheme())

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('app_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

export function ThemeToggle({ className = '', labeled = false }) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
      className={className}
    >
      {isDark ? <Sun className="w-4 h-4 text-amber-500 shrink-0" /> : <Moon className="w-4 h-4 text-indigo-600 shrink-0" />}
      {labeled && <span>{isDark ? 'Açık tema' : 'Koyu tema'}</span>}
    </button>
  )
}
