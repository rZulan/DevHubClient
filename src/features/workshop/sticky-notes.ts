import type {CSSProperties} from "react"
import {contrastRatio} from "./appearance/color-schemes.ts"

export const noteColors = [
    {name: "Butter", color: "#f6e7a6"},
    {name: "Peach", color: "#f7ceb0"},
    {name: "Rose", color: "#f2c6d4"},
    {name: "Lavender", color: "#dbd0f4"},
    {name: "Sky", color: "#c3e0f4"},
    {name: "Mint", color: "#cce5ce"},
] as const

// Keep text readable when a member chooses a custom sticky-note color.
export function noteTextColor(color: string) {
    if (contrastRatio(color, "#191714") >= 4.5) return "#191714"
    return contrastRatio(color, "#ffffff") >= 4.5 ? "#ffffff" : "#000000"
}

// Store the chosen color unchanged; CSS resolves the paper and ink for the active theme.
export function noteStyle(color: string): CSSProperties {
    // Keep most of the chosen color, with a little charcoal to soften it at night.
    // Resolve an exact color so custom hues get contrast-checked text as well.
    const darkColor = "#" + [1, 3, 5].map(start =>
        Math.round(parseInt(color.slice(start, start + 2), 16) * .75 + 24 * .25).toString(16).padStart(2, "0")
    ).join("")
    return {
        "--note-base-color": color,
        "--note-light-ink": noteTextColor(color),
        "--note-dark-color": darkColor,
        "--note-dark-ink": noteTextColor(darkColor),
    } as CSSProperties
}
