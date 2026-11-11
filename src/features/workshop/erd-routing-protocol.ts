import type {planErdRoutes, erdCrossingGaps} from "./erd-route-plan.ts"
import type {ErdDocument} from "./tool-documents.ts"

export type ErdRoutePlan = {connections: ReturnType<typeof planErdRoutes>; crossings: ReturnType<typeof erdCrossingGaps>}
export type ErdRoutingRequest = {id: number; document: ErdDocument}
export type ErdRoutingResponse = {id: number; routes: {id: string; laneOffset: number; route: ErdRoutePlan["connections"][number]["route"]}[]; crossings: ErdRoutePlan["crossings"]}

/** Accept only the latest requested diagram; queued intermediate drops are discarded. */
export function createErdRoutingQueue(send: (request: ErdRoutingRequest) => void, apply: (document: ErdDocument, response: ErdRoutingResponse) => void) {
    let sequence = 0, running: ErdRoutingRequest | undefined, pending: ErdRoutingRequest | undefined
    function dispatch() {
        if (running || !pending) return
        running = pending; pending = undefined
        send(running)
    }
    return {
        request(document: ErdDocument) {pending = {id: ++sequence, document}; dispatch()},
        receive(response: ErdRoutingResponse) {
            if (response.id !== running?.id) return
            const completed = running
            running = undefined
            if (!pending) apply(completed.document, response)
            dispatch()
        },
    }
}
