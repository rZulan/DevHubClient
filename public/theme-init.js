// Keep theme selection before first paint while allowing a strict script-src policy.
(() => {
    try {
        const theme = localStorage.getItem("devhub.theme")
        const isDark = theme === "dark" ||
            (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
        document.documentElement.classList.toggle("dark", isDark)
        document.documentElement.style.colorScheme = isDark ? "dark" : "light"
    } catch {}
})()
