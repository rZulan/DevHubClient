import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react"
import { flushSync } from "react-dom"

export type Theme = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const storageKey = "devhub.theme"
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getStoredTheme(): Theme {
  try {
    const storedTheme = window.localStorage.getItem(storageKey)
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme
  } catch {
    // Fall back to the system setting when browser storage is unavailable.
  }

  return "system"
}

function resolveTheme(theme: Theme) {
  return (
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme
  )
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement
  const resolvedTheme = resolveTheme(theme)

  root.classList.toggle("dark", resolvedTheme === "dark")
  root.style.colorScheme = resolvedTheme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
    const handleSystemThemeChange = () => applyTheme("system")

    if (theme === "system") {
      systemTheme.addEventListener("change", handleSystemThemeChange)
    }

    return () => systemTheme.removeEventListener("change", handleSystemThemeChange)
  }, [theme])

  function setTheme(nextTheme: Theme) {
    try {
      window.localStorage.setItem(storageKey, nextTheme)
    } catch {
      // The selected theme still applies for the current page lifetime.
    }

    const root = window.document.documentElement
    const currentTheme = root.classList.contains("dark") ? "dark" : "light"
    const nextResolvedTheme = resolveTheme(nextTheme)
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (
      currentTheme === nextResolvedTheme ||
      reducedMotion ||
      !window.document.startViewTransition
    ) {
      setThemeState(nextTheme)
      return
    }

    window.document.startViewTransition(() => {
      flushSync(() => {
        applyTheme(nextTheme)
        setThemeState(nextTheme)
      })
    })
  }

  return (
    <ThemeContext value={{ theme, setTheme }}>
      {children}
    </ThemeContext>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
