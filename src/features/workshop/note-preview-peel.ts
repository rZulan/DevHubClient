import {notePeelDuration, noteSettleDuration, notePeelShape, noteHoverProgress} from "./note-preview-motion"

export type NotePreviewMotion = Pick<Animation, "playState" | "finished" | "reverse" | "cancel">
export type NotePeel = {element: HTMLDivElement; readonly progress: number; play: () => NotePreviewMotion; moveTo: (target: number, duration: number) => NotePreviewMotion; remove: () => void}
let surfaceId = 0

export function createNotePeel(source: HTMLElement, settling = false, initialProgress = settling ? 1 : 0): NotePeel {
    const rect = source.getBoundingClientRect(), style = window.getComputedStyle(source)
    const element = document.createElement("div")
    element.className = "note-peel-scene"
    element.setAttribute("aria-hidden", "true")
    element.inert = true
    Object.assign(element.style, {left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`})
    element.style.setProperty("--note-color", style.getPropertyValue("--note-color").trim() || style.backgroundColor)
    for (const name of ["--workshop-font-code", "--workshop-font-ui"]) element.style.setProperty(name, style.getPropertyValue(name))
    const front = source.cloneNode(true) as HTMLElement
    front.removeAttribute("id")
    front.querySelectorAll("[id]").forEach(child => child.removeAttribute("id"))
    delete front.dataset.notePreviewActive
    delete front.dataset.noteHoverActive
    front.classList.add("note-peel-paper")
    Object.assign(front.style, {
        position: "absolute", inset: "0", width: "100%", height: "100%", margin: "0", minHeight: "0", maxHeight: "none",
        boxSizing: "border-box", overflow: "hidden", visibility: "visible", opacity: "1", transform: "none", transition: "none", filter: "none", boxShadow: "none",
        fontFamily: style.fontFamily, color: style.color,
    })
    const ns = "http://www.w3.org/2000/svg", id = `note-curl-${++surfaceId}`
    const surface = document.createElementNS(ns, "svg")
    surface.classList.add("note-peel-surface")
    surface.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`)
    const defs = document.createElementNS(ns, "defs")
    for (const [face, colors] of [["front", ["var(--note-color)", "color-mix(in srgb, var(--note-color) 85%, #534520)"]], ["back", ["color-mix(in srgb, var(--note-color) 58%, #302818)", "color-mix(in srgb, var(--note-color) 45%, #302818)"]]] as const) {
        const gradient = document.createElementNS(ns, "linearGradient")
        gradient.id = `${id}-${face}`
        gradient.setAttribute("x2", "0")
        gradient.setAttribute("y2", "1")
        colors.forEach((color, index) => {
            const stop = document.createElementNS(ns, "stop")
            stop.setAttribute("offset", String(index))
            stop.setAttribute("stop-color", color)
            gradient.append(stop)
        })
        defs.append(gradient)
    }
    const curlFront = document.createElementNS(ns, "path"), curlBack = document.createElementNS(ns, "path")
    curlFront.setAttribute("fill", `url(#${id}-front)`)
    curlBack.setAttribute("fill", `url(#${id}-back)`)
    surface.append(defs, curlFront, curlBack)
    element.append(front, surface)
    document.body.append(element)
    let held = initialProgress
    let frame = 0
    let active: {clock: Animation; from: number; to: number; duration: number} | null = null
    function progress() {
        if (!active) return held
        const time = Number(active.clock.currentTime ?? 0)
        return active.from + (active.to - active.from) * Math.max(0, Math.min(1, time / active.duration))
    }
    function cancel() {
        held = progress()
        const clock = active?.clock
        active = null
        cancelAnimationFrame(frame)
        clock?.cancel()
        render(held)
    }
    function render(value: number) {
        const shape = notePeelShape(rect.width, rect.height, value, Number.parseFloat(style.borderBottomRightRadius) || 0)
        front.style.clipPath = shape.flatClip
        curlFront.setAttribute("d", shape.frontPath)
        curlBack.setAttribute("d", shape.backPath)
    }
    function moveTo(target: number, duration: number): NotePreviewMotion {
        const from = progress(), to = Math.max(0, Math.min(1, target))
        cancel()
        duration = Math.max(1, duration)
        const clock = element.animate([{opacity: 1}, {opacity: 1}], {duration, fill: "both"})
        active = {clock, from, to, duration}
        function tick() {
            if (active?.clock !== clock) return
            render(progress())
            if (clock.playState === "running" || clock.pending) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        void clock.finished.then(() => {if (active?.clock === clock) {cancelAnimationFrame(frame); render(progress())}}, () => {})
        return {
            get playState() {return clock.playState},
            get finished() {return clock.finished},
            reverse() {clock.reverse(); cancelAnimationFrame(frame); frame = requestAnimationFrame(tick)},
            cancel,
        }
    }
    render(held)
    return {
        element, get progress() {return progress()}, moveTo,
        play() {const target = settling ? 0 : 1; return moveTo(target, Math.abs(target - progress()) * (settling ? noteSettleDuration : notePeelDuration))},
        remove() {cancel(); element.remove()},
    }
}

const hovering = new Map<HTMLElement, NotePeel>()

export function beginNoteHover(source: HTMLElement) {
    if (source.dataset.notePreviewActive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let peel = hovering.get(source)
    if (!peel) {
        peel = createNotePeel(source)
        hovering.set(source, peel)
        source.dataset.noteHoverActive = "true"
    }
    peel.moveTo(noteHoverProgress, 180)
}

export function endNoteHover(source: HTMLElement) {
    const peel = hovering.get(source)
    if (!peel) return
    void peel.moveTo(0, 140).finished.then(() => {
        if (hovering.get(source) !== peel) return
        hovering.delete(source)
        delete source.dataset.noteHoverActive
        peel.remove()
    }, () => {})
}

export function claimNoteHover(source: HTMLElement) {
    const peel = hovering.get(source)
    hovering.delete(source)
    clearNoteHovers()
    return peel
}

export function clearNoteHovers() {
    for (const [source, peel] of hovering) {
        delete source.dataset.noteHoverActive
        peel.remove()
    }
    hovering.clear()
}
