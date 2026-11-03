import {useLayoutEffect, useRef} from "react"

export function useExportPanelPosition(visible: boolean) {
    const ref = useRef<HTMLElement>(null)
    useLayoutEffect(() => {
        const panel = ref.current
        if (!visible || !panel) return
        let frame = 0, offsetX = 0, offsetY = 0
        const overlaps = (a: {left: number; right: number; top: number; bottom: number}, b: DOMRect) => a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8
        function place() {
            frame = 0
            const style = getComputedStyle(panel!), bounds = panel!.getBoundingClientRect()
            const edgeRight = parseFloat(style.right) - offsetX, edgeBottom = parseFloat(style.bottom) - offsetY
            let right = edgeRight, bottom = edgeBottom
            const rect = () => ({left: window.innerWidth - right - bounds.width, right: window.innerWidth - right, top: window.innerHeight - bottom - bounds.height, bottom: window.innerHeight - bottom})
            const controls = [...document.querySelectorAll<HTMLElement>(".workshop-messages-button, .workshop-zoom-control")].filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden")
            // Keep the panel docked at the bottom beside the chat launcher when
            // there is enough horizontal room; otherwise stack above it.
            for (const element of controls.filter(element => element.matches(".workshop-messages-button"))) {
                const control = element.getBoundingClientRect()
                if (!overlaps(rect(), control)) continue
                const beside = window.innerWidth - control.left + 8
                const minLeft = document.querySelector(".workshop-main-column")?.getBoundingClientRect().left ?? 0
                if (window.innerWidth - beside - bounds.width >= minLeft + 12) right = Math.max(right, beside)
                else bottom = Math.max(bottom, window.innerHeight - control.top + 8)
            }
            for (const element of controls.filter(element => element.matches(".workshop-zoom-control"))) {
                const control = element.getBoundingClientRect()
                if (overlaps(rect(), control)) bottom = Math.max(bottom, window.innerHeight - control.top + 8)
            }
            offsetX = Math.max(0, right - edgeRight)
            offsetY = Math.max(0, Math.min(bottom - edgeBottom, window.innerHeight - bounds.height - edgeBottom - 12))
            panel!.style.setProperty("--export-panel-slide", `${offsetX}px`)
            panel!.style.setProperty("--export-panel-lift", `${offsetY}px`)
            controls.forEach(element => resize.observe(element))
        }
        function schedule() {if (!frame) frame = requestAnimationFrame(place)}
        const resize = new ResizeObserver(schedule)
        resize.observe(panel)
        resize.observe(document.documentElement)
        const mutations = new MutationObserver(records => {if (records.some(record => !panel.contains(record.target))) schedule()})
        mutations.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"]})
        window.addEventListener("resize", schedule)
        window.addEventListener("scroll", schedule, true)
        place()
        return () => {
            cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect()
            window.removeEventListener("resize", schedule)
            window.removeEventListener("scroll", schedule, true)
            panel.style.removeProperty("--export-panel-slide")
            panel.style.removeProperty("--export-panel-lift")
        }
    }, [visible])
    return ref
}
