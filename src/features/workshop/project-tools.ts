// Playground is archived; keep its canvas implementation and project data for later.
export const projectToolIds = ["todo", "notes", "erd", "ui-editor", "sdlc", "state-machine"] as const
export type ProjectToolId = typeof projectToolIds[number]
export type ToolPreferences = { order: ProjectToolId[]; hidden: ProjectToolId[] }

export function normalizeToolPreferences(value: unknown): ToolPreferences {
    const data = value as Partial<ToolPreferences> | null
    const isTool = (id: unknown): id is ProjectToolId => projectToolIds.includes(id as ProjectToolId)
    const order = Array.isArray(data?.order) ? [...new Set(data.order.filter(isTool))] : []
    return {
        order: [...order, ...projectToolIds.filter(id => !order.includes(id))],
        hidden: Array.isArray(data?.hidden) ? [...new Set(data.hidden.filter(isTool))] : [],
    }
}

export function moveTool(preferences: ToolPreferences, id: ProjectToolId, direction: -1 | 1): ToolPreferences {
    const order = [...preferences.order]
    const index = order.indexOf(id)
    const next = index + direction
    if (index < 0 || next < 0 || next >= order.length) return preferences
    ;[order[index], order[next]] = [order[next], order[index]]
    return {...preferences, order}
}

export function reorderTool(preferences: ToolPreferences, id: ProjectToolId, targetIndex: number): ToolPreferences {
    const index = preferences.order.indexOf(id)
    if (index < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= preferences.order.length || index === targetIndex) return preferences
    const order = preferences.order.filter(tool => tool !== id)
    order.splice(targetIndex, 0, id)
    return {...preferences, order}
}
