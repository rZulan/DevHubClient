// Keep theme selection before first paint while allowing a strict script-src policy.
(() => {
    const key = "devhub.theme"
    const normalize = value => ["light", "dark", "system"].includes(value) ? value : undefined

    function readCookie() {
        try {
            const cookie = document.cookie.split(/;\s*/).find(value => value.startsWith(`${key}=`))
            return normalize(cookie?.slice(key.length + 1))
        } catch {}
    }

    function readStorage() {
        try {
            return normalize(localStorage.getItem(key))
        } catch {}
    }

    function writeCookie(theme) {
        const host = location.hostname
        const domain = host === "dev-hub.site" || host.endsWith(".dev-hub.site") ? "; Domain=dev-hub.site" : ""
        const secure = location.protocol === "https:" ? "; Secure" : ""
        try {
            document.cookie = `${key}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`
        } catch {}
    }

    // Migrate the existing browser preference when the shared cookie is first introduced.
    const sharedTheme = readCookie()
    const storedTheme = readStorage()
    if (!sharedTheme && storedTheme) writeCookie(storedTheme)

    let theme = sharedTheme ?? storedTheme ?? "system"
    window.zevontTheme = {
        get() {
            theme = readCookie() ?? readStorage() ?? theme
            return theme
        },
        set(value) {
            theme = value
            writeCookie(value)
            try {
                localStorage.setItem(key, value)
            } catch {}
        },
    }

    const isDark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList.toggle("dark", isDark)
    document.documentElement.style.colorScheme = isDark ? "dark" : "light"
})()
