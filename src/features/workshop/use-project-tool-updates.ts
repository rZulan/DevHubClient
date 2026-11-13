import {useEffect, useEffectEvent} from "react"
import {HubConnectionState} from "@microsoft/signalr"
import {useAppSelector} from "@/app/hooks"
import {realtimeConnection} from "@/services/realtime"
import type {DocumentTool} from "./tool-documents"

export function useProjectToolUpdates(key: {organizationId: string; projectId: string; tool: DocumentTool | "todo"}, enabled: boolean, onChange: (revision?: number) => void) {
    const userId = useAppSelector(state => state.auth.user?.id)
    const receive = useEffectEvent(onChange)
    useEffect(() => {
        if (!enabled || !userId) return
        let disposed = false, attempt = 0, restarting = false
        let timer: ReturnType<typeof setTimeout> | undefined
        const connection = realtimeConnection("/hubs/workshop", userId).build()
        connection.on("ProjectToolChanged", (projectId: string, tool: string, revision: number) => {
            if (!disposed && projectId.toLowerCase() === key.projectId.toLowerCase() && tool === key.tool && Number.isInteger(revision) && revision >= 0) receive(revision)
        })
        function retry() {
            clearTimeout(timer)
            if (!disposed) timer = setTimeout(() => void start(), Math.min(1000 * 2 ** Math.min(attempt++, 5), 30000))
        }
        async function start() {
            if (disposed || connection.state !== HubConnectionState.Disconnected) return
            try {
                await connection.start()
                if (disposed) return
                await connection.invoke("JoinProjectTools", key.organizationId, key.projectId)
                if (!disposed) {attempt = 0; receive()}
            } catch {if (!disposed) {restarting = true; try {await connection.stop()} finally {restarting = false; retry()}}}
        }
        connection.onclose(() => {if (!restarting) retry()})
        const refetchOnFocus = () => {if (!disposed) receive()}
        window.addEventListener("focus", refetchOnFocus)
        void start()
        return () => {disposed = true; clearTimeout(timer); window.removeEventListener("focus", refetchOnFocus); void connection.stop()}
    }, [enabled, userId, key.organizationId, key.projectId, key.tool])
}
