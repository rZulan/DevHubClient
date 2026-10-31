// Playground is archived; keep its canvas implementation and project data for later.
export const projectToolIds = ["todo", "notes", "erd", "ui-editor", "sdlc", "state-machine", "calendar", "bug-reports", "project-wiki"] as const
export type ProjectToolId = typeof projectToolIds[number]
export type ToolPreferences = { order: ProjectToolId[]; hidden: ProjectToolId[] }
export const projectNavigationCategories: readonly {id: string; title: string; tools: readonly ProjectToolId[]}[] = [
    {id: "planning", title: "Tracking", tools: ["todo", "calendar", "bug-reports", "sdlc"]},
    {id: "design", title: "Design", tools: ["erd", "ui-editor", "state-machine"]},
    {id: "knowledge", title: "Resources", tools: ["project-wiki", "notes"]},
]

export function normalizeToolPreferences(value: unknown, available: readonly ProjectToolId[] = projectToolIds): ToolPreferences {
    const data = value as Partial<ToolPreferences> | null
    const isTool = (id: unknown): id is ProjectToolId => available.includes(id as ProjectToolId)
    const order = Array.isArray(data?.order) ? [...new Set(data.order.filter(isTool))] : []
    return {
        order: [...order, ...available.filter(id => !order.includes(id))],
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
