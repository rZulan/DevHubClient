import {createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useState,} from "react"
import {flushSync} from "react-dom"

export type Theme = "light" | "dark" | "system"

type ThemeContextValue = {
    theme: Theme
    setTheme: (theme: Theme) => void
}

declare global {
    interface Window {
        zevontTheme?: {get: () => Theme; set: (theme: Theme) => void}
    }
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

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

export function ThemeProvider({children}: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => window.zevontTheme?.get() ?? "system")

    useLayoutEffect(() => {
        applyTheme(theme)
    }, [theme])

    useEffect(() => {
        const syncTheme = () => {
            const preference = window.zevontTheme?.get()
            if (preference) setThemeState(preference)
        }
        const syncWhenVisible = () => {
            if (!document.hidden) syncTheme()
        }

        window.addEventListener("focus", syncTheme)
        window.addEventListener("pageshow", syncTheme)
        window.addEventListener("storage", syncTheme)
        document.addEventListener("visibilitychange", syncWhenVisible)
        return () => {
            window.removeEventListener("focus", syncTheme)
            window.removeEventListener("pageshow", syncTheme)
            window.removeEventListener("storage", syncTheme)
            document.removeEventListener("visibilitychange", syncWhenVisible)
        }
    }, [])

    useEffect(() => {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        const handleSystemThemeChange = () => applyTheme("system")

        if (theme === "system") {
            systemTheme.addEventListener("change", handleSystemThemeChange)
        }

        return () => systemTheme.removeEventListener("change", handleSystemThemeChange)
    }, [theme])

    function setTheme(nextTheme: Theme) {
        window.zevontTheme?.set(nextTheme)

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
        <ThemeContext value={{theme, setTheme}}>
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
