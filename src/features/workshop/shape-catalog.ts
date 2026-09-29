import type {CanvasItem} from "./shape-clipboard"

export const shapeKinds = ["rectangle", "note", "ellipse", "triangle", "pentagon", "hexagon", "star", "diamond", "parallelogram", "terminator", "database", "document", "entity", "line", "arrow", "double-arrow", "elbow-arrow", "text"] as const
export type ShapeKind = typeof shapeKinds[number]
export type ShapePreset = {
    id: string;
    label: string;
    category: string;
    kind: ShapeKind;
    changes?: Partial<CanvasItem>
}

export const shapePresets: ShapePreset[] = [
    ...(["rectangle", "ellipse", "triangle", "pentagon", "hexagon", "star", "diamond", "parallelogram"] as const).map(kind => ({
        id: kind,
        label: kind[0].toUpperCase() + kind.slice(1),
        category: "Basic shapes",
        kind
    })),
    {
        id: "note",
        label: "Note",
        category: "Basic shapes",
        kind: "note",
        changes: {
            width: 240,
            height: 180,
            appearance: "fill",
            fillColor: "#fef3c7",
            outlineColor: "#f59e0b",
            cornerRadius: 12,
            noteHeader: "New note",
            noteBody: "Add your idea here.",
            textAlign: "left"
        }
    },
    {id: "process", label: "Process", category: "Diagrams", kind: "rectangle", changes: {text: "Process"}},
    {id: "decision", label: "Decision", category: "Diagrams", kind: "diamond", changes: {text: "Decision"}},
    {id: "terminator", label: "Start / End", category: "Diagrams", kind: "terminator", changes: {text: "Start"}},
    {id: "database", label: "Database", category: "Diagrams", kind: "database"},
    {id: "document", label: "Document", category: "Diagrams", kind: "document"},
    {
        id: "entity",
        label: "ERD entity",
        category: "Diagrams",
        kind: "entity",
        changes: {width: 220, height: 160, text: "Entity\nPK  id\n     name", textAlign: "left", verticalAlign: "top"}
    },
    {id: "attribute", label: "ERD attribute", category: "Diagrams", kind: "ellipse", changes: {text: "Attribute"}},
    {id: "relationship", label: "Relationship", category: "Diagrams", kind: "diamond", changes: {text: "Has"}},
    {id: "erd", label: "ERD starter", category: "Diagrams", kind: "entity"},
    {id: "waterfall", label: "Waterfall", category: "Diagrams", kind: "rectangle"},
    ...(["line", "arrow", "double-arrow", "elbow-arrow"] as const).map((kind, index) => ({
        id: kind,
        label: ["Line", "Arrow", "Two-way arrow", "Elbow arrow"][index],
        category: "Lines & arrows",
        kind,
        changes: {height: kind === "elbow-arrow" ? 100 : 40}
    })),
    {
        id: "dashed-line",
        label: "Dashed line",
        category: "Lines & arrows",
        kind: "line",
        changes: {height: 40, outlineStyle: "dashed"}
    },
    ...(["Title", "Subtitle", "Heading", "Subheading", "Paragraph", "Caption"] as const).map((label, index) => ({
        id: label.toLowerCase(),
        label,
        category: "Text",
        kind: "text" as const,
        changes: {
            text: label === "Paragraph" ? "Write your paragraph here." : label,
            fontSize: [40, 24, 32, 20, 16, 12][index],
            bold: index === 0 || index === 2 || index === 3,
            width: 360,
            height: index === 4 ? 140 : 80,
            textAlign: "left" as const,
            verticalAlign: "top" as const,
            outlineStyle: "none" as const
        }
    })),
]

export function shapeLabel(kind: ShapeKind) {
    if (kind === "text") return "Text"
    return shapePresets.find(preset => preset.kind === kind)?.label ?? "Shape"
}

export function presetItems(preset: ShapePreset): Partial<CanvasItem>[] {
    if (preset.id === "waterfall") return ["Requirements", "Design", "Implementation", "Testing", "Deployment"].flatMap((text, index) => [
        {kind: "rectangle", text, x: index * 100, y: index * 110, width: 190, height: 70},
        ...(index < 4 ? [{
            kind: "elbow-arrow" as const,
            x: index * 100 + 95,
            y: index * 110 + 70,
            width: 100,
            height: 40
        }] : []),
    ])
    if (preset.id === "erd") return [
        {
            kind: "entity",
            x: 0,
            y: 0,
            width: 220,
            height: 160,
            text: "Customer\nPK  customer_id\n     name",
            textAlign: "left",
            verticalAlign: "top"
        },
        {kind: "arrow", x: 220, y: 60, width: 120, height: 40, text: "1 : N", fontSize: 12, verticalAlign: "top"},
        {
            kind: "entity",
            x: 340,
            y: 0,
            width: 220,
            height: 160,
            text: "Order\nPK  order_id\nFK  customer_id",
            textAlign: "left",
            verticalAlign: "top"
        },
    ]
    return [{kind: preset.kind, x: 0, y: 0, ...preset.changes}]
}
