import {HubConnectionBuilder} from "@microsoft/signalr"

import {store} from "@/app/store"
import {api} from "@/services/api"

const refreshBeforeExpiryMs = 60_000

export function realtimeConnection(path: "/hubs/chat" | "/hubs/workshop", userId: string) {
    const builder = new HubConnectionBuilder()
        .withUrl(path, {
            withCredentials: true,
            accessTokenFactory: async () => {
                const auth = store.getState().auth
                if (auth.user?.id !== userId) throw new Error("The active session changed.")
                if (auth.accessToken && Date.parse(auth.accessTokenExpiresAtUtc ?? "") - Date.now() > refreshBeforeExpiryMs + 5_000) {
                    return auth.accessToken
                }

                try {
                    const session = await store.dispatch(api.endpoints.refresh.initiate(undefined, {track: false})).unwrap()
                    if (session.userId === userId && store.getState().auth.user?.id === userId) return session.accessToken
                } catch {
                    const current = store.getState().auth
                    if (current.user?.id === userId && current.accessToken &&
                        Date.parse(current.accessTokenExpiresAtUtc ?? "") > Date.now()) return current.accessToken
                }
                throw new Error("Unable to refresh the realtime session.")
            },
        })

    // An already-running Vite server can still serve the older optimized dependency.
    builder.withAuthenticationRefresh?.({refreshBeforeExpirationInMilliseconds: refreshBeforeExpiryMs})
    return builder
}
