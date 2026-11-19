type ConnectionProblem = {code?: unknown; detail?: unknown; title?: unknown; errors?: unknown}

function responseStatus(error: unknown) {
    if (!error || typeof error !== "object" || !("status" in error)) return undefined
    return error.status === "PARSING_ERROR" && "originalStatus" in error ? error.originalStatus : error.status
}

function problemDetails(error: unknown) {
    if (!error || typeof error !== "object" || !("data" in error) || !error.data || typeof error.data !== "object") return undefined
    return error.data as ConnectionProblem
}

export function connectionError(error: unknown, fallback: string) {
    const data = problemDetails(error)
    if (typeof data?.detail === "string") return data.detail
    if (data?.errors && typeof data.errors === "object") {
        const message = Object.values(data.errors).flat().find(value => typeof value === "string")
        if (message) return message
    }
    return typeof data?.title === "string" ? data.title : fallback
}

export function connectionLoadFailure(error: unknown, fallback: string) {
    const status = responseStatus(error)
    const code = problemDetails(error)?.code

    if (status === 404) {
        if (code === "Connections.NotFound") {
            return {message: "This project is unavailable. Open a project you have access to and try Connections there.", canRetry: false}
        }
        if (!code || code === "Http.404") {
            return {message: "This server is missing the Connections API. Update or restart the DevHub API, then reopen Connections.", canRetry: false}
        }
        return {message: connectionError(error, fallback), canRetry: false}
    }
    if (status === 401) return {message: "Sign in again to open Connections.", canRetry: false}
    if (status === 403) return {message: connectionError(error, "Your account lacks permission to open Connections in this project."), canRetry: false}
    return {message: connectionError(error, fallback), canRetry: true}
}
