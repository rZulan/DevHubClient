export const umlSides = ["top", "right", "bottom", "left"] as const
export type UmlSide = typeof umlSides[number]
export type UmlPoint = {x: number; y: number}
export type UmlEndpoint = {shapeId: string; side: UmlSide; offset: number} | UmlPoint
export type UmlConnection = {start: UmlEndpoint; end: UmlEndpoint; routing: "straight" | "orthogonal" | "curve"; bends: UmlPoint[]; sourceMultiplicity: string; targetMultiplicity: string; sourceRole: string; targetRole: string; guard: string; effect?: string; number: number | null}
export const umlConnectorSymbols = ["association", "directed", "generalization", "realization", "dependency", "aggregation", "composition", "include", "extend", "sync", "async", "reply", "create-message", "destroy-message", "note-link", "extension", "containment"] as const
export type UmlConnectorSymbol = typeof umlConnectorSymbols[number]
export type UmlDetails = {name: string; stereotype: string; attributes: string; operations: string; entry: string; activity: string; exit: string; operator: string; operands: string}
export function validUmlEndpoint(value: unknown): value is UmlEndpoint {
    if (!value || typeof value !== "object") return false
    const e = value as Record<string, unknown>
    return "shapeId" in e ? typeof e.shapeId === "string" && !!e.shapeId.trim() && e.shapeId.length <= 100 && umlSides.includes(e.side as UmlSide) && typeof e.offset === "number" && Number.isFinite(e.offset) && e.offset >= 0 && e.offset <= 1 : typeof e.x === "number" && Number.isFinite(e.x) && Math.abs(e.x) <= 1e12 && typeof e.y === "number" && Number.isFinite(e.y) && Math.abs(e.y) <= 1e12
}
export function validUmlConnection(value: unknown): value is UmlConnection {
    if (!value || typeof value !== "object") return false
    const c = value as Record<string, unknown>
    return validUmlEndpoint(c.start) && validUmlEndpoint(c.end) && ["straight","orthogonal","curve"].includes(c.routing as string) && Array.isArray(c.bends) && c.bends.length <= 32 && c.bends.every(p => validUmlEndpoint(p) && !("shapeId" in p)) && ["sourceMultiplicity","targetMultiplicity","sourceRole","targetRole","guard"].every(k => typeof c[k] === "string" && (c[k] as string).length <= (k === "guard" ? 500 : 100)) && (c.effect===undefined || typeof c.effect==="string"&&c.effect.length<=2000) && (c.number === null || typeof c.number === "number" && Number.isInteger(c.number) && c.number >= 1 && c.number <= 10000)
}
export function validUmlDetails(value: unknown): value is UmlDetails {
    return !!value && typeof value === "object" && ["name","stereotype","attributes","operations","entry","activity","exit","operator","operands"].every(k => typeof (value as Record<string,unknown>)[k] === "string" && ((value as Record<string,string>)[k].length <= (["attributes","operations","operands"].includes(k) ? 10000 : k === "name" ? 150 : 2000)))
}
