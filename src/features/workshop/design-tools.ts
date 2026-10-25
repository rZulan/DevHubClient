import {Circle, Frame, Hand, MousePointer2, RectangleHorizontal, Square, Type} from "lucide-react"
import type {DesignKind} from "./design-document"

export type DesignTool = "select" | "hand" | DesignKind
export const designTools = [
    {id: "select", icon: MousePointer2, label: "Move", key: "V"}, {id: "hand", icon: Hand, label: "Hand", key: "H"},
    {id: "frame", icon: Frame, label: "Frame", key: "F"}, {id: "rectangle", icon: Square, label: "Rectangle", key: "R"},
    {id: "ellipse", icon: Circle, label: "Ellipse", key: "O"}, {id: "text", icon: Type, label: "Text", key: "T"},
    {id: "button", icon: RectangleHorizontal, label: "Button", key: "B"},
] as const
