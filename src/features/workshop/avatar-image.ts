export const avatarMaxFileBytes = 10 * 1024 * 1024
export function avatarFileError(file: {size: number; type: string}) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "Choose a PNG, JPEG or WebP image."
    if (!file.size || file.size > avatarMaxFileBytes) return "Choose an image smaller than 10 MB."
    return ""
}

/** Center-crop and downsize before upload so organization/team listings stay small. */
export async function prepareAvatarImage(file: File): Promise<string> {
    const error = avatarFileError(file)
    if (error) throw new Error(error)
    const url = URL.createObjectURL(file)
    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const candidate = new Image()
            candidate.onload = () => resolve(candidate)
            candidate.onerror = () => reject(new Error("This image could not be read. Choose another file."))
            candidate.src = url
        })
        if (!image.naturalWidth || !image.naturalHeight) throw new Error("This image has no usable dimensions.")
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 256
        const context = canvas.getContext("2d")
        if (!context) throw new Error("Your browser could not prepare the image.")
        const side = Math.min(image.naturalWidth, image.naturalHeight)
        context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256)
        const result = canvas.toDataURL("image/webp", .85)
        if (result.length > 174800) throw new Error("This image is too complex to save as an icon. Choose a smaller or simpler image.")
        return result
    } finally {URL.revokeObjectURL(url)}
}
