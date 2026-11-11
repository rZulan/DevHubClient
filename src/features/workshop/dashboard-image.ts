import {avatarFileError} from "./avatar-image.ts"

export const dashboardImageFits = [
    {id: "cover", label: "Fill", description: "Crop to fill the frame."},
    {id: "contain", label: "Fit", description: "Show the whole image without stretching."},
    {id: "fill", label: "Stretch", description: "Stretch the image to the frame’s width and height."},
] as const

export type DashboardImageFit = typeof dashboardImageFits[number]["id"]

export function dashboardImageFit(value: unknown): DashboardImageFit {
    return value === "contain" || value === "fill" ? value : "cover"
}

const maxEncodedImageLength = 174800

export function dashboardImageSource(value: unknown) {
    if (typeof value !== "string") return undefined
    const source = value.trim()
    if (source.length <= maxEncodedImageLength && /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(source)) return source
    if (source.length > 900) return undefined
    if (/^\/(?![\/\\])/.test(source)) return source
    try { return new URL(source).protocol === "https:" ? source : undefined } catch { return undefined }
}

export async function prepareDashboardImage(file: File) {
    const error = avatarFileError(file)
    if (error) throw new Error(error)
    const url = URL.createObjectURL(file)
    try {
        const image = new Image()
        image.src = url
        try { await image.decode() } catch { throw new Error("This image could not be opened. Choose another file.") }
        const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
        if (!longestSide) throw new Error("This image has no usable dimensions.")
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")
        if (!context) throw new Error("Your browser could not prepare the image.")

        // Keep the source proportions and bound the saved raster rather than storing the original file.
        for (let side = Math.min(1600, longestSide); side >= Math.min(192, longestSide); side *= .75) {
            canvas.width = Math.max(1, Math.round(image.naturalWidth * side / longestSide))
            canvas.height = Math.max(1, Math.round(image.naturalHeight * side / longestSide))
            context.drawImage(image, 0, 0, canvas.width, canvas.height)
            for (const quality of [.86, .7, .55]) {
                const source = canvas.toDataURL("image/webp", quality)
                if (source.length <= maxEncodedImageLength && dashboardImageSource(source)) return source
            }
        }
        throw new Error("This image could not be made small enough to save. Try a smaller file.")
    } finally { URL.revokeObjectURL(url) }
}
