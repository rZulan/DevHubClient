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
