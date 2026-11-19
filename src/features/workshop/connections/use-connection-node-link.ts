import {useEffect, useRef} from "react"
import {useLocation, useSearchParams} from "react-router-dom"

type LinkedNode = {kind: string; id: string; parentId?: string}

export function useConnectionNodeLink(projectId: string, reveal: (node: LinkedNode) => boolean) {
    const [params] = useSearchParams()
    const {key: locationKey} = useLocation()
    const handled = useRef<string | null>(null)
    const linkedProject = params.get("project")
    const kind = params.get("nodeKind")
    const id = params.get("node")
    const parentId = params.get("nodeParent") ?? undefined
    useEffect(() => {
        if (linkedProject !== projectId || !kind || !id || handled.current === locationKey) return
        if (reveal({kind, id, parentId})) handled.current = locationKey
    }, [linkedProject, projectId, kind, id, parentId, locationKey, reveal])
}
